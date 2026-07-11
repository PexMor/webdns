import { render } from "preact";
import { App } from "./app";
import buildInfo from "./build-info.json";
import { applyTheme, resolveEffectiveTheme } from "./themeStore";
import { applyHelpExampleWrap } from "./displayPrefsStore";
import { loadConfig } from "./loadConfig";
import { probeSession } from "./authProbe";
import { clearAuthExpired, isAuthExpired, reportAuthExpired } from "./authProxyStore";
import "./style.css";

applyTheme("auto");
applyHelpExampleWrap("nowrap");
document.documentElement.dataset.effectiveTheme = resolveEffectiveTheme("auto");

console.log(
  `%c DNS Lookup %c v${buildInfo.version} %c ${buildInfo.gitHash} %c ${buildInfo.buildTime}`,
  "background:#38bdf8;color:#0f172a;font-weight:bold;padding:2px 6px;border-radius:3px",
  "color:#4ade80;font-weight:600",
  "color:#94a3b8",
  "color:#64748b;font-size:0.85em"
);

const rootElement = document.getElementById("app");
if (rootElement) {
  render(<App />, rootElement);
}

async function checkIdentityProxySession(): Promise<void> {
  const config = await loadConfig();
  if (!config.identityProxy.enabled) return;

  const wasExpired = isAuthExpired();
  const result = await probeSession(config.identityProxy.probePath);

  if (result === "expired") {
    reportAuthExpired();
    return;
  }
  if (result !== "ok") return;

  if (wasExpired) {
    // Recovered from an expired proxy session without a full top-level
    // navigation (e.g. the user signed in on another tab and this tab just
    // regained visibility): force a reload rather than trying to patch up
    // in-place state, so the WebSocket reconnects cleanly and the service
    // worker gets a chance to fetch any update it missed while gated.
    const registration = await navigator.serviceWorker?.getRegistration();
    await registration?.update().catch(() => {});
    window.location.reload();
    return;
  }

  clearAuthExpired();
}

checkIdentityProxySession();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    checkIdentityProxySession();
  }
});

navigator.serviceWorker?.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | undefined)?.type === "AUTH_EXPIRED") {
    reportAuthExpired();
  }
});
