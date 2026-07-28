import type { PDFPageProxy } from "pdfjs-dist";

export type PrepareTesseractOptions = {
  /** Higher scale improves OCR on small text (e.g. Aadhaar). Default 2.5. */
  scale?: number;
  /** Grayscale + contrast boost on rasterized PDF (helps Tesseract on faint scans). */
  enhanceContrast?: boolean;
};

function boostContrastGrayscale(source: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = source.getContext("2d");
  if (!ctx) return source;
  const { width, height } = source;
  if (width < 1 || height < 1) return source;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = y < 128 ? Math.max(0, y * 0.65) : Math.min(255, 55 + y * 0.85);
    const b = Math.round(v);
    d[i] = d[i + 1] = d[i + 2] = b;
  }
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const octx = out.getContext("2d");
  if (!octx) return source;
  octx.putImageData(img, 0, 0);
  return out;
}

async function withPdfFirstPage<T>(
  file: File,
  run: (page: PDFPageProxy) => Promise<T>,
): Promise<T> {
  const [{ getDocument, GlobalWorkerOptions }, workerMod] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);

  GlobalWorkerOptions.workerSrc = workerMod.default;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  try {
    const page = await pdf.getPage(1);
    return await run(page);
  } finally {
    await pdf.destroy();
  }
}

function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

/** Embedded text from page 1 (digital PDFs); empty for image-only PDFs. */
export async function extractPdfFirstPageText(file: File): Promise<string> {
  if (!isPdfFile(file)) return "";
  return withPdfFirstPage(file, async (page) => {
    const content = await page.getTextContent();
    return content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
  });
}

/**
 * Tesseract.js recognizes images (and some blobs), not PDF pages. Rasterize the first
 * PDF page to a canvas so OCR works for uploaded PDFs.
 */
export async function prepareFileForTesseract(
  file: File,
  opts?: PrepareTesseractOptions,
): Promise<File | HTMLCanvasElement> {
  if (!isPdfFile(file)) return file;

  const scale = opts?.scale ?? 2.5;

  return withPdfFirstPage(file, async (page) => {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas context");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return opts?.enhanceContrast ? boostContrastGrayscale(canvas) : canvas;
  });
}
