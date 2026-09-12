import { bcApiRoot, bcLoadsApiRoot, getBc365Config, getBcSalesConfig, type Bc365Config } from "./config";

type TokenState = {
  accessToken: string;
  expiresAt: number;
};

export class Bc365Error extends Error {
  status?: number;
  payload?: unknown;
  constructor(message: string, status?: number, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export type BcCompany = {
  id: string;
  name: string;
  displayName?: string;
};

export type BcLoadRecord = {
  id?: string;
  loadId?: string;
  loadNumber?: string | null;
  shipperId?: string | null;
  shipperName?: string | null;
  pickupAddress?: string | null;
  pickupCity?: string | null;
  pickupState?: string | null;
  pickupPincode?: string | null;
  dropoffAddress?: string | null;
  dropoffCity?: string | null;
  dropoffState?: string | null;
  dropoffPincode?: string | null;
  loadStatus?: string | null;
  tripType?: string | null;
  driverName?: string | null;
  paymentStatus?: string | null;
  price?: number | string | null;
  pickupDate?: string | null;
  deliveryDate?: string | null;
  lastModifiedDateTime?: string;
  "@odata.etag"?: string;
};

export type BcSalesOrder = {
  id: string;
  number?: string;
  externalDocumentNumber?: string | null;
  yourReference?: string | null;
  customerNumber?: string | null;
  customerName?: string | null;
  orderDate?: string | null;
  requestedDeliveryDate?: string | null;
  phoneNumber?: string | null;
  shipToName?: string | null;
  shipToContact?: string | null;
  shipToAddressLine1?: string | null;
  shipToAddressLine2?: string | null;
  shipToCity?: string | null;
  shipToState?: string | null;
  shipToPostCode?: string | null;
  shipToCountry?: string | null;
  sellToAddressLine1?: string | null;
  sellToAddressLine2?: string | null;
  sellToCity?: string | null;
  sellToState?: string | null;
  sellToPostCode?: string | null;
  sellToCountry?: string | null;
  lastModifiedDateTime?: string;
  "@odata.etag"?: string;
};

export type BcSalesInvoice = {
  id: string;
  number?: string;
  externalDocumentNumber?: string | null;
  customerNumber?: string | null;
  customerName?: string | null;
  invoiceDate?: string | null;
  "@odata.etag"?: string;
};

export type BcItem = {
  id: string;
  number?: string;
  displayName?: string;
  type?: string;
  "@odata.etag"?: string;
};

export type BcSalesLine = {
  id: string;
  sequence?: number;
  lineType?: string;
  lineObjectNumber?: string | null;
  description?: string | null;
  quantity?: number;
  unitPrice?: number;
  "@odata.etag"?: string;
};

export type BcWorkflowCustomer = {
  id: string;
  number?: string;
  name?: string;
  genBusPostingGroup?: string;
  customerPostingGroup?: string;
  vatBusPostingGroup?: string;
  "@odata.etag"?: string;
};

export type BcWorkflowItem = {
  id: string;
  number?: string;
  genProdPostingGroup?: string;
  vatProdPostingGroup?: string;
  inventoryPostingGroup?: string;
  "@odata.etag"?: string;
};

export class Bc365Client {
  private token: TokenState | null = null;
  readonly config: Bc365Config;

  constructor(config = getBc365Config()) {
    this.config = config;
  }

  isConfigured(): boolean {
    return this.config.enabled;
  }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - 30_000) {
      return this.token.accessToken;
    }
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: this.config.scope,
    });
    const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.access_token) {
      throw new Bc365Error(
        `BC 365 token request failed (${res.status})`,
        res.status,
        payload,
      );
    }
    const expiresIn = Number(payload.expires_in || 3600);
    this.token = {
      accessToken: payload.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    return this.token.accessToken;
  }

  async pingToken(): Promise<void> {
    await this.getToken();
  }

  async request<T>(
    method: string,
    urlOrPath: string,
    options: { body?: unknown; etag?: string; absolute?: boolean; timeoutMs?: number } = {},
  ): Promise<T> {
    const token = await this.getToken();
    const url = options.absolute || urlOrPath.startsWith("http")
      ? urlOrPath
      : `${bcApiRoot(this.config)}${urlOrPath.startsWith("/") ? urlOrPath : `/${urlOrPath}`}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (options.etag) {
      headers["If-Match"] = options.etag;
    }
    const timeoutMs = options.timeoutMs ?? 25_000;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        throw new Bc365Error(`BC 365 ${method} timed out after ${timeoutMs}ms: ${url}`, 408);
      }
      throw error;
    }
    if (res.status === 204) {
      return undefined as T;
    }
    const text = await res.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    if (!res.ok) {
      throw new Bc365Error(formatBcErrorPayload(payload, method, url, res.status), res.status, payload);
    }
    return payload as T;
  }

  isMissingEnvironment(error: unknown): boolean {
    if (!(error instanceof Bc365Error)) return false;
    const raw = `${error.message} ${JSON.stringify(error.payload || "")}`;
    return /NoEnvironment/i.test(raw);
  }

  async listEnvironments(): Promise<Array<{ name: string; type?: string }>> {
    const data = await this.request<{
      value?: Array<{ name?: string; environmentName?: string; type?: string }>;
    }>("GET", "https://api.businesscentral.dynamics.com/environments/v1.1", {
      absolute: true,
    });
    return (data.value || [])
      .map((item) => ({
        name: item.environmentName || item.name || "",
        type: item.type,
      }))
      .filter((item) => item.name);
  }

  async ensureEnvironment(): Promise<string> {
    const configuredName = this.config.environment;
    const tryName = async (name: string) => {
      const previous = this.config.environment;
      this.config.environment = name;
      try {
        await this.request<ODataList<BcCompany>>("GET", "/companies");
        return true;
      } catch (error) {
        this.config.environment = previous;
        if (!this.isMissingEnvironment(error)) throw error;
        return false;
      }
    };

    if (await tryName(configuredName)) {
      return this.config.environment;
    }

    let discovered: Array<{ name: string; type?: string }> = [];
    try {
      discovered = await this.listEnvironments();
    } catch {
      discovered = [];
    }
    const preferred =
      discovered.find((e) => /sandbox/i.test(`${e.name} ${e.type || ""}`)) ||
      discovered[0];
    const candidates = [
      preferred?.name,
      ...discovered.map((e) => e.name),
    ].filter((name, index, all): name is string => Boolean(name) && all.indexOf(name) === index && name !== configuredName);

    for (const name of candidates) {
      if (await tryName(name)) return this.config.environment;
    }

    const discoveredNames = discovered.map((e) => e.name).join(", ") || "none (admin environments API not granted)";
    throw new Bc365Error(
      `Business Central environment "${configuredName}" does not exist on this tenant. Discovered environments: ${discoveredNames}. Copy the name from the BC URL: businesscentral.dynamics.com/{tenantId}/{environmentName}`,
    );
  }

  async listCompanies(): Promise<BcCompany[]> {
    await this.ensureEnvironment();
    const data = await this.request<ODataList<BcCompany>>("GET", "/companies");
    return data.value || [];
  }

  companyPath(companyId: string, suffix: string): string {
    const clean = suffix.startsWith("/") ? suffix : `/${suffix}`;
    return `/companies(${companyId})${clean}`;
  }

  private odataCompanyUrl(companyName: string, entityAndQuery: string): string {
    const root = bcApiRoot(this.config).replace(/\/api\/v2\.0$/, "");
    const name = companyName.replace(/'/g, "''");
    const suffix = entityAndQuery.startsWith("/") ? entityAndQuery.slice(1) : entityAndQuery;
    return `${root}/ODataV4/Company('${name}')/${suffix}`;
  }

  async listWorkflowCustomers(companyName: string): Promise<BcWorkflowCustomer[]> {
    const qs = new URLSearchParams();
    qs.set("$top", "200");
    const data = await this.request<ODataList<BcWorkflowCustomer>>(
      "GET",
      this.odataCompanyUrl(companyName, `workflowCustomers?${qs.toString()}`),
      { absolute: true },
    );
    return data.value || [];
  }

  async patchWorkflowCustomer(
    companyName: string,
    id: string,
    body: Record<string, unknown>,
    etag?: string,
  ): Promise<BcWorkflowCustomer | void> {
    return this.request<BcWorkflowCustomer | void>(
      "PATCH",
      this.odataCompanyUrl(companyName, `workflowCustomers(${id})`),
      { body, etag: etag || "*", absolute: true },
    );
  }

  async listWorkflowItems(companyName: string): Promise<BcWorkflowItem[]> {
    const qs = new URLSearchParams();
    qs.set("$top", "50");
    const data = await this.request<ODataList<BcWorkflowItem>>(
      "GET",
      this.odataCompanyUrl(companyName, `workflowItems?${qs.toString()}`),
      { absolute: true },
    );
    return data.value || [];
  }

  async patchWorkflowItem(
    companyName: string,
    id: string,
    body: Record<string, unknown>,
    etag?: string,
  ): Promise<BcWorkflowItem | void> {
    return this.request<BcWorkflowItem | void>(
      "PATCH",
      this.odataCompanyUrl(companyName, `workflowItems(${id})`),
      { body, etag: etag || "*", absolute: true },
    );
  }

  private loadCollectionUrl(companyId: string): string {
    return `${bcLoadsApiRoot(this.config)}/companies(${companyId})/loads`;
  }

  private loadItemUrl(companyId: string, loadId: string): string {
    const key = loadId.replace(/'/g, "''");
    return `${this.loadCollectionUrl(companyId)}('${key}')`;
  }

  async pingLoadsApi(companyId: string): Promise<void> {
    const qs = new URLSearchParams({ $top: "1" });
    await this.request<ODataList<BcLoadRecord>>(
      "GET",
      `${this.loadCollectionUrl(companyId)}?${qs.toString()}`,
      { absolute: true },
    );
  }

  async listLoads(companyId: string, filter?: string): Promise<BcLoadRecord[]> {
    const qs = new URLSearchParams();
    qs.set("$top", "2000");
    if (filter) qs.set("$filter", filter);
    const data = await this.request<ODataList<BcLoadRecord>>(
      "GET",
      `${this.loadCollectionUrl(companyId)}?${qs.toString()}`,
      { absolute: true },
    );
    return data.value || [];
  }

  async getLoad(companyId: string, loadId: string): Promise<BcLoadRecord> {
    return this.request<BcLoadRecord>("GET", this.loadItemUrl(companyId, loadId), {
      absolute: true,
    });
  }

  async createLoad(companyId: string, body: Record<string, unknown>): Promise<BcLoadRecord> {
    return this.request<BcLoadRecord>("POST", this.loadCollectionUrl(companyId), {
      body,
      absolute: true,
    });
  }

  async updateLoad(
    companyId: string,
    loadId: string,
    body: Record<string, unknown>,
    etag: string,
  ): Promise<BcLoadRecord | void> {
    return this.request<BcLoadRecord | void>("PATCH", this.loadItemUrl(companyId, loadId), {
      body,
      etag,
      absolute: true,
    });
  }

  async deleteLoad(companyId: string, loadId: string, etag?: string): Promise<void> {
    await this.request("DELETE", this.loadItemUrl(companyId, loadId), {
      etag: etag || "*",
      absolute: true,
    });
  }

  async listSalesOrders(
    companyId: string,
    filter?: string,
  ): Promise<BcSalesOrder[]> {
    const qs = new URLSearchParams();
    qs.set("$top", "2000");
    if (filter) qs.set("$filter", filter);
    const data = await this.request<ODataList<BcSalesOrder>>(
      "GET",
      this.companyPath(companyId, `/salesOrders?${qs.toString()}`),
    );
    return data.value || [];
  }

  async getSalesOrder(companyId: string, id: string): Promise<BcSalesOrder> {
    return this.request<BcSalesOrder>(
      "GET",
      this.companyPath(companyId, `/salesOrders(${id})`),
    );
  }

  async createSalesOrder(
    companyId: string,
    body: Record<string, unknown>,
  ): Promise<BcSalesOrder> {
    return this.request<BcSalesOrder>(
      "POST",
      this.companyPath(companyId, "/salesOrders"),
      { body },
    );
  }

  async updateSalesOrder(
    companyId: string,
    id: string,
    body: Record<string, unknown>,
    etag: string,
  ): Promise<BcSalesOrder | void> {
    return this.request<BcSalesOrder | void>(
      "PATCH",
      this.companyPath(companyId, `/salesOrders(${id})`),
      { body, etag },
    );
  }

  async deleteSalesOrder(companyId: string, id: string, etag?: string): Promise<void> {
    await this.request(
      "DELETE",
      this.companyPath(companyId, `/salesOrders(${id})`),
      { etag: etag || "*" },
    );
  }

  async listCountriesRegions(
    companyId: string,
  ): Promise<Array<{ id: string; code?: string; displayName?: string }>> {
    const qs = new URLSearchParams();
    qs.set("$top", "300");
    const data = await this.request<ODataList<{ id: string; code?: string; displayName?: string }>>(
      "GET",
      this.companyPath(companyId, `/countriesRegions?${qs.toString()}`),
    );
    return data.value || [];
  }

  async listCustomers(
    companyId: string,
    filter?: string,
  ): Promise<Array<{ id: string; number: string; displayName: string }>> {
    const qs = new URLSearchParams();
    qs.set("$top", "200");
    if (filter) qs.set("$filter", filter);
    const data = await this.request<ODataList<{ id: string; number: string; displayName: string }>>(
      "GET",
      this.companyPath(companyId, `/customers?${qs.toString()}`),
    );
    return data.value || [];
  }

  async createCustomer(
    companyId: string,
    body: Record<string, unknown>,
  ): Promise<{ id: string; number: string; displayName: string }> {
    return this.request(
      "POST",
      this.companyPath(companyId, "/customers"),
      { body },
    );
  }

  async listAccounts(
    companyId: string,
    filter?: string,
  ): Promise<Array<{ id: string; number?: string; displayName?: string }>> {
    const qs = new URLSearchParams();
    qs.set("$top", "50");
    if (filter) qs.set("$filter", filter);
    const data = await this.request<ODataList<{ id: string; number?: string; displayName?: string }>>(
      "GET",
      this.companyPath(companyId, `/accounts?${qs.toString()}`),
    );
    return data.value || [];
  }

  async listItems(
    companyId: string,
    filter?: string,
  ): Promise<BcItem[]> {
    const qs = new URLSearchParams();
    qs.set("$top", "200");
    if (filter) qs.set("$filter", filter);
    const data = await this.request<ODataList<BcItem>>(
      "GET",
      this.companyPath(companyId, `/items?${qs.toString()}`),
    );
    return data.value || [];
  }

  async createItem(companyId: string, body: Record<string, unknown>): Promise<BcItem> {
    return this.request<BcItem>("POST", this.companyPath(companyId, "/items"), { body });
  }

  async listSalesOrderLines(companyId: string, orderId: string): Promise<BcSalesLine[]> {
    const data = await this.request<ODataList<BcSalesLine>>(
      "GET",
      this.companyPath(companyId, `/salesOrders(${orderId})/salesOrderLines`),
    );
    return data.value || [];
  }

  async createSalesOrderLine(
    companyId: string,
    orderId: string,
    body: Record<string, unknown>,
  ): Promise<BcSalesLine> {
    return this.request<BcSalesLine>(
      "POST",
      this.companyPath(companyId, `/salesOrders(${orderId})/salesOrderLines`),
      { body },
    );
  }

  async updateSalesOrderLine(
    companyId: string,
    orderId: string,
    lineId: string,
    body: Record<string, unknown>,
    etag: string,
  ): Promise<BcSalesLine | void> {
    return this.request<BcSalesLine | void>(
      "PATCH",
      this.companyPath(companyId, `/salesOrders(${orderId})/salesOrderLines(${lineId})`),
      { body, etag },
    );
  }

  async listSalesInvoices(
    companyId: string,
    filter?: string,
  ): Promise<BcSalesInvoice[]> {
    const qs = new URLSearchParams();
    qs.set("$top", "2000");
    if (filter) qs.set("$filter", filter);
    const data = await this.request<ODataList<BcSalesInvoice>>(
      "GET",
      this.companyPath(companyId, `/salesInvoices?${qs.toString()}`),
    );
    return data.value || [];
  }

  async createSalesInvoice(
    companyId: string,
    body: Record<string, unknown>,
  ): Promise<BcSalesInvoice> {
    return this.request<BcSalesInvoice>(
      "POST",
      this.companyPath(companyId, "/salesInvoices"),
      { body },
    );
  }

  async listSalesInvoiceLines(companyId: string, invoiceId: string): Promise<BcSalesLine[]> {
    const data = await this.request<ODataList<BcSalesLine>>(
      "GET",
      this.companyPath(companyId, `/salesInvoices(${invoiceId})/salesInvoiceLines`),
    );
    return data.value || [];
  }

  async createSalesInvoiceLine(
    companyId: string,
    invoiceId: string,
    body: Record<string, unknown>,
  ): Promise<BcSalesLine> {
    return this.request<BcSalesLine>(
      "POST",
      this.companyPath(companyId, `/salesInvoices(${invoiceId})/salesInvoiceLines`),
      { body },
    );
  }

  async updateSalesInvoiceLine(
    companyId: string,
    invoiceId: string,
    lineId: string,
    body: Record<string, unknown>,
    etag: string,
  ): Promise<BcSalesLine | void> {
    return this.request<BcSalesLine | void>(
      "PATCH",
      this.companyPath(companyId, `/salesInvoices(${invoiceId})/salesInvoiceLines(${lineId})`),
      { body, etag },
    );
  }
}

export const bc365Client = new Bc365Client();
export const bc365SalesClient = new Bc365Client(getBcSalesConfig());

function formatBcErrorPayload(payload: unknown, method: string, url: string, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const err = (payload as { error?: unknown }).error;
    if (typeof err === "string") {
      try {
        const parsed = JSON.parse(err) as { message?: string };
        if (parsed?.message) return parsed.message;
      } catch {
        return err;
      }
      return err;
    }
    if (err && typeof err === "object") {
      const obj = err as { message?: string; code?: string };
      if (typeof obj.message === "string") {
        const inner = obj.message.trim();
        if (inner.startsWith("{")) {
          try {
            const parsed = JSON.parse(inner) as { message?: string };
            if (parsed?.message) return parsed.message;
          } catch {
            return inner;
          }
        }
        return inner;
      }
      if (obj.code) return `${obj.code} (${status})`;
      try {
        return JSON.stringify(err);
      } catch {
        // fall through
      }
    }
  }
  return `BC 365 ${method} ${url} failed (${status})`;
}

export function explainBc365Error(error: unknown): string {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "Business Central did not respond in time. Try pushing one load, and confirm the Entra app is enabled in ObjTestEnv.";
  }
  if (!(error instanceof Bc365Error)) {
    return error instanceof Error ? error.message : String(error);
  }
  const blob = `${error.message} ${JSON.stringify(error.payload ?? "")}`;
  if (/token request failed|invalid_client|AADSTS/i.test(blob)) {
    return "Azure rejected the app login. Check BC_TENANT_ID, BC_CLIENT_ID, and BC_CLIENT_SECRET. Use the secret Value, not the Secret ID.";
  }
  if (/InvalidCredentials/i.test(blob) || error.status === 401) {
    return "Azure login succeeded, but Business Central refused the app. In BC search Microsoft Entra Applications, add this Client ID, set Status to Enabled, grant D365 BUS FULL ACCESS, then Grant Consent. In Azure, admin-consent Dynamics 365 Business Central application permissions (API.ReadWrite.All).";
  }
  if (/NoEnvironment/i.test(blob)) {
    return `Business Central environment was not found. Check BC_SALES_ENVIRONMENT (ObjTestEnv) and BC_ENVIRONMENT (TestEnv).`;
  }
  if (/Posting Group|GST|tax area|Gen\. Bus|Customer Posting/i.test(blob)) {
    return `${error.message} Set Gen. Bus. Posting Group and Customer Posting Group on customer LOADPILOT in SnowmanTest (ObjTestEnv). Those codes must already exist under Gen. Business Posting Groups.`;
  }
  if (error.status === 408 || /timed out/i.test(error.message)) {
    return "Business Central timed out. Enable the Entra application in ObjTestEnv with D365 BUS FULL ACCESS, then push one load.";
  }
  if (/current permissions prevented the action|TableData 50100|LP Load/i.test(blob) && /Insert|Modify|Delete/i.test(blob)) {
    return "Business Central blocked writing LoadPilot Loads. In TestEnv open Microsoft Entra Applications, disable the LoadPilot card, add permission set LP Loads, then enable the card again. D365 BUS FULL ACCESS does not include this custom table.";
  }
  if (
    error.status === 404 &&
    /loadpilot\/integration|\/loads/i.test(blob)
  ) {
    return "The LoadPilot Loads table is not available in this environment. Publish the AL extension to TestEnv, then add permission set LP Loads on the Microsoft Entra Applications card.";
  }
  if (/Internal_RecordNotFound|does not exist/i.test(blob) && /LP Load|loads/i.test(blob)) {
    return "The Entra app can sign in but cannot read LoadPilot Loads. Disable the Entra card, add permission set LP Loads, then enable it again.";
  }
  return error.message;
}
