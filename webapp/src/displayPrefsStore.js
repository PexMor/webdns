import { STORES, runStore } from "./webdnsDb.js";

const HELP_EXAMPLE_WRAP_KEY = "helpExampleWrap";
export const HELP_EXAMPLE_WRAP_MODES = ["nowrap", "wrap"];
const DEFAULT_HELP_EXAMPLE_WRAP = "nowrap";

export async function getHelpExampleWrap() {
  const record = await runStore(STORES.prefs, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(HELP_EXAMPLE_WRAP_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  });

  const value = record?.value;
  return HELP_EXAMPLE_WRAP_MODES.includes(value) ? value : DEFAULT_HELP_EXAMPLE_WRAP;
}

export async function setHelpExampleWrap(mode) {
  if (!HELP_EXAMPLE_WRAP_MODES.includes(mode)) {
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

export function applyHelpExampleWrap(mode) {
  const resolved = HELP_EXAMPLE_WRAP_MODES.includes(mode)
    ? mode
    : DEFAULT_HELP_EXAMPLE_WRAP;
  document.documentElement.dataset.helpExampleWrap = resolved;
}

export async function initHelpExampleWrap() {
  const mode = await getHelpExampleWrap();
  applyHelpExampleWrap(mode);
  return mode;
}

export async function saveHelpExampleWrap(mode) {
  await setHelpExampleWrap(mode);
  applyHelpExampleWrap(mode);
  return mode;
}
