import { STORES, runStore } from "./webdnsDb";
import { DETAIL_LEVELS, type DetailLevel } from "./rr/types";
import type { PreferenceRecord } from "./types";

const DETAIL_LEVEL_KEY = "rrDetailLevel";
const DEFAULT_DETAIL_LEVEL: DetailLevel = "standard";

export const RR_VIEW_MODES = ["parsed", "raw"] as const;
export type RrViewMode = (typeof RR_VIEW_MODES)[number];
const RR_VIEW_MODE_KEY = "rrDefaultViewMode";
const DEFAULT_RR_VIEW_MODE: RrViewMode = "parsed";

function isDetailLevel(value: unknown): value is DetailLevel {
  return typeof value === "string" && (DETAIL_LEVELS as readonly string[]).includes(value);
}

function isRrViewMode(value: unknown): value is RrViewMode {
  return typeof value === "string" && (RR_VIEW_MODES as readonly string[]).includes(value);
}

async function getPref<T extends string>(key: string): Promise<T | null> {
  const record = await runStore<PreferenceRecord<string> | null>(
    STORES.prefs,
    "readonly",
    (store) => {
      return new Promise<PreferenceRecord<string> | null>((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    }
  );
  return (record?.value as T | undefined) ?? null;
}

async function setPref(key: string, value: string): Promise<void> {
  await runStore(STORES.prefs, "readwrite", (store) => {
    store.put({ key, value, updatedAt: new Date().toISOString() });
  });
}

export async function getRrDetailLevel(): Promise<DetailLevel> {
  const value = await getPref<DetailLevel>(DETAIL_LEVEL_KEY);
  return isDetailLevel(value) ? value : DEFAULT_DETAIL_LEVEL;
}

export async function setRrDetailLevel(level: string): Promise<DetailLevel> {
  if (!isDetailLevel(level)) {
    throw new Error(`Invalid RR detail level: ${level}`);
  }
  await setPref(DETAIL_LEVEL_KEY, level);
  return level;
}

export async function getRrDefaultViewMode(): Promise<RrViewMode> {
  const value = await getPref<RrViewMode>(RR_VIEW_MODE_KEY);
  return isRrViewMode(value) ? value : DEFAULT_RR_VIEW_MODE;
}

export async function setRrDefaultViewMode(mode: string): Promise<RrViewMode> {
  if (!isRrViewMode(mode)) {
    throw new Error(`Invalid RR view mode: ${mode}`);
  }
  await setPref(RR_VIEW_MODE_KEY, mode);
  return mode;
}

export interface RrViewPrefs {
  detailLevel: DetailLevel;
  defaultViewMode: RrViewMode;
}

export async function initRrViewPrefs(): Promise<RrViewPrefs> {
  const [detailLevel, defaultViewMode] = await Promise.all([
    getRrDetailLevel(),
    getRrDefaultViewMode(),
  ]);
  return { detailLevel, defaultViewMode };
}
