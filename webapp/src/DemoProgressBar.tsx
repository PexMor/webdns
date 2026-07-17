import type { HistoryExportEntry } from "./lookupHistoryStore";

export interface DemoProgressBarProps {
  entries: HistoryExportEntry[];
  /** Zero-based index of the active demo step, or `null` before the first step. */
  currentIndex: number | null;
  autoplayRunning?: boolean;
  /** Seconds until the next autoplay step; shown in place of Next while replay runs. */
  autoplayCountdownSec?: number;
  autoplayIntervalMs?: number;
  onSelectStep?: (index: number) => void;
  onNextStep?: () => void;
}

export function DemoProgressBar({
  entries,
  currentIndex,
  autoplayRunning = false,
  autoplayCountdownSec = 0,
  autoplayIntervalMs = 5000,
  onSelectStep,
  onNextStep,
}: DemoProgressBarProps) {
  const total = entries.length;
  const activeIndex = currentIndex ?? -1;
  const manualNavigation = !autoplayRunning && Boolean(onSelectStep && onNextStep);
  const showCountdown = autoplayRunning && autoplayCountdownSec > 0;
  const countdownProgress =
    autoplayIntervalMs > 0
      ? Math.min(1, Math.max(0, 1 - (autoplayCountdownSec * 1000) / autoplayIntervalMs))
      : 0;
  const stepLabel =
    currentIndex === null ? `Not started · ${total} steps` : `Step ${currentIndex + 1} of ${total}`;
  const activeEntry = activeIndex >= 0 ? entries[activeIndex] : null;

  function segmentLabel(entry: HistoryExportEntry, index: number): string {
    return `Step ${index + 1}: ${entry.domain} (${entry.recordTypes.join(", ")})`;
  }

  function renderSegment(entry: HistoryExportEntry, index: number) {
    let state = "upcoming";
    if (index < activeIndex) state = "done";
    else if (index === activeIndex) state = "current";

    const className = `demo-progress__segment demo-progress__segment--${state}`;

    if (manualNavigation) {
      return (
        <button
          key={`${entry.domain}-${entry.recordTypes.join("+")}-${index}`}
          type="button"
          class={`${className} demo-progress__segment-btn`}
          title={segmentLabel(entry, index)}
          aria-label={segmentLabel(entry, index)}
          aria-current={index === activeIndex ? "step" : undefined}
          onClick={() => onSelectStep?.(index)}
        />
      );
    }

    return (
      <div
        key={`${entry.domain}-${entry.recordTypes.join("+")}-${index}`}
        class={className}
        title={segmentLabel(entry, index)}
      />
    );
  }

  return (
    <div class="demo-progress" role="status" aria-live="polite">
      <div class="demo-progress__header">
        <span class="demo-progress__title">Demo walkthrough</span>
        <span class="demo-progress__count">
          {stepLabel}
          {autoplayRunning && <span class="demo-progress__live"> · playing</span>}
        </span>
      </div>

      <div
        class="demo-progress__track"
        role={manualNavigation ? "group" : "progressbar"}
        aria-label={manualNavigation ? "Demo steps" : undefined}
        aria-valuemin={manualNavigation ? undefined : 0}
        aria-valuemax={manualNavigation ? undefined : total}
        aria-valuenow={manualNavigation ? undefined : currentIndex === null ? 0 : currentIndex + 1}
      >
        {entries.map((entry, index) => renderSegment(entry, index))}
      </div>

      <div class="demo-progress__footer">
        {activeEntry ? (
          <p class="demo-progress__query">
            <strong>{activeEntry.domain}</strong> ({activeEntry.recordTypes.join(", ")})
          </p>
        ) : (
          <p class="demo-progress__query demo-progress__query--hint">
            {autoplayRunning ? "Starting demo…" : "Click a step or Next to explore."}
          </p>
        )}
        {manualNavigation && (
          <button type="button" class="demo-progress__next" onClick={onNextStep}>
            Next
          </button>
        )}
        {showCountdown && (
          <button
            type="button"
            class="demo-progress__next demo-progress__next--countdown"
            disabled
            aria-live="polite"
            aria-label={`Next step in ${autoplayCountdownSec} seconds`}
            style={{ "--countdown-progress": String(countdownProgress) }}
          >
            <span class="demo-progress__next-fill" aria-hidden="true" />
            <span class="demo-progress__next-label">Next {autoplayCountdownSec}s</span>
          </button>
        )}
      </div>
    </div>
  );
}
