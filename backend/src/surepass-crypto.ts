import crypto from "crypto";

const aesKeyLength = 32;
const ivLength = 12;

export type EncryptedPayload = {
  encrypted: string;
  contentLength: number;
};

export function normalizePem(value: string): string {
  const normalized = value.replace(/\\n/g, "\n").trim();
  if (normalized.includes("BEGIN PUBLIC KEY") || normalized.includes("BEGIN PRIVATE KEY")) {
    if (!normalized.includes("\n")) {
      const headerMatch = normalized.match(/^(-----BEGIN [^-]+-----)/);
      const footerMatch = normalized.match(/(-----END [^-]+-----)$/);
      if (headerMatch && footerMatch) {
        const header = headerMatch[1];
        const footer = footerMatch[1];
        const body = normalized.slice(header.length, normalized.length - footer.length).trim();
        return `${header}\n${body}\n${footer}\n`;
      }
    }
  }
  return normalized;
}

export function encryptPayload(plaintext: string, publicKeyPem: string): EncryptedPayload {
  const aesKey = crypto.randomBytes(aesKeyLength);
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  cipher.setAAD(Buffer.alloc(0));
  const encryptedData = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const encryptedAesKey = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    aesKey,
  );
  const encrypted = [
    encryptedAesKey.toString("base64"),
    iv.toString("base64"),
    encryptedData.toString("base64"),
    authTag.toString("base64"),
  ].join(":");
  return { encrypted, contentLength: Buffer.byteLength(plaintext) };
}

export function decryptPayload(encryptedPayload: string, privateKeyPem: string): string {
  const parts = encryptedPayload.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted payload format");
  }
  const [encryptedKeyB64, ivB64, dataB64, tagB64] = parts;
  const aesKey = crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encryptedKeyB64, "base64"),
  );
  const iv = Buffer.from(ivB64, "base64");
  const encryptedData = Buffer.from(dataB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAAD(Buffer.alloc(0));
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return decrypted.toString("utf8");
}
