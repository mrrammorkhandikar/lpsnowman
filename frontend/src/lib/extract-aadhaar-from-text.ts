/** Verhoeff checksum used by UIDAI for Aadhaar (permutation index i%8 over reversed digits). */
function isValidAadhaarVerhoeff(num: string): boolean {
  if (!/^\d{12}$/.test(num)) return false;
  const d = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  ];
  const p = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
  ];
  let c = 0;
  const digits = num.split("").map(Number).reverse();
  for (let i = 0; i < 12; i++) {
    c = d[c][p[i % 8][digits[i]]];
  }
  return c === 0;
}

function collectTwelveDigitCandidates(raw: string, into: Set<string>) {
  const add = (chunk: string) => {
    const d = chunk.replace(/\D/g, "");
    if (d.length === 12 && !d.startsWith("0")) into.add(d);
  };

  const grouped = raw.match(/\d{4}[\s\-_.:/\\]+\d{4}[\s\-_.:/\\]+\d{4}/g);
  if (grouped) grouped.forEach(add);

  for (const m of raw.match(/\d{12}/g) || []) add(m);

  const slide = (source: string) => {
    const digitsOnly = source.replace(/\D/g, "");
    for (let i = 0; i + 12 <= digitsOnly.length; i++) {
      const chunk = digitsOnly.slice(i, i + 12);
      if (!chunk.startsWith("0")) into.add(chunk);
    }
  };
  slide(raw);

  const ocrFixed = raw
    .replace(/[Oo°]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/[Ss$]/g, "5")
    .replace(/[Zz]/g, "2")
    .replace(/B/g, "8")
    .replace(/[Gg@]/g, "9");
  slide(ocrFixed);
}

function uniqVerhoeffFromText(raw: string): string[] {
  const s = new Set<string>();
  collectTwelveDigitCandidates(raw, s);
  return Array.from(s).filter(isValidAadhaarVerhoeff);
}

function pickNearestAadhaarKeyword(cands: string[], raw: string): string {
  if (cands.length === 1) return cands[0];
  const lower = raw.toLowerCase();
  const anchor = lower.indexOf("aadhaar");
  const score = (num: string) => {
    const pos = raw.indexOf(num);
    if (pos < 0) return anchor >= 0 ? 9999 : 0;
    if (anchor < 0) return pos;
    return Math.abs(pos - anchor);
  };
  return [...cands].sort((a, b) => score(a) - score(b))[0];
}

/** Single unambiguous grouped pattern XXXX XXXX XXXX (UIDAI layout). */
function extractSingleGroupedTwelve(raw: string): string | null {
  const matches = raw.match(/\d{4}[\s\-_.:/\\]+\d{4}[\s\-_.:/\\]+\d{4}/g);
  if (!matches?.length) return null;
  const nums = Array.from(
    new Set(matches.map((m) => m.replace(/\D/g, ""))),
  ).filter(
    (d) => d.length === 12 && !d.startsWith("0"),
  );
  if (nums.length === 1) return nums[0];
  const verhoeffNums = nums.filter(isValidAadhaarVerhoeff);
  if (verhoeffNums.length === 1) return verhoeffNums[0];
  return null;
}

function looksLikeTextHeavyPdf(pdfText: string): boolean {
  const t = pdfText.replace(/\s+/g, " ").trim();
  return t.length >= 45 && /[a-zA-Z]{3,}/.test(t);
}

/**
 * Pick Aadhaar for PDF uploads: compare Verhoeff-valid candidates from embedded text
 * vs OCR. Agreement wins; on conflict, prefer embedded text for text-heavy PDFs
 * (true digital PDFs) and OCR for scan-only PDFs (photo-like, same as camera upload).
 */
export function resolveAadhaarFromPdfAndOcr(
  pdfText: string,
  ocrText: string,
): string | null {
  const p = uniqVerhoeffFromText(pdfText);
  const o = uniqVerhoeffFromText(ocrText);
  const oset = new Set(o);
  const agreed = p.filter((x) => oset.has(x));
  if (agreed.length === 1) return agreed[0];
  if (agreed.length > 1) return pickNearestAadhaarKeyword(agreed, ocrText + pdfText);

  if (p.length === 1 && o.length === 1) {
    if (p[0] === o[0]) return p[0];
    return looksLikeTextHeavyPdf(pdfText) ? p[0] : o[0];
  }
  if (p.length === 1 && o.length === 0) return p[0];
  if (o.length === 1 && p.length === 0) return o[0];

  if (p.length > 1) return pickNearestAadhaarKeyword(p, pdfText);
  if (o.length > 1) return pickNearestAadhaarKeyword(o, ocrText);

  const fromOcrGrouped = extractSingleGroupedTwelve(ocrText);
  if (fromOcrGrouped) return fromOcrGrouped;
  const fromPdfGrouped = extractSingleGroupedTwelve(pdfText);
  if (fromPdfGrouped) return fromPdfGrouped;

  return extractAadhaarDigitsFromTextAmbiguous(ocrText) ?? extractAadhaarDigitsFromTextAmbiguous(pdfText);
}

/**
 * When no Verhoeff match: only accept a single sliding-window candidate (avoids
 * picking a random wrong window from noisy OCR).
 */
function extractAadhaarDigitsFromTextAmbiguous(raw: string): string | null {
  if (!raw?.trim()) return null;
  const candidates = new Set<string>();
  collectTwelveDigitCandidates(raw, candidates);
  if (candidates.size === 0) return null;
  const list = Array.from(candidates);
  if (list.length === 1) return list[0];
  return null;
}

/**
 * Use OCR first, then PDF text (legacy path for non-PDF image-only flow).
 */
export function extractAadhaarFromOcrThenPdf(
  ocrText: string,
  pdfText: string,
): string | null {
  if (!pdfText?.trim()) {
    return extractAadhaarDigitsFromText(ocrText);
  }
  return resolveAadhaarFromPdfAndOcr(pdfText, ocrText);
}

/**
 * Best-effort 12-digit Aadhaar from one string (e.g. camera image OCR).
 * Prefers Verhoeff-valid candidates; avoids arbitrary picks when many windows match.
 */
export function extractAadhaarDigitsFromText(raw: string): string | null {
  if (!raw?.trim()) return null;

  const candidates = new Set<string>();
  collectTwelveDigitCandidates(raw, candidates);
  if (candidates.size === 0) return null;

  const list = Array.from(candidates);
  const verhoeffOk = list.filter(isValidAadhaarVerhoeff);
  if (verhoeffOk.length === 1) return verhoeffOk[0];
  if (verhoeffOk.length > 1) {
    return pickNearestAadhaarKeyword(verhoeffOk, raw);
  }

  const grouped = extractSingleGroupedTwelve(raw);
  if (grouped) return grouped;

  if (list.length === 1) return list[0];
  return null;
}
