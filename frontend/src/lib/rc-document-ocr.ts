import { extractPdfFirstPageText, prepareFileForTesseract } from "@/lib/prepare-file-for-tesseract";

// Indian RC formats:
// - Classic: AA00AAA0000 (with practical variability)
// - BH series: 21BH1234AA
const RC_REGEX =
  /(?:[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}|\d{2}BH\d{4}[A-Z]{1,2})/;

/** Pull Indian RC-style registration from noisy text (OCR or PDF extract). */
export function extractRcFromCompactText(text: string): string {
  const compact = text.replace(/[\s\n\r\-\u00A0]/g, "").toUpperCase();
  const direct = compact.match(RC_REGEX)?.[0] || "";
  if (direct.length >= 6) return direct;

  // OCR confusion fallback for scanned PDFs/images.
  const chars = compact.split("");
  const normalized = chars
    .map((ch) => {
      // Common letter->digit confusions in OCR output.
      if (ch === "O" || ch === "Q" || ch === "D") return "0";
      if (ch === "I" || ch === "L" || ch === "|") return "1";
      if (ch === "Z") return "2";
      if (ch === "S") return "5";
      if (ch === "B") return "8";
      return ch;
    })
    .join("");

  const fallback = normalized.match(RC_REGEX)?.[0] || "";
  return fallback.length >= 6 ? fallback : "";
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/**
 * Downscale large camera photos so Tesseract finishes in reasonable time on mobile/desktop.
 */
function downscaleCanvas(canvas: HTMLCanvasElement, maxDim: number): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  if (w <= maxDim && h <= maxDim) return canvas;
  const scale = Math.min(maxDim / w, maxDim / h);
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const out = document.createElement("canvas");
  out.width = tw;
  out.height = th;
  const ctx = out.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(canvas, 0, 0, tw, th);
  return out;
}

export async function prepareImageForRcOcr(
  file: File,
  maxDim = 1600,
): Promise<File | HTMLCanvasElement> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file);
    try {
      const w = bmp.width;
      const h = bmp.height;
      if (w <= maxDim && h <= maxDim) return file;
      const scale = Math.min(maxDim / w, maxDim / h);
      const tw = Math.max(1, Math.round(w * scale));
      const th = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bmp, 0, 0, tw, th);
      return canvas;
    } finally {
      bmp.close?.();
    }
  } catch {
    return file;
  }
}

export type RcOcrResult =
  | { ok: true; rc: string; via: "pdf_text" | "tesseract" }
  | { ok: false; reason: "no_rc_found" | "ocr_failed"; detail?: string };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type TesseractWorker = Awaited<ReturnType<typeof import("tesseract.js").createWorker>>;

let sharedWorkerPromise: Promise<TesseractWorker> | null = null;
let sharedWorkerLastUsedAt = 0;

async function getSharedWorker(): Promise<TesseractWorker> {
  if (!sharedWorkerPromise) {
    sharedWorkerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return await createWorker("eng");
    })();
  }
  return sharedWorkerPromise;
}

async function safeTerminateSharedWorker(): Promise<void> {
  if (!sharedWorkerPromise) return;
  try {
    const worker = await sharedWorkerPromise;
    // terminate() itself can occasionally hang; don't block UI forever.
    await Promise.race([worker.terminate(), sleep(2000)]);
  } catch {
    /* ignore */
  } finally {
    sharedWorkerPromise = null;
    sharedWorkerLastUsedAt = 0;
  }
}

function maybeCleanupWorker(): void {
  // Keep worker warm for faster repeated OCR; clean up after 5 minutes idle.
  const now = Date.now();
  if (!sharedWorkerPromise) return;
  if (sharedWorkerLastUsedAt > 0 && now - sharedWorkerLastUsedAt > 5 * 60_000) {
    void safeTerminateSharedWorker();
  }
}

/**
 * Try PDF embedded text first, then Tesseract on raster (PDF page or image), with timeout.
 */
export async function runRcOcrOnFile(
  file: File,
  options?: { ocrTimeoutMs?: number },
): Promise<RcOcrResult> {
  // Desktop (Electron) often pays a big one-time WASM init cost; prefer a generous default and reuse the worker.
  const ocrTimeoutMs = options?.ocrTimeoutMs ?? 90_000;

  if (isPdfFile(file)) {
    try {
      const embedded = await extractPdfFirstPageText(file);
      const rc = extractRcFromCompactText(embedded);
      if (rc) return { ok: true, rc, via: "pdf_text" };
    } catch {
      /* fall through to raster + OCR */
    }
  }

  try {
    maybeCleanupWorker();
    const overallTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("OCR_TIMEOUT")), ocrTimeoutMs);
    });

    const work = (async () => {
      const prepared = await prepareFileForTesseract(file);
      let ocrInput: File | HTMLCanvasElement = prepared;
      if (prepared instanceof HTMLCanvasElement) {
        ocrInput = downscaleCanvas(prepared, 1800);
      } else if (prepared instanceof File && prepared.type.startsWith("image/")) {
        ocrInput = await prepareImageForRcOcr(prepared);
      }

      const worker = await getSharedWorker();
      sharedWorkerLastUsedAt = Date.now();

      const {
        data: { text },
      } = await worker.recognize(ocrInput);
      sharedWorkerLastUsedAt = Date.now();

      const rc = extractRcFromCompactText(text);
      if (rc) return { ok: true as const, rc, via: "tesseract" as const };
      return { ok: false as const, reason: "no_rc_found" as const };
    })();

    return await Promise.race([work, overallTimeout]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "OCR_TIMEOUT" || msg.includes("timed out")) {
      // Best-effort cleanup; don't await forever.
      void safeTerminateSharedWorker();
      return {
        ok: false,
        reason: "ocr_failed",
        detail:
          "Reading the document is taking too long. Use a smaller JPG/PNG (not HEIC), or enter the RC number manually.",
      };
    }
    // If OCR throws, reset the shared worker (it can get into a bad state).
    void safeTerminateSharedWorker();
    return {
      ok: false,
      reason: "ocr_failed",
      detail:
        "Could not read this file in the browser. Use JPG or PNG if you used HEIC/Live Photo, or enter the RC manually.",
    };
  }
}
