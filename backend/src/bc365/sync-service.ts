import { storage } from "../storage";
import { financePaymentStatuses, type Load } from "@shared/schema";
import { getBc365Config } from "./config";
import { bc365Client, Bc365Error, explainBc365Error, type BcLoadRecord } from "./client";
import {
  buildSnapshot,
  diffSnapshots,
  normalizeLoadId,
  parsePaymentStatus,
  snapshotFromBcLoad,
  snapshotHash,
  toLoadBody,
  type LoadPilotSnapshot,
} from "./mapper";
import {
  clearBcLoadMaps,
  deleteBcLoadMap,
  getAllBcLoadMaps,
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
  const companies = await bc365Client.listCompanies();
  if (!companies.length) {
    throw new Bc365Error("No Business Central companies were returned for this environment");
  }
  const pick = (id?: string | null) => companies.find((c) => c.id === id);
  const preferredConfigured = pick(config.companyId);
  const preferredSaved = pick(settings.companyId);
  const label = (c: { name: string; displayName?: string }) =>
    `${c.name} ${c.displayName || ""}`;
  const preferred =
    preferredConfigured ||
    preferredSaved ||
    companies.find((c) => /snowman|loadpilot|smartserve/i.test(label(c))) ||
    companies.find((c) => !/cronus/i.test(label(c))) ||
    companies[0];
  const name = preferred.displayName || preferred.name;
  if (settings.companyId !== preferred.id) {
    await updateBcSettings({ companyId: preferred.id, companyName: name });
  }
  return { id: preferred.id, name };
}

function stripUndefined(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined && value !== ""),
  );
}

async function createOrUpdateLoad(
  companyId: string,
  snapshot: LoadPilotSnapshot,
): Promise<BcLoadRecord> {
  const body = stripUndefined(toLoadBody(snapshot));
  const bcKey = snapshot.loadId.trim().toUpperCase();
  const map = await getBcLoadMap(snapshot.loadId);
  const tryUpdate = async (loadId: string) => {
    const current = await bc365Client.getLoad(companyId, loadId);
    const etag = current["@odata.etag"] || "*";
    const { loadId: _key, ...patch } = body;
    await bc365Client.updateLoad(companyId, loadId, patch, etag);
    return (await bc365Client.getLoad(companyId, loadId)) || current;
  };

  if (map?.bcOrderId) {
    try {
      return await tryUpdate(bcKey);
    } catch (error) {
      if (!(error instanceof Bc365Error) || (error.status !== 404 && error.status !== 400)) {
        throw error;
      }
      await deleteBcLoadMap(snapshot.loadId);
    }
  }

  const existing = await bc365Client.listLoads(
    companyId,
    `loadId eq '${bcKey.replace(/'/g, "''")}'`,
  );
  if (existing[0]?.loadId) {
    return tryUpdate(existing[0].loadId);
  }

  return bc365Client.createLoad(companyId, body);
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
    const snapshot = await buildLoadSnapshot(load);
    const record = await createOrUpdateLoad(company.id, snapshot);
    await upsertBcLoadMap({
      loadId,
      bcOrderId: record.loadId || snapshot.loadId,
      bcOrderNumber: record.loadNumber || snapshot.loadNumber,
      payloadHash: snapshotHash(snapshot),
      lastError: null,
    });
    await updateBcSettings({ lastPushAt: new Date(), lastError: null });
    return { ok: true };
  } catch (error) {
    const message = explainBc365Error(error);
    const existing = await getBcLoadMap(loadId);
    await upsertBcLoadMap({
      loadId,
      bcOrderId: existing?.bcOrderId || loadId,
      lastError: message,
    }).catch(() => undefined);
    await updateBcSettings({ lastError: message });
    console.error("[bc365] push failed", loadId, message);
    return { ok: false, error: message };
  }
}

export async function listBcLoads(companyId: string): Promise<BcLoadRecord[]> {
  return bc365Client.listLoads(companyId);
}

export type SyncMismatch = {
  loadId: string;
  loadNumber: string;
  fields: string[];
  source: "mismatch" | "missing_on_bc" | "extra_on_bc";
  paymentStatusOurs?: string;
  paymentStatusBc?: string;
  lastError?: string;
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
    const company =
      companies.find((c) => /snowman|loadpilot|smartserve/i.test(`${c.name} ${c.displayName || ""}`)) ||
      companies.find((c) => !/cronus/i.test(`${c.name} ${c.displayName || ""}`)) ||
      companies[0];
    if (company) {
      await bc365Client.pingLoadsApi(company.id);
    }
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
  const [bcLoads, maps] = await Promise.all([listBcLoads(company.id), getAllBcLoadMaps()]);
  const errorByLoadId = new Map(
    maps.map((m) => [normalizeLoadId(m.loadId), m.lastError || ""]),
  );
  const bcByLoadId = new Map<string, BcLoadRecord>();
  const extra: SyncMismatch[] = [];
  for (const record of bcLoads) {
    const loadId = normalizeLoadId(record.loadId);
    if (loadId) {
      bcByLoadId.set(loadId, record);
    } else {
      extra.push({
        loadId: record.id || "unknown",
        loadNumber: record.loadNumber || record.id || "unknown",
        fields: ["unmapped"],
        source: "extra_on_bc",
        paymentStatusBc: snapshotFromBcLoad(record).paymentStatus,
      });
    }
  }

  const mismatches: SyncMismatch[] = [...extra];
  let syncedCount = 0;
  let mismatchedCount = 0;
  let missingOnBc = 0;

  for (const load of loads) {
    const snapshot = await buildLoadSnapshot(load);
    const record = bcByLoadId.get(normalizeLoadId(load.id));
    if (!record) {
      missingOnBc += 1;
      mismatches.push({
        loadId: load.id,
        loadNumber: snapshot.loadNumber,
        fields: ["missing"],
        source: "missing_on_bc",
        paymentStatusOurs: snapshot.paymentStatus,
        lastError: errorByLoadId.get(normalizeLoadId(load.id)) || undefined,
      });
      continue;
    }
    bcByLoadId.delete(normalizeLoadId(load.id));
    const bcSnap = snapshotFromBcLoad(record);
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
        lastError: errorByLoadId.get(normalizeLoadId(load.id)) || undefined,
      });
    }
  }

  for (const [loadId, record] of bcByLoadId) {
    extra.push({
      loadId,
      loadNumber: record.loadNumber || loadId,
      fields: ["unknown_load"],
      source: "extra_on_bc",
      paymentStatusBc: snapshotFromBcLoad(record).paymentStatus,
    });
    mismatches.push(extra[extra.length - 1]);
  }

  const extraOnBc = mismatches.filter((m) => m.source === "extra_on_bc").length;
  const percentSynced = loads.length === 0 ? 100 : Math.round((syncedCount / loads.length) * 100);
  const latestSettings = await getBcSettings();
  const lastError = missingOnBc === 0 ? null : latestSettings.lastError;
  if (missingOnBc === 0 && latestSettings.lastError) {
    await updateBcSettings({ lastError: null });
  }

  return {
    configured: true,
    connected: true,
    environment: preview.environment,
    companyId: company.id,
    companyName: company.name,
    customerNumber: null,
    lastPushAt: latestSettings.lastPushAt?.toISOString() ?? null,
    lastPullAt: latestSettings.lastPullAt?.toISOString() ?? null,
    lastWipeAt: latestSettings.lastWipeAt?.toISOString() ?? null,
    lastError,
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
  const records = await listBcLoads(company.id);
  let errorCount = 0;
  const errors: string[] = [];
  for (const record of records) {
    const key = record.loadId;
    if (!key) continue;
    try {
      const current = await bc365Client.getLoad(company.id, key);
      await bc365Client.deleteLoad(company.id, key, current["@odata.etag"] || "*");
    } catch (error) {
      errorCount += 1;
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  await clearBcLoadMaps();
  await updateBcSettings({ lastWipeAt: new Date(), lastError: errorCount ? errors[0] : null });
  await updateBcSyncRun(run.id, {
    status: errorCount ? "completed_with_errors" : "completed",
    extraOnBc: records.length,
    errorCount,
    details: { deletedAttempted: records.length, errors: errors.slice(0, 50) },
    finishedAt: new Date(),
  });
  return { deletedAttempted: records.length, errorCount, errors: errors.slice(0, 20) };
}

export async function pullPaymentStatusFromBc(): Promise<{ updated: number; checked: number }> {
  if (!getBc365Config().enabled) return { updated: 0, checked: 0 };
  const company = await resolveCompanyId();
  const records = await listBcLoads(company.id);
  let updated = 0;
  for (const record of records) {
    const loadId = normalizeLoadId(record.loadId);
    if (!loadId) continue;
    const payment = parsePaymentStatus(snapshotFromBcLoad(record).paymentStatus);
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
  return { updated, checked: records.length };
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
