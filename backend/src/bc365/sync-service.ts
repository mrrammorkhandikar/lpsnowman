import { storage } from "../storage";
import { financePaymentStatuses, type Load } from "@shared/schema";
import { BC_CUSTOMER_NAME, getBc365Config } from "./config";
import { bc365Client, Bc365Error, explainBc365Error, type BcSalesOrder } from "./client";
import {
  buildSnapshot,
  compactLoadId,
  diffSnapshots,
  loadIdFromExternal,
  parsePaymentStatus,
  snapshotFromBcOrder,
  snapshotHash,
  toSalesOrderBody,
  type LoadPilotSnapshot,
} from "./mapper";
import {
  clearBcLoadMaps,
  deleteBcLoadMap,
  getBcLoadMap,
  getBcSettings,
  insertBcSyncRun,
  listRecentBcSyncRuns,
  updateBcSettings,
  updateBcSyncRun,
  upsertBcLoadMap,
} from "./store";

function isSyncableLoad(load: Load): boolean {
  return load.isTemplate !== true;
}

async function buildLoadSnapshot(load: Load): Promise<LoadPilotSnapshot> {
  const shipment = await storage.getShipmentByLoad(load.id);
  const [driver, shipper, review] = await Promise.all([
    shipment?.driverId ? storage.getDriver(shipment.driverId) : Promise.resolve(undefined),
    storage.getUser(load.shipperId),
    shipment ? storage.getFinanceReviewByShipment(shipment.id) : Promise.resolve(undefined),
  ]);
  return buildSnapshot({
    load,
    shipment,
    driver,
    shipper,
    review,
  });
}

async function resolveCompanyId(): Promise<{ id: string; name: string }> {
  const config = getBc365Config();
  const settings = await getBcSettings();
  if (config.companyId) {
    const companies = await bc365Client.listCompanies();
    const match = companies.find((c) => c.id === config.companyId);
    const name = match?.displayName || match?.name || settings.companyName || config.companyId;
    if (settings.companyId !== config.companyId) {
      await updateBcSettings({ companyId: config.companyId, companyName: name });
    }
    return { id: config.companyId, name };
  }
  if (settings.companyId) {
    return { id: settings.companyId, name: settings.companyName || settings.companyId };
  }
  const companies = await bc365Client.listCompanies();
  if (!companies.length) {
    throw new Bc365Error("No Business Central companies were returned for this environment");
  }
  const label = (c: { name: string; displayName?: string }) =>
    `${c.name} ${c.displayName || ""}`;
  const preferred =
    companies.find((c) => /snowman|loadpilot|smartserve/i.test(label(c))) ||
    companies.find((c) => !/cronus/i.test(label(c))) ||
    companies[0];
  const name = preferred.displayName || preferred.name;
  await updateBcSettings({ companyId: preferred.id, companyName: name });
  return { id: preferred.id, name };
}

async function ensureCustomer(companyId: string): Promise<string> {
  const settings = await getBcSettings();
  if (settings.customerNumber) {
    const existing = await bc365Client.listCustomers(
      companyId,
      `number eq '${settings.customerNumber.replace(/'/g, "''")}'`,
    );
    if (existing[0]) return existing[0].number;
  }
  const byName = await bc365Client.listCustomers(
    companyId,
    `displayName eq '${BC_CUSTOMER_NAME}'`,
  );
  if (byName[0]) {
    await updateBcSettings({ customerNumber: byName[0].number });
    return byName[0].number;
  }
  try {
    const created = await bc365Client.createCustomer(companyId, {
      displayName: BC_CUSTOMER_NAME,
      number: "LOADPILOT",
      type: "Company",
    });
    await updateBcSettings({ customerNumber: created.number });
    return created.number;
  } catch (error) {
    const fallback = await bc365Client.listCustomers(companyId);
    if (!fallback[0]) {
      throw error;
    }
    await updateBcSettings({ customerNumber: fallback[0].number });
    console.warn(
      "[bc365] could not create LoadPilot customer; using existing",
      fallback[0].number,
      fallback[0].displayName,
    );
    return fallback[0].number;
  }
}

function clipOrderNumber(snapshot: LoadPilotSnapshot): string {
  const digits = snapshot.loadNumber.replace(/\D/g, "") || snapshot.loadId.replace(/-/g, "").slice(0, 8);
  return `LP${digits}`.slice(0, 20);
}

function stripUndefined(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined && value !== ""),
  );
}

async function createOrUpdateOrder(
  companyId: string,
  customerNumber: string,
  snapshot: LoadPilotSnapshot,
): Promise<BcSalesOrder> {
  const body = stripUndefined(toSalesOrderBody(snapshot, customerNumber));
  const map = await getBcLoadMap(snapshot.loadId);
  if (map?.bcOrderId) {
    try {
      const current = await bc365Client.getSalesOrder(companyId, map.bcOrderId);
      const etag = current["@odata.etag"] || "*";
      const { customerNumber: _ignored, ...patch } = body;
      await bc365Client.updateSalesOrder(companyId, map.bcOrderId, patch, etag);
      return (await bc365Client.getSalesOrder(companyId, map.bcOrderId)) || current;
    } catch (error) {
      if (!(error instanceof Bc365Error) || (error.status !== 404 && error.status !== 400)) {
        throw error;
      }
      await deleteBcLoadMap(snapshot.loadId);
    }
  }

  const external = compactLoadId(snapshot.loadId);
  const existing = await bc365Client.listSalesOrders(
    companyId,
    `externalDocumentNumber eq '${external}'`,
  );
  if (existing[0]) {
    const current = await bc365Client.getSalesOrder(companyId, existing[0].id);
    const etag = current["@odata.etag"] || "*";
    const { customerNumber: _ignored, ...patch } = body;
    await bc365Client.updateSalesOrder(companyId, current.id, patch, etag);
    return bc365Client.getSalesOrder(companyId, current.id);
  }

  try {
    return await bc365Client.createSalesOrder(companyId, {
      ...body,
      number: clipOrderNumber(snapshot),
    });
  } catch {
    const minimal = {
      customerNumber,
      externalDocumentNumber: external,
      number: clipOrderNumber(snapshot),
    };
    try {
      return await bc365Client.createSalesOrder(companyId, minimal);
    } catch {
      const { number: _n, ...withoutNumber } = minimal;
      return bc365Client.createSalesOrder(companyId, withoutNumber);
    }
  }
}

export async function pushLoadToBc(loadId: string): Promise<{ ok: boolean; error?: string }> {
  if (!getBc365Config().enabled) {
    return { ok: false, error: "BC 365 is not configured" };
  }
  const load = await storage.getLoad(loadId);
  if (!load || !isSyncableLoad(load)) {
    return { ok: true };
  }
  try {
    const company = await resolveCompanyId();
    const customerNumber = await ensureCustomer(company.id);
    const snapshot = await buildLoadSnapshot(load);
    const order = await createOrUpdateOrder(company.id, customerNumber, snapshot);
    await upsertBcLoadMap({
      loadId,
      bcOrderId: order.id,
      bcOrderNumber: order.number,
      payloadHash: snapshotHash(snapshot),
      lastError: null,
    });
    await updateBcSettings({ lastPushAt: new Date(), lastError: null });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const existing = await getBcLoadMap(loadId);
    if (existing) {
      await upsertBcLoadMap({
        loadId,
        bcOrderId: existing.bcOrderId,
        lastError: message,
      }).catch(() => undefined);
    }
    await updateBcSettings({ lastError: message });
    console.error("[bc365] push failed", loadId, message);
    return { ok: false, error: message };
  }
}

export async function listTaggedSalesOrders(companyId: string): Promise<BcSalesOrder[]> {
  const settings = await getBcSettings();
  const orders: BcSalesOrder[] = [];
  const seen = new Set<string>();
  const filters = [
    `startswith(externalDocumentNumber,'LP')`,
    settings.customerNumber
      ? `customerNumber eq '${settings.customerNumber.replace(/'/g, "''")}'`
      : `customerName eq '${BC_CUSTOMER_NAME}'`,
  ];
  for (const filter of filters) {
    try {
      const batch = await bc365Client.listSalesOrders(companyId, filter);
      for (const order of batch) {
        if (seen.has(order.id)) continue;
        seen.add(order.id);
        orders.push(order);
      }
    } catch (error) {
      console.warn("[bc365] list filter failed", filter, error);
    }
  }
  return orders;
}

export type SyncMismatch = {
  loadId: string;
  loadNumber: string;
  fields: string[];
  source: "mismatch" | "missing_on_bc" | "extra_on_bc";
  paymentStatusOurs?: string;
  paymentStatusBc?: string;
};

export type SyncStatusReport = {
  configured: boolean;
  connected: boolean;
  environment: string;
  companyId: string | null;
  companyName: string | null;
  customerNumber: string | null;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastWipeAt: string | null;
  lastError: string | null;
  ourCount: number;
  syncedCount: number;
  mismatchedCount: number;
  missingOnBc: number;
  extraOnBc: number;
  percentSynced: number;
  isFullySynced: boolean;
  mismatches: SyncMismatch[];
  recentRuns: Awaited<ReturnType<typeof listRecentBcSyncRuns>>;
};

export async function getConnectionPreview(): Promise<{
  configured: boolean;
  connected: boolean;
  environment: string;
  companies: Array<{ id: string; name: string }>;
  error?: string;
}> {
  const config = getBc365Config();
  if (!config.enabled) {
    return {
      configured: false,
      connected: false,
      environment: config.environment,
      companies: [],
      error: "Missing BC env vars",
    };
  }
  try {
    await bc365Client.pingToken();
    const companies = await bc365Client.listCompanies();
    return {
      configured: true,
      connected: true,
      environment: bc365Client.config.environment,
      companies: companies.map((c) => ({
        id: c.id,
        name: c.displayName || c.name,
      })),
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      environment: bc365Client.config.environment,
      companies: [],
      error: explainBc365Error(error),
    };
  }
}

export async function compareSyncStatus(): Promise<SyncStatusReport> {
  const settings = await getBcSettings();
  const preview = await getConnectionPreview();
  const loads = (await storage.getAllLoads()).filter(isSyncableLoad);
  const empty: SyncStatusReport = {
    configured: preview.configured,
    connected: preview.connected,
    environment: preview.environment,
    companyId: settings.companyId,
    companyName: settings.companyName,
    customerNumber: settings.customerNumber,
    lastPushAt: settings.lastPushAt?.toISOString() ?? null,
    lastPullAt: settings.lastPullAt?.toISOString() ?? null,
    lastWipeAt: settings.lastWipeAt?.toISOString() ?? null,
    lastError: preview.error || settings.lastError || null,
    ourCount: loads.length,
    syncedCount: 0,
    mismatchedCount: 0,
    missingOnBc: loads.length,
    extraOnBc: 0,
    percentSynced: 0,
    isFullySynced: loads.length === 0,
    mismatches: [],
    recentRuns: await listRecentBcSyncRuns(8),
  };
  if (!preview.connected) return empty;

  const company = await resolveCompanyId();
  const bcOrders = await listTaggedSalesOrders(company.id);
  const bcByLoadId = new Map<string, BcSalesOrder>();
  const extra: SyncMismatch[] = [];
  for (const order of bcOrders) {
    const loadId = loadIdFromExternal(order.externalDocumentNumber);
    if (loadId) {
      bcByLoadId.set(loadId, order);
    } else {
      extra.push({
        loadId: order.id,
        loadNumber: order.number || order.externalDocumentNumber || order.id,
        fields: ["unmapped"],
        source: "extra_on_bc",
        paymentStatusBc: snapshotFromBcOrder(order).paymentStatus,
      });
    }
  }

  const mismatches: SyncMismatch[] = [...extra];
  let syncedCount = 0;
  let mismatchedCount = 0;
  let missingOnBc = 0;

  for (const load of loads) {
    const snapshot = await buildLoadSnapshot(load);
    const order = bcByLoadId.get(load.id);
    if (!order) {
      missingOnBc += 1;
      mismatches.push({
        loadId: load.id,
        loadNumber: snapshot.loadNumber,
        fields: ["missing"],
        source: "missing_on_bc",
        paymentStatusOurs: snapshot.paymentStatus,
      });
      continue;
    }
    bcByLoadId.delete(load.id);
    const bcSnap = snapshotFromBcOrder(order);
    const fields = diffSnapshots(snapshot, bcSnap);
    if (fields.length === 0) {
      syncedCount += 1;
    } else {
      mismatchedCount += 1;
      mismatches.push({
        loadId: load.id,
        loadNumber: snapshot.loadNumber,
        fields,
        source: "mismatch",
        paymentStatusOurs: snapshot.paymentStatus,
        paymentStatusBc: bcSnap.paymentStatus,
      });
    }
  }

  for (const [loadId, order] of bcByLoadId) {
    extra.push({
      loadId,
      loadNumber: order.number || order.externalDocumentNumber || loadId,
      fields: ["unknown_load"],
      source: "extra_on_bc",
      paymentStatusBc: snapshotFromBcOrder(order).paymentStatus,
    });
    mismatches.push(extra[extra.length - 1]);
  }

  const extraOnBc = mismatches.filter((m) => m.source === "extra_on_bc").length;
  const percentSynced = loads.length === 0 ? 100 : Math.round((syncedCount / loads.length) * 100);

  return {
    configured: true,
    connected: true,
    environment: preview.environment,
    companyId: company.id,
    companyName: company.name,
    customerNumber: (await getBcSettings()).customerNumber,
    lastPushAt: settings.lastPushAt?.toISOString() ?? null,
    lastPullAt: settings.lastPullAt?.toISOString() ?? null,
    lastWipeAt: settings.lastWipeAt?.toISOString() ?? null,
    lastError: settings.lastError,
    ourCount: loads.length,
    syncedCount,
    mismatchedCount,
    missingOnBc,
    extraOnBc,
    percentSynced,
    isFullySynced: missingOnBc === 0 && mismatchedCount === 0,
    mismatches: mismatches.slice(0, 200),
    recentRuns: await listRecentBcSyncRuns(8),
  };
}

export async function fullPushToBc(startedBy?: string) {
  const run = await insertBcSyncRun({
    runType: "full_push",
    status: "running",
    startedBy,
  });
  const loads = (await storage.getAllLoads()).filter(isSyncableLoad);
  let errorCount = 0;
  const errors: Array<{ loadId: string; error: string }> = [];
  for (const load of loads) {
    const result = await pushLoadToBc(load.id);
    if (!result.ok) {
      errorCount += 1;
      errors.push({ loadId: load.id, error: result.error || "push failed" });
    }
  }
  const report = await compareSyncStatus();
  await updateBcSyncRun(run.id, {
    status: errorCount ? "completed_with_errors" : "completed",
    ourCount: report.ourCount,
    syncedCount: report.syncedCount,
    mismatchedCount: report.mismatchedCount,
    missingOnBc: report.missingOnBc,
    extraOnBc: report.extraOnBc,
    errorCount,
    details: { errors: errors.slice(0, 50) },
    finishedAt: new Date(),
  });
  return { runId: run.id, errorCount, report };
}

export async function wipeBcLoadData(startedBy?: string) {
  const run = await insertBcSyncRun({
    runType: "wipe",
    status: "running",
    startedBy,
  });
  const company = await resolveCompanyId();
  const orders = await listTaggedSalesOrders(company.id);
  let errorCount = 0;
  const errors: string[] = [];
  for (const order of orders) {
    try {
      const current = await bc365Client.getSalesOrder(company.id, order.id);
      await bc365Client.deleteSalesOrder(company.id, order.id, current["@odata.etag"] || "*");
    } catch (error) {
      errorCount += 1;
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  await clearBcLoadMaps();
  await updateBcSettings({ lastWipeAt: new Date(), lastError: errorCount ? errors[0] : null });
  await updateBcSyncRun(run.id, {
    status: errorCount ? "completed_with_errors" : "completed",
    extraOnBc: orders.length,
    errorCount,
    details: { deletedAttempted: orders.length, errors: errors.slice(0, 50) },
    finishedAt: new Date(),
  });
  return { deletedAttempted: orders.length, errorCount, errors: errors.slice(0, 20) };
}

export async function pullPaymentStatusFromBc(): Promise<{ updated: number; checked: number }> {
  if (!getBc365Config().enabled) return { updated: 0, checked: 0 };
  const company = await resolveCompanyId();
  const orders = await listTaggedSalesOrders(company.id);
  let updated = 0;
  for (const order of orders) {
    const loadId = loadIdFromExternal(order.externalDocumentNumber);
    if (!loadId) continue;
    const payment = parsePaymentStatus(snapshotFromBcOrder(order).paymentStatus);
    if (!financePaymentStatuses.includes(payment as (typeof financePaymentStatuses)[number])) {
      continue;
    }
    const shipment = await storage.getShipmentByLoad(loadId);
    if (!shipment) continue;
    const review = await storage.getFinanceReviewByShipment(shipment.id);
    if (!review) continue;
    if (review.paymentStatus === payment) continue;
    const { withoutBcPush } = await import("./sync-queue");
    await withoutBcPush(() =>
      storage.updateFinanceReview(review.id, {
        paymentStatus: payment,
        updatedAt: new Date(),
      }),
    );
    updated += 1;
  }
  await updateBcSettings({ lastPullAt: new Date() });
  return { updated, checked: orders.length };
}

export function startBc365PaymentPoller() {
  const ms = Number.parseInt(process.env.BC365_PAYMENT_POLL_MS || "60000", 10);
  if (!Number.isFinite(ms) || ms <= 0) return;
  if (!getBc365Config().enabled) return;
  setInterval(() => {
    pullPaymentStatusFromBc().catch((error) => {
      console.error("[bc365] payment pull failed", error);
    });
  }, ms);
}
