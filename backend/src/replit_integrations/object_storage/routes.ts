import express, { type Express, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import AWS from "aws-sdk";
import { storage } from "../../storage";

const USE_LOCAL = process.env.USE_LOCAL_OBJECT_STORAGE === "true";
const ALLOW_UNAUTH_UPLOADS = process.env.ALLOW_UNAUTHENTICATED_UPLOADS === "true";
const AWS_BUCKET_NAME = (process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET_NAME || "").trim();
const AWS_REGION = (process.env.AWS_REGION || "").trim();
const AWS_ACCESS_KEY_ID = (process.env.AWS_ACCESS_KEY_ID || "").trim();
const AWS_SECRET_ACCESS_KEY = (process.env.AWS_SECRET_ACCESS_KEY || "").trim();
const AWS_OBJECT_PREFIX = (process.env.AWS_OBJECT_PREFIX || "uploads").trim();
const USE_S3 = Boolean(AWS_BUCKET_NAME && AWS_REGION);

// Log storage configuration on startup
console.log('[ObjectStorage] Configuration:', {
  USE_LOCAL,
  USE_S3,
  AWS_BUCKET_NAME: AWS_BUCKET_NAME ? `${AWS_BUCKET_NAME.substring(0, 10)}...` : 'NOT SET',
  AWS_REGION: AWS_REGION || 'NOT SET',
  AWS_OBJECT_PREFIX,
  hasAccessKey: !!AWS_ACCESS_KEY_ID,
  hasSecretKey: !!AWS_SECRET_ACCESS_KEY,
});

// Warn if no storage is configured
if (!USE_LOCAL && !USE_S3) {
  console.warn('[ObjectStorage] ⚠️  WARNING: No storage configured! Set AWS S3 credentials or USE_LOCAL_OBJECT_STORAGE=true');
  console.warn('[ObjectStorage] Required for production: AWS_BUCKET_NAME, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
}

// Authentication middleware - checks if user is logged in
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (USE_LOCAL && ALLOW_UNAUTH_UPLOADS) {
    return next();
  }
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// File size limit: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

/**
 * Browser uploads use multipart/form-data (see use-upload hook) so AWS WAF/ALB rules
 * are less likely to block large binary bodies than raw POST bodies.
 * Older clients may still send raw binary + x-file-name headers.
 */
function uploadFileBodyParser(req: Request, res: Response, next: NextFunction) {
  const ct = String(req.headers["content-type"] || "");
  if (ct.includes("multipart/form-data")) {
    uploadMemory.single("file")(req, res, (err: unknown) => {
      if (err) {
        const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
        if (code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` });
        }
        const msg = err instanceof Error ? err.message : "Could not parse upload";
        return res.status(400).json({ error: msg });
      }
      next();
    });
    return;
  }
  express.raw({ type: "*/*", limit: "10mb" })(req, res, next);
}

// Allowed content types for document uploads (canonical types stored on S3 / validated)
const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

/** Non-canonical MIME values clients send for the same formats (esp. Apple HEIC/HEIF). */
const UPLOAD_MIME_ALIASES: Record<string, string> = {
  "image/heic-sequence": "image/heic",
  "image/heif-sequence": "image/heif",
  "video/heic": "image/heic",
  "video/heif": "image/heif",
  /** Some Windows / Chrome builds use this for .heic/.heif picks */
  "video/quicktime": "image/heic",
};

/** When the browser sends an empty or generic MIME, infer from the original filename. */
const UPLOAD_EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

function resolveUploadContentType(
  filename: string,
  declaredType: string | undefined,
): string | null {
  const clean = (declaredType ?? "").split(";")[0].trim().toLowerCase();
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  // HEIC/HEIF: many browsers send video/quicktime, octet-stream, or wrong image/*; trust .heic/.heif first.
  if (ext === "heic" || ext === "heif") {
    const canonical = UPLOAD_EXT_TO_MIME[ext];
    if (canonical && ALLOWED_CONTENT_TYPES.includes(canonical)) {
      return canonical;
    }
  }

  if (clean && ALLOWED_CONTENT_TYPES.includes(clean)) {
    return clean;
  }

  const aliased = clean ? UPLOAD_MIME_ALIASES[clean] : undefined;
  if (aliased && ALLOWED_CONTENT_TYPES.includes(aliased)) {
    // video/quicktime is only allowed when the file is actually HEIC/HEIF by extension
    if (clean === "video/quicktime" && ext !== "heic" && ext !== "heif") {
      // fall through to normal rules (e.g. real .mov)
      return null;
    }
    return aliased;
  }

  if (clean && clean !== "application/octet-stream" && clean !== "") {
    return null;
  }

  const inferred = UPLOAD_EXT_TO_MIME[ext];
  if (inferred && ALLOWED_CONTENT_TYPES.includes(inferred)) {
    return inferred;
  }
  return null;
}

/**
 * Register object storage routes for file uploads.
 *
 * Security: All routes require authentication via session.
 * File uploads are limited to 10MB and specific content types.
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();
  const useLocal = USE_LOCAL;
  const s3 = USE_S3
    ? new AWS.S3({
        accessKeyId: AWS_ACCESS_KEY_ID || undefined,
        secretAccessKey: AWS_SECRET_ACCESS_KEY || undefined,
        region: AWS_REGION,
        signatureVersion: "v4",
      })
    : null;

  /**
   * Request a presigned URL for file upload.
   * Requires authentication.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid"
   * }
   */
  app.post("/api/uploads/request-url", requireAuth, async (req, res) => {
    try {
      const { name, size, contentType } = req.body;
      const requestId = randomUUID();
      const startedAt = Date.now();
      const userId = req.session?.userId || "unknown";
      const uploadedAt = new Date().toISOString();
      if (!name) {
        console.warn("[Uploads][request-url][validation]", {
          requestId,
          issue: "missing_name",
        });
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      // Validate file size
      if (size && size > MAX_FILE_SIZE) {
        console.warn("[Uploads][request-url][validation]", {
          requestId,
          issue: "file_too_large",
          size,
          max: MAX_FILE_SIZE,
        });
        return res.status(400).json({
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        });
      }

      const resolvedContentType = resolveUploadContentType(String(name || ""), contentType);
      if (!resolvedContentType) {
        console.warn("[Uploads][request-url][validation]", {
          requestId,
          issue: "invalid_content_type",
          contentType,
          name,
        });
        return res.status(400).json({
          error: `Invalid file type. Allowed: ${ALLOWED_CONTENT_TYPES.join(", ")}`,
        });
      }

      if (useLocal) {
        const objectId = randomUUID();
        const port = parseInt(process.env.PORT || "5000", 10);
        const uploadURL = `http://localhost:${port}/api/uploads/direct/${objectId}`;
        const objectPath = `/objects/uploads/${objectId}`;
        console.log("[Uploads][request-url][local]", {
          requestId,
          objectId,
          uploadURL,
          objectPath,
        });
        return res.json({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType: resolvedContentType, requestId, storage: "local", userId, uploadedAt },
          metadataHeaders: {
            "x-amz-meta-original-filename": String(name || ""),
            "x-amz-meta-uploaded-by": userId,
            "x-amz-meta-uploaded-at": uploadedAt,
          },
        });
      }
      if (USE_S3 && s3) {
        // Generate unique ID for the file to avoid collisions
        const fileId = randomUUID();
        const ext = String(name || "").split(".").pop() || "";
        const safeName = ext ? `${fileId}.${ext}` : fileId;
        const key = `${AWS_OBJECT_PREFIX}/${safeName}`;
        
        try {
          const uploadURL = await new Promise<string>((resolve, reject) => {
            s3.getSignedUrl(
              "putObject",
              {
                Bucket: AWS_BUCKET_NAME,
                Key: key,
                ContentType: resolvedContentType,
                Expires: 900,
                Metadata: {
                  "original-filename": String(name || ""),
                  "uploaded-by": userId,
                  "uploaded-at": uploadedAt,
                },
              },
              (err, url) => {
                if (err || !url) return reject(err || new Error("Failed to sign URL"));
                resolve(url);
              }
            );
          });
          
          // Return the safeName (UUID + extension) as the objectPath identifier
          const objectPath = `/objects/uploads/${safeName}`;
          
          console.log("[Uploads][request-url][s3]", {
            requestId,
            bucket: AWS_BUCKET_NAME,
            region: AWS_REGION,
            key,
            safeName,
            objectPath,
            originalName: name,
            tookMs: Date.now() - startedAt,
          });
          
          return res.json({
            uploadURL,
            objectPath,
            metadata: {
              name,
              size,
              contentType: resolvedContentType,
              requestId,
              storage: "s3",
              bucket: AWS_BUCKET_NAME,
              key,
              safeName,
              region: AWS_REGION,
              userId,
              uploadedAt,
            },
            metadataHeaders: {
              "x-amz-meta-original-filename": String(name || ""),
              "x-amz-meta-uploaded-by": userId,
              "x-amz-meta-uploaded-at": uploadedAt,
            },
          });
        } catch (e) {
          console.error("[Uploads][request-url][s3][error]", {
            requestId,
            error: (e as Error)?.message,
          });
          return res.status(502).json({ error: "Failed to generate S3 upload URL" });
        }
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      console.log("[Uploads][request-url][fallback]", {
        requestId,
        objectPath,
        tookMs: Date.now() - startedAt,
      });

      res.json({
        uploadURL,
        objectPath,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType, requestId, storage: "fallback", userId, uploadedAt },
        metadataHeaders: {
          "x-amz-meta-original-filename": String(name || ""),
          "x-amz-meta-uploaded-by": userId,
          "x-amz-meta-uploaded-at": uploadedAt,
        },
      });
    } catch (error) {
      console.error("[Uploads][request-url][error]", {
        error: (error as Error)?.message,
      });
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Backend-proxy file upload endpoint.
   * Accepts multipart/form-data (field name `file`, preferred for prod/WAF) or raw binary body.
   * This avoids browser CORS issues with direct S3 presigned URL uploads.
   *
   * POST /api/uploads/upload-file
   * multipart: field `file`
   * raw: Headers Content-Type / x-file-name / x-file-type, body = raw bytes
   */
  app.post(
    "/api/uploads/upload-file",
    requireAuth,
    uploadFileBodyParser,
    async (req: Request, res: Response) => {
      const requestId = randomUUID();
      const startedAt = Date.now();
      const userId = req.session?.userId || "unknown";

      try {
        type ReqWithFile = Request & { file?: Express.Multer.File };
        const mf = (req as ReqWithFile).file;

        let buffer: Buffer;
        let originalname: string;
        let cleanMime: string;

        if (mf) {
          buffer = mf.buffer;
          originalname = mf.originalname || "upload";
          cleanMime = (mf.mimetype || "application/octet-stream").split(";")[0].trim();
        } else {
          buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body as any);
          if (!buffer || buffer.length === 0) {
            return res.status(400).json({ error: "No file data received" });
          }

          originalname = decodeURIComponent(req.headers["x-file-name"] as string || "upload");
          const mimetype = (req.headers["x-file-type"] as string) || req.headers["content-type"] || "application/octet-stream";
          cleanMime = mimetype.split(";")[0].trim();
        }

        if (!buffer || buffer.length === 0) {
          return res.status(400).json({ error: "No file data received" });
        }
        const size = buffer.length;
        const uploadedAt = new Date().toISOString();

        const resolvedMime = resolveUploadContentType(originalname, cleanMime);
        if (!resolvedMime) {
          return res.status(400).json({ error: `Invalid file type. Allowed: ${ALLOWED_CONTENT_TYPES.join(", ")}` });
        }

        if (size > MAX_FILE_SIZE) {
          return res.status(400).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` });
        }

        console.log("[Uploads][upload-file][start]", { requestId, name: originalname, size, contentType: resolvedMime, userId });

        if (useLocal) {
          const objectId = randomUUID();
          const baseDir = path.resolve(process.cwd(), "local_objects", "uploads");
          await fs.promises.mkdir(baseDir, { recursive: true });
          const filePath = path.join(baseDir, objectId);
          await fs.promises.writeFile(filePath, buffer);
          const objectPath = `/objects/uploads/${objectId}`;
          console.log("[Uploads][upload-file][local]", { requestId, objectId, objectPath });
          return res.json({ objectPath, metadata: { name: originalname, size, contentType: resolvedMime, storage: "local" } });
        }

        if (USE_S3 && s3) {
          const fileId = randomUUID();
          const ext = originalname.split(".").pop() || "";
          const safeName = ext ? `${fileId}.${ext}` : fileId;
          const key = `${AWS_OBJECT_PREFIX}/${safeName}`;

          await new Promise<void>((resolve, reject) => {
            s3.putObject(
              {
                Bucket: AWS_BUCKET_NAME,
                Key: key,
                Body: buffer,
                ContentType: resolvedMime,
                Metadata: {
                  "original-filename": originalname,
                  "uploaded-by": userId,
                  "uploaded-at": uploadedAt,
                },
              },
              (err) => {
                if (err) return reject(err);
                resolve();
              }
            );
          });

          const objectPath = `/objects/uploads/${safeName}`;
          console.log("[Uploads][upload-file][s3]", {
            requestId, bucket: AWS_BUCKET_NAME, key, objectPath,
            originalName: originalname, tookMs: Date.now() - startedAt,
          });

          return res.json({
            objectPath,
            metadata: { name: originalname, size, contentType: resolvedMime, requestId, storage: "s3",
              bucket: AWS_BUCKET_NAME, key, region: AWS_REGION, userId, uploadedAt },
          });
        }

        return res.status(503).json({ error: "No storage backend configured" });
      } catch (error) {
        console.error("[Uploads][upload-file][error]", { requestId, error: (error as Error)?.message });
        res.status(500).json({ error: (error as Error)?.message || "Upload failed" });
      }
    }
  );

  app.put(
    "/api/uploads/direct/:id",
    express.raw({ type: "*/*", limit: "10mb" }),
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const id = req.params.id;
        const baseDir = path.resolve(process.cwd(), "local_objects", "uploads");
        await fs.promises.mkdir(baseDir, { recursive: true });
        const filePath = path.join(baseDir, id);
        const data = Buffer.isBuffer(req.body) ? (req.body as Buffer) : Buffer.from(req.body as any);
        await fs.promises.writeFile(filePath, data);
        console.log("[Uploads][direct][saved]", {
          id,
          bytes: data.length,
          filePath,
        });
        return res.status(200).json({
          ok: true,
          objectPath: `/objects/uploads/${id}`,
          metadata: { bytes: data.length, storage: "local" },
        });
      } catch (error) {
        console.error("[Uploads][direct][error]", {
          error: (error as Error)?.message,
        });
        return res.status(500).json({ error: "Failed to save upload" });
      }
    }
  );

  /**
   * Client-side upload failure reporting.
   * Allows the frontend to report failed PUT attempts so we can audit and alert.
   */
  app.post("/api/uploads/report-failure", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId || null;
      const { name, size, contentType, requestId, uploadURL, errorMessage, statusCode } = req.body || {};
      await storage.createApiLog({
        userId: userId || undefined,
        endpoint: "/api/uploads/report-failure",
        method: "POST",
        requestBody: { name, size, contentType, requestId, uploadURL },
        responseBody: null,
        statusCode: Number(statusCode) || 0,
        errorMessage: String(errorMessage || "Unknown upload failure"),
        durationMs: 0,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "",
        userAgent: req.headers["user-agent"] || "",
        logType: "error",
      } as any);
      res.json({ ok: true });
    } catch (e) {
      console.error("[Uploads][report-failure][error]", { error: (e as Error)?.message });
      res.status(500).json({ error: "Failed to record upload failure" });
    }
  });

  /**
   * Generate presigned URL for document viewing
   * This allows documents to be viewed without session authentication
   * 
   * GET /api/documents/presigned-url?path=/objects/uploads/abc123.pdf
   */
  app.get("/api/documents/presigned-url", requireAuth, async (req, res) => {
    try {
      let docPath = req.query.path;
      if (typeof docPath !== 'string' || !docPath.trim()) {
        return res.status(400).json({ error: "Missing or invalid path parameter" });
      }
      docPath = docPath.trim();

      // Normalize: if stored as full URL (e.g. https://origin/objects/uploads/...), use pathname only
      if (docPath.startsWith("http://") || docPath.startsWith("https://")) {
        try {
          const u = new URL(docPath);
          docPath = u.pathname;
        } catch {
          // leave docPath as-is if URL parse fails
        }
      }
      // Ensure leading slash for consistent parsing (split then filter removes empty)
      if (docPath.length > 0 && !docPath.startsWith("/")) {
        docPath = "/" + docPath;
      }
      
      console.log("[Documents][presigned-url][request]", {
        userId: req.session?.userId,
        docPath,
      });
      
      if (USE_S3 && s3) {
        // Extract the file ID from the path (e.g. /objects/uploads/id or objects/uploads/id)
        const parts = docPath.split("/").filter(Boolean);
        if (parts.length >= 3 && parts[0] === "objects" && parts[1] === "uploads") {
          const id = parts.slice(2).join("/");
          
          // Try multiple possible S3 keys
          const possibleKeys = [
            `${AWS_OBJECT_PREFIX}/${id}`,
            `uploads/${id}`,
            `documents/${id}`,
            id,
          ];
          
          // Check which key exists and generate presigned URL
          for (const key of possibleKeys) {
            try {
              // Check if object exists
              await s3.headObject({
                Bucket: AWS_BUCKET_NAME,
                Key: key,
              }).promise();
              
              // Generate presigned URL (valid for 1 hour)
              const presignedUrl = s3.getSignedUrl('getObject', {
                Bucket: AWS_BUCKET_NAME,
                Key: key,
                Expires: 3600, // 1 hour
              });
              
              console.log("[Documents][presigned-url][success]", {
                key,
                expiresIn: 3600,
              });
              
              return res.json({ url: presignedUrl });
              
            } catch (e: any) {
              if (e.code !== 'NotFound' && e.statusCode !== 404) {
                console.error("[Documents][presigned-url][error]", {
                  key,
                  error: e.message,
                });
              }
              // Continue to next key
              continue;
            }
          }
          
          console.warn("[Documents][presigned-url][not_found]", {
            docPath,
            triedKeys: possibleKeys,
          });
          
          return res.status(404).json({ 
            error: "Document not found",
            triedKeys: possibleKeys,
          });
        }
      }
      
      // Fallback: return the original path (for local storage or direct access)
      return res.json({ url: docPath });
      
    } catch (error) {
      console.error("[Documents][presigned-url][error]", error);
      return res.status(500).json({ error: "Failed to generate presigned URL" });
    }
  });

  /**
   * Serve uploaded objects.
   * Requires authentication - only logged-in users can download files.
   *
   * GET /objects/:objectPath(*)
   */
  app.get("/objects/:objectPath(*)", requireAuth, async (req, res) => {
    try {
      if (useLocal) {
        const parts = req.path.split("/").filter(Boolean);
        if (parts.length >= 3 && parts[0] === "objects" && parts[1] === "uploads") {
          const id = parts.slice(2).join("/");
          const filePath = path.resolve(process.cwd(), "local_objects", "uploads", id);
          if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Object not found" });
          }
          const stat = await fs.promises.stat(filePath);
          const originalFilename = req.query.filename as string | undefined;
          let contentType = (req.query.contentType as string) || "application/octet-stream";
          if (contentType === "application/octet-stream" && originalFilename) {
            const ext = originalFilename.split(".").pop()?.toLowerCase();
            const mimeMap: Record<string, string> = {
              png: "image/png",
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              gif: "image/gif",
              webp: "image/webp",
              heic: "image/heic",
              heif: "image/heif",
              svg: "image/svg+xml",
              pdf: "application/pdf",
              doc: "application/msword",
              docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            };
            if (ext && mimeMap[ext]) {
              contentType = mimeMap[ext];
            }
          }
          const wantsJpegPreview =
            String(req.query.preview || "").toLowerCase() === "jpeg" ||
            String(req.query.preview || "").toLowerCase() === "jpg";

          const isHeif =
            contentType === "image/heic" ||
            contentType === "image/heif" ||
            originalFilename?.toLowerCase().endsWith(".heic") ||
            originalFilename?.toLowerCase().endsWith(".heif");

          if (wantsJpegPreview && isHeif) {
            const buf = await fs.promises.readFile(filePath);
            const jpg = await sharp(buf).jpeg({ quality: 88 }).toBuffer();
            res.set({
              "Content-Type": "image/jpeg",
              "Content-Length": String(jpg.length),
              "Cache-Control": "private, max-age=3600",
            });
            res.end(jpg);
            return;
          }

          res.set({
            "Content-Type": contentType,
            "Content-Length": stat.size.toString(),
            "Cache-Control": "private, max-age=3600",
          });
          console.log("[Uploads][serve][local]", {
            id,
            bytes: stat.size,
            contentType,
          });
          const stream = fs.createReadStream(filePath);
          stream.on("error", () => {
            if (!res.headersSent) {
              res.status(500).json({ error: "Error streaming file" });
            }
          });
          stream.pipe(res);
          return;
        }
      }
      if (USE_S3 && s3) {
        const parts = req.path.split("/").filter(Boolean);
        if (parts.length >= 3 && parts[0] === "objects" && parts[1] === "uploads") {
          const id = parts.slice(2).join("/");
          
          // Try multiple possible S3 key locations
          const possibleKeys = [
            `${AWS_OBJECT_PREFIX}/${id}`,  // Primary: documents/{id} or uploads/{id}
            `uploads/${id}`,                // Fallback 1: uploads/{id}
            `documents/${id}`,              // Fallback 2: documents/{id}
            id,                             // Fallback 3: root level
          ];
          
          let lastError: any = null;

          // Try each possible key location
          for (const key of possibleKeys) {
            try {
              
              const obj = await s3
                .getObject({
                  Bucket: AWS_BUCKET_NAME,
                  Key: key,
                })
                .promise();
                
              const originalFilename = req.query.filename as string | undefined;
              let contentType =
                (obj.ContentType as string) ||
                (req.query.contentType as string) ||
                "application/octet-stream";
                
              if (contentType === "application/octet-stream" && originalFilename) {
                const ext = originalFilename.split(".").pop()?.toLowerCase();
                const mimeMap: Record<string, string> = {
                  png: "image/png",
                  jpg: "image/jpeg",
                  jpeg: "image/jpeg",
                  gif: "image/gif",
                  webp: "image/webp",
                  heic: "image/heic",
                  heif: "image/heif",
                  svg: "image/svg+xml",
                  pdf: "application/pdf",
                  doc: "application/msword",
                  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                };
                if (ext && mimeMap[ext]) {
                  contentType = mimeMap[ext];
                }
              }
              
              if (obj.Body) {
                const wantsJpegPreview =
                  String(req.query.preview || "").toLowerCase() === "jpeg" ||
                  String(req.query.preview || "").toLowerCase() === "jpg";
                const isHeif =
                  contentType === "image/heic" ||
                  contentType === "image/heif" ||
                  originalFilename?.toLowerCase().endsWith(".heic") ||
                  originalFilename?.toLowerCase().endsWith(".heif");

                if (wantsJpegPreview && isHeif) {
                  const buf = Buffer.isBuffer(obj.Body)
                    ? (obj.Body as Buffer)
                    : Buffer.from(obj.Body as any);
                  const jpg = await sharp(buf).jpeg({ quality: 88 }).toBuffer();
                  res.set({
                    "Content-Type": "image/jpeg",
                    "Content-Length": String(jpg.length),
                    "Cache-Control": "private, max-age=3600",
                    "Access-Control-Allow-Origin": req.headers.origin || "*",
                    "Access-Control-Allow-Credentials": "true",
                  });
                  res.end(jpg);
                  return;
                }

                res.set({
                  "Content-Type": contentType,
                  "Content-Length": String(obj.ContentLength || (obj.Body as Buffer).length || 0),
                  "Cache-Control": "private, max-age=3600",
                  "Access-Control-Allow-Origin": req.headers.origin || "*",
                  "Access-Control-Allow-Credentials": "true",
                });
                
                // Warn only if found at a non-primary key location (misconfiguration hint)
                if (key !== possibleKeys[0]) {
                  console.warn("[Uploads][serve][s3][wrong_location]", {
                    expectedKey: possibleKeys[0],
                    actualKey: key,
                    hint: `Update AWS_OBJECT_PREFIX to match actual S3 structure`,
                  });
                }

                res.end(obj.Body as Buffer);
                return;
              }
              
            } catch (e) {
              const error = e as any;
              lastError = error;
              
              // Only log if it's not a simple "not found" error
              if (error.code !== "NoSuchKey" && error.statusCode !== 404) {
                console.error("[Uploads][serve][s3][error]", {
                  key,
                  bucket: AWS_BUCKET_NAME,
                  errorCode: error.code,
                  errorMessage: error.message,
                });
              }
              
              // Continue to next possible key
              continue;
            }
          }
          
          // If we get here, none of the keys worked
          console.error("[Uploads][serve][s3][all_attempts_failed]", {
            requestPath: req.path,
            parsedId: id,
            triedKeys: possibleKeys,
            bucket: AWS_BUCKET_NAME,
            region: AWS_REGION,
            prefix: AWS_OBJECT_PREFIX,
            lastError: lastError ? {
              code: lastError.code,
              message: lastError.message,
              statusCode: lastError.statusCode,
            } : null,
          });
          
          if (lastError?.code === "AccessDenied" || lastError?.statusCode === 403) {
            return res.status(403).json({ 
              error: "Access denied to S3 document",
              details: "Check IAM permissions for GetObject on this bucket",
              bucket: AWS_BUCKET_NAME,
              triedKeys: possibleKeys,
            });
          }
          
          return res.status(404).json({ 
            error: "Document not found in S3",
            bucket: AWS_BUCKET_NAME,
            triedKeys: possibleKeys,
            hint: "File may not exist in S3, or AWS_OBJECT_PREFIX may be incorrect",
            suggestion: "Check CloudWatch logs for actual S3 structure",
          });
        }
      }
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const originalFilename = req.query.filename as string | undefined;
      await objectStorageService.downloadObject(objectFile, res, 3600, originalFilename);
    } catch (error) {
      console.error("[Uploads][serve][error]", {
        error: (error as Error)?.message,
        path: req.path,
      });
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

