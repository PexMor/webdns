import { STORES, runStore } from "./webdnsDb";
import type { PreferenceRecord } from "./types";

const THEME_KEY = "theme";
export const THEME_MODES = ["auto", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
const DEFAULT_THEME: ThemeMode = "auto";

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);
}

export async function getThemePreference(): Promise<ThemeMode> {
  const record = await runStore<PreferenceRecord<string> | null>(
    STORES.prefs,
    "readonly",
    (store) => {
      return new Promise<PreferenceRecord<string> | null>((resolve, reject) => {
        const req = store.get(THEME_KEY);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    }
  );

  const value = record?.value;
  return isThemeMode(value) ? value : DEFAULT_THEME;
}

export async function setThemePreference(mode: string): Promise<void> {
  if (!isThemeMode(mode)) {
    throw new Error(`Invalid theme: ${mode}`);
  }

  await runStore(STORES.prefs, "readwrite", (store) => {
    store.put({ key: THEME_KEY, value: mode, updatedAt: new Date().toISOString() });
  });
}

export function resolveEffectiveTheme(preference: ThemeMode): "light" | "dark" {
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(preference: ThemeMode): void {
  const effective = resolveEffectiveTheme(preference);
  document.documentElement.dataset.theme = preference;
  document.documentElement.dataset.effectiveTheme = effective;

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = effective === "dark" ? "#1e293b" : "#e2e8f0";
  }
}

type SystemThemeListener = {
  removeEventListener: (type: "change", handler: () => void) => void;
  handler: () => void;
};

let systemListener: SystemThemeListener | null = null;

export function watchSystemTheme(
  preference: ThemeMode,
  onChange?: (preference: ThemeMode, effective: "light" | "dark") => void
): void {
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

export async function initTheme(
  onChange?: (preference: ThemeMode, effective: "light" | "dark") => void
): Promise<ThemeMode> {
  const preference = await getThemePreference();
  applyTheme(preference);
  watchSystemTheme(preference, onChange);
  return preference;
}

export async function saveThemePreference(
  mode: string,
  onChange?: (preference: ThemeMode, effective: "light" | "dark") => void
): Promise<ThemeMode> {
  await setThemePreference(mode);
  const validated = mode as ThemeMode;
  applyTheme(validated);
  watchSystemTheme(validated, onChange);
  return validated;
}
