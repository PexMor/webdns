import { STORES, runStore } from "./webdnsDb";
import type { PreferenceRecord } from "./types";

const HELP_EXAMPLE_WRAP_KEY = "helpExampleWrap";
export const HELP_EXAMPLE_WRAP_MODES = ["nowrap", "wrap"] as const;
export type HelpExampleWrapMode = (typeof HELP_EXAMPLE_WRAP_MODES)[number];
const DEFAULT_HELP_EXAMPLE_WRAP: HelpExampleWrapMode = "nowrap";

function isHelpExampleWrapMode(value: unknown): value is HelpExampleWrapMode {
  return (
    typeof value === "string" &&
    (HELP_EXAMPLE_WRAP_MODES as readonly string[]).includes(value)
  );
}

export async function getHelpExampleWrap(): Promise<HelpExampleWrapMode> {
  const record = await runStore<PreferenceRecord<string> | null>(
    STORES.prefs,
    "readonly",
    (store) => {
      return new Promise<PreferenceRecord<string> | null>((resolve, reject) => {
        const req = store.get(HELP_EXAMPLE_WRAP_KEY);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    }
  );

  const value = record?.value;
  return isHelpExampleWrapMode(value) ? value : DEFAULT_HELP_EXAMPLE_WRAP;
}

export async function setHelpExampleWrap(mode: string): Promise<void> {
  if (!isHelpExampleWrapMode(mode)) {
    throw new Error(`Invalid help example wrap mode: ${mode}`);
  }

  await runStore(STORES.prefs, "readwrite", (store) => {
    store.put({
      key: HELP_EXAMPLE_WRAP_KEY,
      value: mode,
      updatedAt: new Date().toISOString(),
    });
  });
}

export function applyHelpExampleWrap(mode: string): void {
  const resolved = isHelpExampleWrapMode(mode) ? mode : DEFAULT_HELP_EXAMPLE_WRAP;
  document.documentElement.dataset.helpExampleWrap = resolved;
}

export async function initHelpExampleWrap(): Promise<HelpExampleWrapMode> {
  const mode = await getHelpExampleWrap();
  applyHelpExampleWrap(mode);
  return mode;
}

export async function saveHelpExampleWrap(mode: string): Promise<HelpExampleWrapMode> {
  await setHelpExampleWrap(mode);
  const validated = mode as HelpExampleWrapMode;
  applyHelpExampleWrap(validated);
  return validated;
}
