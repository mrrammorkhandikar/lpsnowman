import { bcApiRoot, bcLoadsApiRoot, getBc365Config, type Bc365Config } from "./config";

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

type ODataList<T> = { value: T[] };

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
    options: { body?: unknown; etag?: string; absolute?: boolean } = {},
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
    const res = await fetch(url, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
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
      const message =
        typeof payload === "object" && payload && "error" in payload
          ? JSON.stringify((payload as { error: unknown }).error)
          : `BC 365 ${method} ${url} failed (${res.status})`;
      throw new Bc365Error(message, res.status, payload);
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
    const configuredName = getBc365Config().environment;
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
}

export const bc365Client = new Bc365Client();

export function explainBc365Error(error: unknown): string {
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
    return `Business Central environment "${getBc365Config().environment}" was not found on this tenant. Use the name from the admin URL (for this project: TestEnv).`;
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
