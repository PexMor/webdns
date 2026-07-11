import { STORES, runStore } from "./webdnsDb.js";

const THEME_KEY = "theme";
export const THEME_MODES = ["auto", "light", "dark"];
const DEFAULT_THEME = "auto";

export async function getThemePreference() {
  const record = await runStore(STORES.prefs, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(THEME_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  });

  const value = record?.value;
  return THEME_MODES.includes(value) ? value : DEFAULT_THEME;
}

export async function setThemePreference(mode) {
  if (!THEME_MODES.includes(mode)) {
    throw new Error(`Invalid theme: ${mode}`);
  }

  await runStore(STORES.prefs, "readwrite", (store) => {
    store.put({ key: THEME_KEY, value: mode, updatedAt: new Date().toISOString() });
  });
}

export function resolveEffectiveTheme(preference) {
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(preference) {
  const effective = resolveEffectiveTheme(preference);
  document.documentElement.dataset.theme = preference;
  document.documentElement.dataset.effectiveTheme = effective;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = effective === "dark" ? "#1e293b" : "#e2e8f0";
  }
}

let systemListener = null;

export function watchSystemTheme(preference, onChange) {
  if (systemListener) {
    systemListener.removeEventListener("change", systemListener.handler);
    systemListener = null;
  }

  if (preference !== "auto") return;

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    applyTheme("auto");
    onChange?.("auto", resolveEffectiveTheme("auto"));
  };

  media.addEventListener("change", handler);
  systemListener = { removeEventListener: media.removeEventListener.bind(media), handler };
}

export async function initTheme(onChange) {
  const preference = await getThemePreference();
  applyTheme(preference);
  watchSystemTheme(preference, onChange);
  return preference;
}

export async function saveThemePreference(mode, onChange) {
  await setThemePreference(mode);
  applyTheme(mode);
  watchSystemTheme(mode, onChange);
  return mode;
}
