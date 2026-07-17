import { parseImportedHistoryText } from "./historyImportFormat";
import {
  historyEntriesMatch,
  parseHistoryImportEntry,
  type HistoryExportEntry,
  type LookupHistoryInput,
} from "./lookupHistoryStore";
import type { DnsQueryResponse } from "./types";

export interface DemoDataset {
  entries: HistoryExportEntry[];
}

export interface DemoReplayResult {
  response: DnsQueryResponse | null;
  error: string | null;
}

/** Drop later demo steps that repeat an identical query (same rules as history dedup). */
export function dedupeDemoEntries(entries: HistoryExportEntry[]): HistoryExportEntry[] {
  const unique: HistoryExportEntry[] = [];

  for (const entry of entries) {
    if (unique.some((existing) => historyEntriesMatch(existing, entry))) {
      continue;
    }
    unique.push(entry);
  }

  return unique;
}

export async function loadDemoDataset(dataUrl: string): Promise<DemoDataset> {
  const res = await fetch(dataUrl);
  if (!res.ok) {
    throw new Error(`Failed to load demo data (${res.status})`);
  }

  const text = await res.text();
  const rawEntries = parseImportedHistoryText(text);
  const entries: HistoryExportEntry[] = [];

  for (const raw of rawEntries) {
    const parsed = parseHistoryImportEntry(raw);
    if (!parsed) continue;

    const rawTimestamp = (raw as Record<string, unknown> | null)?.timestamp;
    const timestamp =
      typeof rawTimestamp === "string" && !Number.isNaN(Date.parse(rawTimestamp))
        ? rawTimestamp
        : new Date().toISOString();

    entries.push({ ...parsed, timestamp });
  }

  const deduped = dedupeDemoEntries(entries);

  if (deduped.length === 0) {
    throw new Error("Demo data file contains no valid entries");
  }

  return { entries: deduped };
}

export function findDemoMatch(
  dataset: DemoDataset,
  query: LookupHistoryInput
): HistoryExportEntry | null {
  const index = findDemoEntryIndex(dataset, query);
  return index >= 0 ? dataset.entries[index] : null;
}

export function findDemoEntryIndex(dataset: DemoDataset, query: LookupHistoryInput): number {
  return dataset.entries.findIndex((entry) => historyEntriesMatch(entry, query));
}

export function replayDemoEntry(
  entry: HistoryExportEntry,
  queryName: string
): DemoReplayResult {
  if (entry.responseError) {
    return { response: null, error: entry.responseError };
  }

  return {
    response: {
      domain: queryName,
      results: entry.results ?? [],
    },
    error: null,
  };
}

export function demoReplayDelay(minMs = 300, maxMs = 600): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Index of the next manual/autoplay step; wraps to 0 after the last entry. */
export function demoNextStepIndex(currentIndex: number | null, total: number): number {
  if (total <= 0) return 0;
  if (currentIndex === null) return 0;
  return (currentIndex + 1) % total;
}

export type DemoAutoplayEntryHandler = (entry: HistoryExportEntry) => void;
export type DemoAutoplayCountdownHandler = (secondsRemaining: number) => void;

export interface DemoAutoplayStartOptions {
  /** Fire the step at `fromIndex` immediately, then wait the interval before the next one. */
  immediate?: boolean;
}

/** Steps through demo entries on a fixed interval; supports user stop/resume. */
export class DemoAutoplay {
  private stepTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private countdownEndsAt = 0;
  private index = 0;
  private pausedByUser = false;
  private pausedForReplay = false;

  constructor(
    private readonly entries: HistoryExportEntry[],
    private readonly intervalMs: number,
    private readonly onEntry: DemoAutoplayEntryHandler,
    private readonly onCountdown?: DemoAutoplayCountdownHandler
  ) {}

  start(fromIndex = 0, { immediate = false }: DemoAutoplayStartOptions = {}): void {
    this.pausedByUser = false;
    this.pausedForReplay = false;
    this.index = fromIndex;
    this.clearTimers();
    if (!this.entries.length) return;

    if (immediate) {
      this.fireCurrent();
    }
    this.scheduleStep(this.intervalMs);
  }

  stop(): void {
    this.pausedByUser = true;
    this.pausedForReplay = false;
    this.clearTimers();
  }

  resume(): void {
    if (!this.entries.length) return;
    this.pausedByUser = false;
    this.start(this.index);
  }

  isRunning(): boolean {
    return !this.pausedByUser && this.stepTimer !== null;
  }

  pauseForReplay(): void {
    if (this.pausedByUser) return;
    this.pausedForReplay = true;
    this.clearTimers();
  }

  resumeAfterReplay(): void {
    if (this.pausedByUser || !this.pausedForReplay) return;
    this.pausedForReplay = false;
    this.scheduleStep(this.intervalMs);
  }

  /** Keep autoplay aligned after the user manually plays a step. */
  alignAfterManualStep(playedIndex: number): void {
    if (!this.entries.length) return;
    this.index = (playedIndex + 1) % this.entries.length;
  }

  private scheduleStep(delayMs: number): void {
    this.clearStepTimer();
    this.beginCountdown(delayMs);
    this.stepTimer = setTimeout(() => {
      this.clearCountdownTimer();
      this.fireCurrent();
      if (!this.pausedByUser && !this.pausedForReplay) {
        this.scheduleStep(this.intervalMs);
      }
    }, delayMs);
  }

  private beginCountdown(durationMs: number): void {
    this.countdownEndsAt = Date.now() + durationMs;
    this.clearCountdownTimer();
    this.emitCountdown();
    this.countdownTimer = setInterval(() => this.emitCountdown(), 200);
  }

  private emitCountdown(): void {
    if (!this.onCountdown) return;
    const remainingMs = Math.max(0, this.countdownEndsAt - Date.now());
    this.onCountdown(Math.ceil(remainingMs / 1000));
  }

  private fireCurrent(): void {
    const entry = this.entries[this.index];
    this.onEntry(entry);
    this.index = (this.index + 1) % this.entries.length;
  }

  private clearStepTimer(): void {
    if (this.stepTimer !== null) {
      clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
  }

  private clearCountdownTimer(): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.onCountdown?.(0);
  }

  private clearTimers(): void {
    this.clearStepTimer();
    this.clearCountdownTimer();
  }
}
