import { render } from "preact";
import { App } from "./app.jsx";
import buildInfo from "./build-info.json";
import { applyTheme, resolveEffectiveTheme } from "./themeStore.js";
import { applyHelpExampleWrap } from "./displayPrefsStore.js";
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

render(<App />, document.getElementById("app"));
