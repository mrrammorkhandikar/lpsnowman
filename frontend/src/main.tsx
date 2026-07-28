import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { initGA } from "./lib/analytics";

initGA();

const hideInitialLoader = () => {
  const loader = document.getElementById("initial-loader");
  if (loader) {
    loader.style.opacity = "0";
    loader.addEventListener("transitionend", () => loader.remove(), { once: true });
    setTimeout(() => loader.remove(), 500);
  }
};

const rootEl = document.getElementById("root");
if (!rootEl) {
  hideInitialLoader();
  throw new Error("Root element #root not found");
}

try {
  createRoot(rootEl).render(<App />);
} catch (error) {
  console.error("Failed to mount React app:", error);
  rootEl.innerHTML =
    '<div style="padding:2rem;font-family:Inter,system-ui,sans-serif;max-width:32rem;margin:0 auto">' +
    "<h1 style=\"font-size:1.25rem;font-weight:600;margin-bottom:0.5rem\">Load Pilot failed to start</h1>" +
    "<p style=\"color:#71717a;font-size:0.875rem\">Refresh the page. If this persists, ensure both dev servers are running " +
    "(backend on port 5000, frontend on port 5173).</p></div>";
} finally {
  hideInitialLoader();
}
