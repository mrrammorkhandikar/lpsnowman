import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerAdminRemoveSavedAddress } from "./admin-remove-saved-address";
import { createServer } from "http";
import { setupMarketplaceWebSocket } from "./websocket-marketplace";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { storage } from "./storage";
import { scheduleIntuTrackRefresh } from "./trips/triptrack-locations-service";
import { pool } from "./db";
import { warmDatabasePool, startPoolKeepAlive } from "./session-store-setup";
import path from "path";
import fs from "fs";
import cors from "cors";

const app = express();

// CRITICAL: Health check endpoint MUST be first - before ANY middleware
// This ensures ALB/ECS health checks always succeed even if other services fail
// No database, no auth, no session, no body par sing - pure HTTP 200
let isReady = false;

app.get("/health", (_req, res) => {
  // Return 503 during startup, 200 when ready
  if (!isReady) {
    return res.status(503).json({
      status: "starting",
      service: "logistics-backend",
      message: "Server is starting up",
    });
  }
  
  res.status(200).json({
    status: "ok",
    service: "logistics-backend",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Serve AI-generated assets from attached_assets folder (for both dev and prod)
const assetsPath = path.resolve(process.cwd(), "attached_assets");
if (fs.existsSync(assetsPath)) {
  app.use("/assets", express.static(assetsPath, {
    maxAge: '1d',
    etag: true,
    lastModified: true,
  }));
}

const httpServer = createServer(app);

// AWS ALB keeps connections open for 60s by default.
// Node.js default keepAliveTimeout is only 5s — when ALB tries to reuse a
// connection Node already closed, the request gets a 502.  Setting these
// slightly above ALB's 60s ensures Node always closes connections AFTER ALB,
// and incognito / new-tab requests reuse existing TCP sockets instead of
// opening new ones (eliminates a significant chunk of first-request latency).
httpServer.keepAliveTimeout = 65000;   // 65s > ALB 60s
httpServer.headersTimeout   = 66000;   // must be > keepAliveTimeout

setupMarketplaceWebSocket(httpServer);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Disable ETag on dynamic responses — Express 304 replies have empty bodies and break fetch().json()
app.set("etag", false);

app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  next();
});

// CORS for cross-origin frontend → API requests with cookies
app.use(
  cors({
    origin: (origin, cb) => {
      const cfg = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "").split(",").map(s=>s.trim()).filter(Boolean);
      if (cfg.length === 0) return cb(null, true);
      return cb(null, !!origin && cfg.includes(origin));
    },
    credentials: true,
    methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
    // Allow custom headers used by the upload proxy endpoint.
    // Without these, browsers will fail the CORS preflight and the POST never reaches the backend.
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "x-file-name",
      "x-file-type",
    ],
    exposedHeaders: ["Set-Cookie"],
    maxAge: 86400,
  })
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    if (path.startsWith("/api")) {
      // Log only method + path + status + duration.
      // ⚠️ Never log the response body — JSON.stringify on large payloads
      // (e.g. /api/loads returning hundreds of rows) runs synchronously on
      // the event loop and was causing 15-20s stalls on first requests.
      log(`${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`);
    }
  });

  next();
});

// Global API request timeout to prevent extremely long-running requests
// from hitting ALB timeouts and causing 504 errors. This enforces an
// upper bound on how long any /api request can take on the backend.
const API_REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.API_REQUEST_TIMEOUT_MS || "25000",
  10,
);

// Proxy uploads (browser → API → S3) need time to receive the full body on slow links
// plus S3 putObject. Default 25s was aborting ~5MB HEIC/JPEG uploads before completion.
const UPLOAD_REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.UPLOAD_REQUEST_TIMEOUT_MS || "120000",
  10,
);

function apiTimeoutMsForPath(pathname: string): number {
  if (
    pathname === "/api/uploads/upload-file" ||
    pathname.startsWith("/api/uploads/direct/")
  ) {
    return Number.isFinite(UPLOAD_REQUEST_TIMEOUT_MS) && UPLOAD_REQUEST_TIMEOUT_MS > 0
      ? UPLOAD_REQUEST_TIMEOUT_MS
      : 120000;
  }
  return Number.isFinite(API_REQUEST_TIMEOUT_MS) && API_REQUEST_TIMEOUT_MS > 0
    ? API_REQUEST_TIMEOUT_MS
    : 25000;
}

app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) {
    return next();
  }

  const effectiveTimeout = apiTimeoutMsForPath(req.path);

  const timer = setTimeout(() => {
    if (res.headersSent) return;
    res.status(504).json({
      error: "Request timed out",
      path: req.path,
      timeoutMs: effectiveTimeout,
    });
  }, effectiveTimeout);

  const clear = () => clearTimeout(timer);
  res.on("finish", clear);
  res.on("close", clear);

  next();
});

(async () => {
  // CRITICAL: Do NOT run migrations on startup - they block health checks
  // Migrations should be run via CI/CD pipeline or manual scripts
  // If you need to run migrations, do it AFTER server starts listening
  
  // Set startup timeout to prevent infinite hangs
  const startupTimeout = setTimeout(() => {
    console.error('FATAL: Server startup timeout after 30 seconds');
    console.error('This usually means database connection is hanging');
    console.error('Check DATABASE_URL and RDS security group configuration');
    process.exit(1);
  }, 30000);
  
  // Test database connection with retry logic (non-blocking for health checks)
  let dbReady = false;
  let retries = 0;
  const maxRetries = 3;
  
  while (!dbReady && retries < maxRetries) {
    try {
      await pool.query('SELECT 1');
      dbReady = true;
      log('Database connection established');
    } catch (err: any) {
      retries++;
      log(`Database connection failed (attempt ${retries}/${maxRetries}): ${err.message}`);
      if (retries < maxRetries) {
        const delay = Number.parseInt(process.env.DB_CONNECT_RETRY_DELAY_MS || "400", 10);
        await new Promise((resolve) =>
          setTimeout(resolve, Number.isFinite(delay) && delay > 0 ? delay : 400),
        );
      }
    }
  }
  
  if (!dbReady) {
    log('WARNING: Failed to connect to database after multiple attempts');
    log('Server will start anyway - some features may not work until database is available');
    // Continue anyway - let health checks succeed but log the issue
  }
  
  // Note: Object storage routes are registered after main routes
  // to ensure session middleware is available
  await registerRoutes(httpServer, app);
  // Ensures POST /api/admin/remove-saved-address exists even if routes.ts failed to hot-reload fully
  registerAdminRemoveSavedAddress(app);

  try {
    await warmDatabasePool(pool);
    log("Database pool warmed (connections open, auth tables pre-cached)");
  } catch (err: any) {
    log(`Database pool warmup skipped: ${err?.message ?? err}`);
  }

  // Keep the minimum pool connections alive during quiet periods so the next
  // request never re-pays TCP/TLS/RDS-auth handshake cost.
  startPoolKeepAlive(pool);

  // Register object storage routes (after session middleware)
  registerObjectStorageRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Backend is API-only in production
  // Frontend is deployed separately on S3/CloudFront
  if (process.env.NODE_ENV === "production") {
    log("Running in production mode (API Only - Frontend on S3/CloudFront)");
  } else {
    // In separated architecture, we don't run Vite middleware in backend
    // const { setupVite } = await import("./vite");
    // await setupVite(httpServer, app);
    log("Running in development mode (API Only)");
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  
  const getListenOptions = () => {
    const options: { port: number; host: string; reusePort?: boolean } = {
      port,
      host: "0.0.0.0",
    };
    if (process.platform !== "win32") {
      options.reusePort = true;
    }
    return options;
  };

  const startServer = () => {
    httpServer.listen(getListenOptions(), () => {
      clearTimeout(startupTimeout); // Clear timeout once server is listening
      isReady = true; // Mark server as ready for health checks
      log(`serving on port ${port}`);
      log(`Health check endpoint: http://0.0.0.0:${port}/health`);
 
      // Schedule periodic IntuTrack location refresh (runs in background, does not block API).
      // No first-run on startup — refresh is triggered on login/register instead so the
      // server's boot path stays fast and the first refresh happens when a real user is present.
      const intervalMs = Number.parseInt(process.env.INTUTRACK_REFRESH_INTERVAL_MS || "600000", 10);
      if (Number.isFinite(intervalMs) && intervalMs > 0) {
        log(`Scheduling IntuTrack locations refresh every ${intervalMs / 1000}s`);
        setInterval(scheduleIntuTrackRefresh, intervalMs);
      }

      // Run migration in background (non-blocking) - optional
      // Uncomment if you want migrations to run after server is healthy
      /*
      storage.runDataMigration().catch(err => {
        console.error('[Migration] Background migration failed:', err);
      });
      */
    });
  };

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      log(`Port ${port} is in use, waiting for it to become available...`);
      setTimeout(() => {
        httpServer.close();
        startServer();
      }, 1000);
    } else {
      console.error('Server error:', err);
      clearTimeout(startupTimeout);
      process.exit(1);
    }
  });

  // Graceful shutdown handler
  const shutdown = () => {
    log('Shutting down gracefully...');
    isReady = false; // Mark as not ready during shutdown
    clearTimeout(startupTimeout);
    httpServer.close(() => {
      log('Server closed');
      process.exit(0);
    });
    // Force exit after 5 seconds if graceful shutdown fails
    setTimeout(() => {
      log('Forcing shutdown');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  
  // Handle uncaught exceptions and rejections
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit immediately - let health checks fail naturally
    isReady = false;
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit immediately - let health checks fail naturally
  });

  startServer();
})();

