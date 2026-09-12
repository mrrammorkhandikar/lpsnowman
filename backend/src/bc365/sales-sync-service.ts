import { storage } from "../storage";
import type { Invoice, Load, User } from "@shared/schema";
import { bcSalesCompanyName, bcSalesCustomerNumber, bcSalesItemNumber, getBcSalesConfig } from "./config";
import {
  Bc365Error,
  bc365SalesClient,
  explainBc365Error,
  type BcCompany,
  type BcSalesInvoice,
  type BcSalesOrder,
} from "./client";
import {
  documentAmount,
  freightLineBody,
  loadOrderExternalNumber,
  memoInvoiceExternalNumber,
  odataEq,
  salesInvoiceBody,
  salesOrderBody,
  shipperDisplayName,
} from "./sales-mapper";
import { getAllBcSalesMaps, getBcSalesMap, upsertBcSalesMap } from "./sales-store";

function stripUndefined(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined && value !== ""),
  );
}

async function resolveSalesCompany(): Promise<{ id: string; name: string }> {
  const config = getBcSalesConfig();
  const companies = await bc365SalesClient.listCompanies();
  if (!companies.length) {
    throw new Bc365Error(
      `No companies were returned for Business Central environment "${config.environment}"`,
    );
  }
  const wanted = bcSalesCompanyName();
  const label = (c: BcCompany) => `${c.name} ${c.displayName || ""}`;
  const preferred =
    companies.find((c) => c.id === config.companyId) ||
    companies.find((c) => new RegExp(wanted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(label(c))) ||
    companies.find((c) => /snowman/i.test(label(c)));
  if (!preferred) {
    throw new Bc365Error(
      `Company "${wanted}" was not found in ${config.environment}. Available: ${companies.map((c) => c.displayName || c.name).join(", ")}`,
    );
  }
  return { id: preferred.id, name: preferred.displayName || preferred.name };
}

type PostingTemplate = {
  genBusPostingGroup: string;
  customerPostingGroup: string;
  vatBusPostingGroup?: string;
  genProdPostingGroup?: string;
  vatProdPostingGroup?: string;
  inventoryPostingGroup?: string;
};

async function resolvePostingTemplate(): Promise<PostingTemplate | null> {
  const envBus = (process.env.BC_SALES_GEN_BUS_POSTING_GROUP || "").trim();
  const envCust = (process.env.BC_SALES_CUSTOMER_POSTING_GROUP || "").trim();
  if (envBus && envCust) {
    return {
      genBusPostingGroup: envBus,
      customerPostingGroup: envCust,
      vatBusPostingGroup: (process.env.BC_SALES_VAT_BUS_POSTING_GROUP || "").trim() || undefined,
      genProdPostingGroup: (process.env.BC_SALES_GEN_PROD_POSTING_GROUP || "").trim() || undefined,
      vatProdPostingGroup: (process.env.BC_SALES_VAT_PROD_POSTING_GROUP || "").trim() || undefined,
    };
  }
  const companies = await bc365SalesClient.listCompanies();
  const cronus = companies.find((c) => /cronus/i.test(`${c.name} ${c.displayName || ""}`));
  if (!cronus) return null;
  const name = cronus.displayName || cronus.name;
  const [customers, items] = await Promise.all([
    bc365SalesClient.listWorkflowCustomers(name).catch(() => []),
    bc365SalesClient.listWorkflowItems(name).catch(() => []),
  ]);
  const customer = customers.find((c) => (c.genBusPostingGroup || "").trim());
  const item = items.find((i) => (i.genProdPostingGroup || "").trim());
  if (!customer?.genBusPostingGroup || !customer.customerPostingGroup) return null;
  return {
    genBusPostingGroup: customer.genBusPostingGroup,
    customerPostingGroup: customer.customerPostingGroup,
    vatBusPostingGroup: customer.vatBusPostingGroup || undefined,
    genProdPostingGroup: item?.genProdPostingGroup || undefined,
    vatProdPostingGroup: item?.vatProdPostingGroup || undefined,
    inventoryPostingGroup: item?.inventoryPostingGroup || undefined,
  };
}

type LineRef = { lineType: string; lineObjectNumber: string };

type SalesPushContext = {
  companyId: string;
  companyName: string;
  line: LineRef;
  country: string | null;
  posting: PostingTemplate | null;
  customers: Map<string, { id: string; number: string }>;
};

async function resolveCountryCode(companyId: string): Promise<string | null> {
  try {
    const fromCustomer = await bc365SalesClient.listCustomers(companyId);
    const existingCountry = (fromCustomer as Array<{ country?: string }>).find((c) => c.country)?.country;
    if (existingCountry) return existingCountry;
    const countries = await bc365SalesClient.listCountriesRegions(companyId);
    const match = countries.find((c) => {
      const code = (c.code || "").trim().toUpperCase();
      const name = (c.displayName || "").trim().toLowerCase();
      return code === "IN" || code === "IND" || name === "india" || name.includes("india");
    });
    if (match?.code) return match.code;
  } catch {
    // If the countries API is missing, omit the field rather than send IN.
  }
  return null;
}

async function resolveLineRef(
  companyId: string,
  companyName: string,
  posting: PostingTemplate | null,
): Promise<LineRef> {
  const wanted = bcSalesItemNumber();
  const named = await bc365SalesClient.listItems(companyId, odataEq("number", wanted));
  if (named[0]?.number) return { lineType: "Item", lineObjectNumber: named[0].number };

  const anyItems = await bc365SalesClient.listItems(companyId);
  if (anyItems[0]?.number) return { lineType: "Item", lineObjectNumber: anyItems[0].number };

  try {
    const item = await bc365SalesClient.createItem(companyId, {
      number: wanted,
      displayName: "LoadPilot Freight",
      type: "Service",
    });
    if (item.id && posting?.genProdPostingGroup) {
      await bc365SalesClient.patchWorkflowItem(
        companyName,
        item.id,
        stripUndefined({
          genProdPostingGroup: posting.genProdPostingGroup,
          vatProdPostingGroup: posting.vatProdPostingGroup,
        }),
      ).catch(() => undefined);
    }
    return { lineType: "Item", lineObjectNumber: item.number || wanted };
  } catch {
    // Fall through
  }

  const accounts = await bc365SalesClient.listAccounts(companyId);
  const account = accounts.find((a) => a.number) || accounts[0];
  if (account?.number) return { lineType: "Account", lineObjectNumber: account.number };

  return { lineType: "Comment", lineObjectNumber: "" };
}

function customerRef(
  row?: { id?: string; number?: string } | null,
): { id: string; number: string } | null {
  if (!row?.id || !row.number) return null;
  return { id: row.id, number: row.number };
}

function namesMatch(left: string, right: string): boolean {
  const a = left.trim().toLowerCase().replace(/\s+/g, " ");
  const b = right.trim().toLowerCase().replace(/\s+/g, " ");
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

async function applyCustomerPosting(
  companyName: string,
  customerId: string,
  posting: PostingTemplate | null,
): Promise<void> {
  if (!posting) return;
  const workflow = await bc365SalesClient.listWorkflowCustomers(companyName);
  const row = workflow.find((c) => c.id === customerId);
  if (!row) return;
  if ((row.genBusPostingGroup || "").trim() && (row.customerPostingGroup || "").trim()) return;
  await bc365SalesClient.patchWorkflowCustomer(
    companyName,
    row.id,
    stripUndefined({
      genBusPostingGroup: posting.genBusPostingGroup,
      customerPostingGroup: posting.customerPostingGroup,
      vatBusPostingGroup: posting.vatBusPostingGroup,
    }),
    row["@odata.etag"],
  );
}

async function ensureCustomer(
  ctx: SalesPushContext,
  load: Load,
  shipper?: User | null,
): Promise<{ id: string; number: string }> {
  const cached = ctx.customers.get(load.shipperId);
  if (cached) return cached;

  const displayName = shipperDisplayName(load, shipper);
  const pinned = bcSalesCustomerNumber() || "LOADPILOT";
  const existing = await bc365SalesClient.listCustomers(ctx.companyId);

  const chosen =
    customerRef(existing.find((c) => c.number === pinned)) ||
    customerRef(existing.find((c) => namesMatch(c.displayName || "", "LoadPilot"))) ||
    customerRef(existing.find((c) => namesMatch(c.displayName || "", displayName))) ||
    customerRef(existing.find((c) => c.number && !c.number.toUpperCase().startsWith("LP"))) ||
    customerRef(existing[0]);

  if (!chosen) {
    throw new Error(
      `No customer exists in ${ctx.companyName}. Create customer LOADPILOT in SnowmanTest, then push again.`,
    );
  }

  try {
    await applyCustomerPosting(ctx.companyName, chosen.id, ctx.posting);
  } catch (error) {
    throw new Error(
      `Could not set posting groups on customer ${chosen.number} in ${ctx.companyName}. ${
        error instanceof Error ? error.message : String(error)
      } In BC, open Gen. Business Posting Groups and Customer Posting Groups, then set those fields on the LOADPILOT customer card.`,
    );
  }

  ctx.customers.set(load.shipperId, chosen);
  return chosen;
}

async function createPushContext(): Promise<SalesPushContext> {
  const company = await resolveSalesCompany();
  const posting = await resolvePostingTemplate();
  const [line, country] = await Promise.all([
    resolveLineRef(company.id, company.name, posting),
    resolveCountryCode(company.id),
  ]);
  return {
    companyId: company.id,
    companyName: company.name,
    line,
    country,
    posting,
    customers: new Map(),
  };
}

async function findOrder(
  companyId: string,
  load: Load,
  mappedId?: string | null,
): Promise<BcSalesOrder | null> {
  if (mappedId) {
    try {
      return await bc365SalesClient.getSalesOrder(companyId, mappedId);
    } catch {
      // fall through to external number lookup
    }
  }
  const ext = loadOrderExternalNumber(load);
  const found = await bc365SalesClient.listSalesOrders(companyId, odataEq("externalDocumentNumber", ext));
  return found[0] || null;
}

async function upsertOrderLine(
  companyId: string,
  orderId: string,
  line: LineRef,
  load: Load,
  amount: number,
) {
  const lines = await bc365SalesClient.listSalesOrderLines(companyId, orderId);
  const body = stripUndefined(freightLineBody(line.lineType, line.lineObjectNumber, load, amount));
  const existing = lines[0];
  if (existing?.id) {
    const { lineType: _t, lineObjectNumber: _n, ...patch } = body;
    await bc365SalesClient.updateSalesOrderLine(
      companyId,
      orderId,
      existing.id,
      patch,
      existing["@odata.etag"] || "*",
    );
    return;
  }
  await bc365SalesClient.createSalesOrderLine(companyId, orderId, body);
}

async function upsertInvoiceLine(
  companyId: string,
  invoiceId: string,
  line: LineRef,
  load: Load,
  amount: number,
) {
  const lines = await bc365SalesClient.listSalesInvoiceLines(companyId, invoiceId);
  const body = stripUndefined(freightLineBody(line.lineType, line.lineObjectNumber, load, amount));
  const existing = lines[0];
  if (existing?.id) {
    const { lineType: _t, lineObjectNumber: _n, ...patch } = body;
    await bc365SalesClient.updateSalesInvoiceLine(
      companyId,
      invoiceId,
      existing.id,
      patch,
      existing["@odata.etag"] || "*",
    );
    return;
  }
  await bc365SalesClient.createSalesInvoiceLine(companyId, invoiceId, body);
}

async function findInvoice(
  companyId: string,
  load: Load,
  invoice: Invoice,
  mappedId?: string | null,
): Promise<BcSalesInvoice | null> {
  if (mappedId) {
    try {
      const listed = await bc365SalesClient.listSalesInvoices(companyId, odataEq("id", mappedId));
      if (listed[0]) return listed[0];
    } catch {
      // ignore
    }
  }
  const ext = memoInvoiceExternalNumber(invoice, load);
  const found = await bc365SalesClient.listSalesInvoices(
    companyId,
    odataEq("externalDocumentNumber", ext),
  );
  return found[0] || null;
}

export async function getSalesConnectionPreview() {
  const config = getBcSalesConfig();
  if (!config.enabled) {
    return {
      configured: false,
      connected: false,
      environment: config.environment,
      companies: [] as Array<{ id: string; name: string }>,
      error: "Missing BC env vars",
    };
  }
  try {
    await bc365SalesClient.pingToken();
    const companies = await bc365SalesClient.listCompanies();
    const company = await resolveSalesCompany();
    return {
      configured: true,
      connected: true,
      environment: bc365SalesClient.config.environment,
      companyId: company.id,
      companyName: company.name,
      companies: companies.map((c) => ({ id: c.id, name: c.displayName || c.name })),
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      environment: config.environment,
      companies: [] as Array<{ id: string; name: string }>,
      error: explainBc365Error(error),
    };
  }
}

export async function pushLoadAsSalesDocument(
  loadId: string,
  ctx?: SalesPushContext,
): Promise<{
  ok: boolean;
  error?: string;
  orderNumber?: string | null;
  invoiceNumber?: string | null;
}> {
  const config = getBcSalesConfig();
  if (!config.enabled) {
    return { ok: false, error: "BC 365 is not configured" };
  }
  const load = await storage.getLoad(loadId);
  if (!load || load.isTemplate === true) {
    return { ok: true };
  }
  try {
    const [shipper, invoice] = await Promise.all([
      storage.getUser(load.shipperId),
      storage.getInvoiceByLoad(load.id),
    ]);
    const pushCtx = ctx || (await createPushContext());
    const customer = await ensureCustomer(pushCtx, load, shipper);
    const amount = documentAmount(load, invoice);
    const existingMap = await getBcSalesMap(load.id);
    let order = await findOrder(pushCtx.companyId, load, existingMap?.bcOrderId);

    if (!order) {
      const full = stripUndefined(salesOrderBody(load, customer.number, pushCtx.country));
      try {
        order = await bc365SalesClient.createSalesOrder(pushCtx.companyId, full);
      } catch {
        order = await bc365SalesClient.createSalesOrder(pushCtx.companyId, {
          customerNumber: customer.number,
          externalDocumentNumber: full.externalDocumentNumber,
        });
      }
    } else {
      const etag = order["@odata.etag"] || "*";
      const { customerNumber: _c, ...header } = stripUndefined(salesOrderBody(load, customer.number, pushCtx.country));
      try {
        await bc365SalesClient.updateSalesOrder(pushCtx.companyId, order.id, header, etag);
      } catch {
        // Header already exists; unknown properties must not block a SnowmanTest push.
      }
      order = (await findOrder(pushCtx.companyId, load, order.id)) || order;
    }
    try {
      await upsertOrderLine(pushCtx.companyId, order.id, pushCtx.line, load, amount);
    } catch {
      // Keep the sales order even if SnowmanTest has no item/account to put on the line.
    }

    let bcInvoice: BcSalesInvoice | null = null;
    if (invoice) {
      bcInvoice = await findInvoice(pushCtx.companyId, load, invoice, existingMap?.bcInvoiceId);
      if (!bcInvoice) {
        try {
          bcInvoice = await bc365SalesClient.createSalesInvoice(
            pushCtx.companyId,
            stripUndefined(salesInvoiceBody(load, invoice, customer.number, pushCtx.country)),
          );
        } catch {
          bcInvoice = await bc365SalesClient.createSalesInvoice(pushCtx.companyId, {
            customerNumber: customer.number,
            externalDocumentNumber: memoInvoiceExternalNumber(invoice, load),
          });
        }
      }
      try {
        await upsertInvoiceLine(pushCtx.companyId, bcInvoice.id, pushCtx.line, load, amount);
      } catch {
        // Keep the sales invoice header in SnowmanTest.
      }
    }

    await upsertBcSalesMap({
      loadId,
      bcCustomerId: customer.id,
      bcCustomerNumber: customer.number,
      bcOrderId: order.id,
      bcOrderNumber: order.number || null,
      bcInvoiceId: bcInvoice?.id || null,
      bcInvoiceNumber: bcInvoice?.number || null,
      memoId: invoice?.id || null,
      lastError: null,
    });
    return {
      ok: true,
      orderNumber: order.number || null,
      invoiceNumber: bcInvoice?.number || null,
    };
  } catch (error) {
    const message = explainBc365Error(error);
    console.error("[bc365-sales] push failed", loadId, message);
    await upsertBcSalesMap({ loadId, lastError: message }).catch(() => undefined);
    return { ok: false, error: message };
  }
}

export async function fullPushSalesDocuments() {
  const loads = (await storage.getAllLoads()).filter((load) => load.isTemplate !== true);
  const errors: Array<{ loadId: string; error: string }> = [];
  let pushed = 0;
  let invoices = 0;
  const ctx = await createPushContext();
  for (const load of loads) {
    const result = await pushLoadAsSalesDocument(load.id, ctx);
    if (!result.ok) {
      errors.push({ loadId: load.id, error: result.error || "push failed" });
    } else {
      pushed += 1;
      if (result.invoiceNumber) invoices += 1;
    }
  }
  const status = await getSalesSyncStatus();
  return { pushed, invoiceCount: invoices, errorCount: errors.length, errors: errors.slice(0, 50), status };
}

export async function getSalesSyncStatus() {
  const preview = await getSalesConnectionPreview();
  const loads = (await storage.getAllLoads()).filter((load) => load.isTemplate !== true);
  const maps = await getAllBcSalesMaps();
  const invoices = await storage.getAllInvoices();
  const invoiceByLoad = new Map<string, (typeof invoices)[number]>();
  for (const invoice of invoices) {
    if (!invoiceByLoad.has(invoice.loadId)) invoiceByLoad.set(invoice.loadId, invoice);
  }
  const byLoad = new Map(maps.map((m) => [m.loadId, m]));
  const rows = [];
  for (const load of loads) {
    const map = byLoad.get(load.id);
    const invoice = invoiceByLoad.get(load.id);
    rows.push({
      loadId: load.id,
      loadNumber: loadOrderExternalNumber(load),
      shipperName: load.shipperCompanyName || load.shipperContactName || "",
      route: `${load.pickupCity || "—"} → ${load.dropoffCity || "—"}`,
      amount: documentAmount(load, invoice),
      hasMemo: Boolean(invoice),
      bcCustomerNumber: map?.bcCustomerNumber || null,
      bcOrderNumber: map?.bcOrderNumber || null,
      bcInvoiceNumber: map?.bcInvoiceNumber || null,
      lastError: map?.lastError || null,
      lastPushedAt: map?.lastPushedAt?.toISOString() || null,
    });
  }
  return {
    ...preview,
    ourCount: loads.length,
    orderCount: maps.filter((m) => m.bcOrderId).length,
    invoiceCount: maps.filter((m) => m.bcInvoiceId).length,
    errorCount: maps.filter((m) => m.lastError).length,
    rows,
  };
}
