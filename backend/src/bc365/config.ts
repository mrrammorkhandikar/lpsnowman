export const BC_CUSTOMER_NAME = "LoadPilot";
export const BC_EXTERNAL_PREFIX = "LP";
export const BC_META_PREFIX = "LP|";

export type Bc365Config = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  environment: string;
  companyId: string;
  scope: string;
  baseUrl: string;
  enabled: boolean;
};

export function getBc365Config(): Bc365Config {
  const tenantId = (process.env.BC_TENANT_ID || "").trim();
  const clientId = (process.env.BC_CLIENT_ID || "").trim();
  const clientSecret = (process.env.BC_CLIENT_SECRET || "").trim();
  const environment = (process.env.BC_ENVIRONMENT || "Sandbox").trim();
  const companyId = (process.env.BC_COMPANY_ID || "").trim();
  const scope = (process.env.BC_SCOPE || "https://api.businesscentral.dynamics.com/.default").trim();
  const baseUrl = (process.env.BC_BASE_URL || "https://api.businesscentral.dynamics.com/v2.0").replace(/\/+$/, "");
  return {
    tenantId,
    clientId,
    clientSecret,
    environment,
    companyId,
    scope,
    baseUrl,
    enabled: Boolean(tenantId && clientId && clientSecret),
  };
}

export function getBcSalesConfig(): Bc365Config {
  const base = getBc365Config();
  const environment = (process.env.BC_SALES_ENVIRONMENT || "ObjTestEnv").trim() || base.environment;
  const companyId = (process.env.BC_SALES_COMPANY_ID || "").trim();
  return {
    ...base,
    environment,
    companyId,
  };
}

export function bcSalesCompanyName(): string {
  return (process.env.BC_SALES_COMPANY_NAME || "SnowmanTest").trim() || "SnowmanTest";
}

export function bcSalesItemNumber(): string {
  return (process.env.BC_SALES_ITEM_NUMBER || "LP-FREIGHT").trim() || "LP-FREIGHT";
}

/** Optional SnowmanTest customer number to attach sales documents to. */
export function bcSalesCustomerNumber(): string {
  return (process.env.BC_SALES_CUSTOMER_NUMBER || "").trim();
}

export function bcApiRoot(config = getBc365Config()): string {
  return `${config.baseUrl}/${config.tenantId}/${encodeURIComponent(config.environment)}/api/v2.0`;
}

export function bcLoadsApiRoot(config = getBc365Config()): string {
  return `${config.baseUrl}/${config.tenantId}/${encodeURIComponent(config.environment)}/api/loadpilot/integration/v1.0`;
}
