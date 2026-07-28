/**
 * Google Analytics 4 utility
 * Set VITE_GA_MEASUREMENT_ID in your .env to enable tracking.
 */

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

function isEnabled(): boolean {
  return !!GA_ID && typeof window !== "undefined" && typeof window.gtag === "function";
}

/** Inject the GA script tags into <head> — call once on app init */
export function initGA(): void {
  if (!GA_ID || typeof document === "undefined") return;
  if (document.getElementById("ga-script")) return; // already loaded
 
  const script1 = document.createElement("script");
  script1.id = "ga-script";
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script1);

  const script2 = document.createElement("script");
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_ID}', { send_page_view: false });
  `;
  document.head.appendChild(script2);
}

/** Track a page view — call on every route change */
export function trackPageView(path: string, title?: string): void {
  if (!isEnabled()) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: title || document.title,
    send_to: GA_ID,
  });
}

/** Track a custom event */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
): void {
  if (!isEnabled()) return;
  window.gtag("event", eventName, { ...params, send_to: GA_ID });
}

// Extend Window type for gtag
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}
