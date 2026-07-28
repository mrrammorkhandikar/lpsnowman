import { decryptPayload, encryptPayload, normalizePem } from "./surepass-crypto";
import { parseSurepassResponse, type SurepassResponse } from "./surepass-types";

export type SurepassClientOptions = {
  baseUrl: string;
  clientId: string;
  apiToken: string;
  publicKeyPem: string;
  privateKeyPem: string;
  timeoutMs: number;
};

export class SurepassError extends Error {
  status?: number;
  payload?: unknown;
  constructor(message: string, status?: number, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export class SurepassEncryptedClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly apiToken: string;
  private readonly publicKeyPem: string;
  private readonly privateKeyPem: string;
  private readonly timeoutMs: number;

  constructor(options: SurepassClientOptions) {
    this.baseUrl = options.baseUrl;
    this.clientId = options.clientId;
    this.apiToken = options.apiToken;
    this.publicKeyPem = options.publicKeyPem;
    this.privateKeyPem = options.privateKeyPem;
    this.timeoutMs = options.timeoutMs;
  }

  static fromEnv(): SurepassEncryptedClient {
    const clientId = process.env.SUREPASS_CLIENT_ID || "";
    const apiToken = process.env.SUREPASS_API_TOKEN || "";
    const publicKey = process.env.SUREPASS_PUBLIC_KEY || "";
    const privateKey = process.env.SUREPASS_CLIENT_PRIVATE_KEY || "";
    const baseUrl = process.env.SUREPASS_BASE_URL || "https://sandbox-encrypted.surepass.app";
    const timeoutMs = Number.parseInt(process.env.SUREPASS_TIMEOUT_MS || "120000", 10);
    if (!clientId || !apiToken || !publicKey || !privateKey) {
      throw new Error("Surepass env vars missing");
    }
    return new SurepassEncryptedClient({
      baseUrl,
      clientId,
      apiToken,
      publicKeyPem: normalizePem(publicKey),
      privateKeyPem: normalizePem(privateKey),
      timeoutMs,
    });
  }

  async postJson<T>(endpoint: string, body: unknown): Promise<SurepassResponse<T>> {
    const json = JSON.stringify(body);
    return this.postEncrypted<T>(endpoint, json, "application/json");
  }

  async postEncrypted<T>(
    endpoint: string,
    plaintext: string,
    contentType: string,
  ): Promise<SurepassResponse<T>> {
    const { encrypted, contentLength } = encryptPayload(plaintext, this.publicKeyPem);
    const headers = {
      Authorization: `Bearer ${this.apiToken}`,
      "x-client-id": this.clientId,
      "Content-Type": "text/plain",
      "x-content-type": contentType,
      "x-content-length": contentLength.toString(),
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers,
        body: encrypted,
        signal: controller.signal,
      });
      const responseText = await response.text();
      let parsedPayload: unknown | undefined;
      let decryptedPayload: string | undefined;
      try {
        decryptedPayload = decryptPayload(responseText, this.privateKeyPem);
        parsedPayload = JSON.parse(decryptedPayload);
        return parseSurepassResponse<T>(parsedPayload);
      } catch {
        if (responseText.trim().startsWith("{")) {
          try {
            parsedPayload = JSON.parse(responseText);
            return parseSurepassResponse<T>(parsedPayload);
          } catch {
            return {
              success: false,
              status_code: response.status,
              message: "Non-encrypted response from Surepass",
              message_code: "non_encrypted_response",
            };
          }
        }
        return {
          success: false,
          status_code: response.status,
          message: "Non-encrypted response from Surepass",
          message_code: "non_encrypted_response",
        };
      }
    } catch (error: any) {
      if (error instanceof SurepassError) {
        throw error;
      }
      if (error?.name === "AbortError") {
        throw new SurepassError("Surepass request timed out");
      }
      throw new SurepassError(error?.message || "Surepass request failed");
    } finally {
      clearTimeout(timeout);
    }
  }
}
