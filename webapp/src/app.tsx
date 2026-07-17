import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { listCustomServers } from "./dnsServerStore";
import {
  buildDnsServerOptions,
  deriveWsUrlFromHttp,
  getResolvedWsUrls,
  getStoredHttpServerUrl,
  loadConfig,
  mergeHeaderSuggestions,
  pickInitialDnsServer,
  pickInitialWsUrl,
  resolveDnsAddress,
  setStoredDnsServer,
  setStoredHttpServerUrl,
  setStoredWsUrl,
} from "./loadConfig";
import { initTheme, saveThemePreference, type ThemeMode } from "./themeStore";
import { initHelpExampleWrap, saveHelpExampleWrap, type HelpExampleWrapMode } from "./displayPrefsStore";
import {
  initRrViewPrefs,
  setRrDefaultViewMode,
  setRrDetailLevel,
  type RrViewMode,
} from "./rrViewPrefsStore";
import type { DetailLevel, FollowUpQuery } from "./rr";
import { addHistoryEntry, importHistory, listHistory } from "./lookupHistoryStore";
import {
  DemoAutoplay,
  demoNextStepIndex,
  demoReplayDelay,
  findDemoEntryIndex,
  findDemoMatch,
  loadDemoDataset,
  replayDemoEntry,
  type DemoDataset,
} from "./demoMode";
import { DemoProgressBar } from "./DemoProgressBar";
import { getLookupForm, saveLookupForm } from "./lookupFormStore";
import {
  initExpandRecordTypesByDefault,
  setExpandRecordTypesByDefault,
} from "./queryFormPrefsStore";
import { listQuickLookups } from "./quickLookupStore";
import { listWsHeaders, migrateLegacyApiKey } from "./wsHeaderStore";
import { Menu, formatHistoryTime, type LookupSetup, type MenuPanel } from "./menu";
import { MailDnsCheckReportView } from "./MailDnsCheckReportView";
import {
  runMailDnsCheck,
  type MailDnsCheckProgress,
  type MailDnsCheckReport,
} from "./mailDnsCheck";
import { parseDkimSelectorsInput } from "./mailDnsCheck/queryHelpers";
import { useDnsSocket } from "./useDnsSocket";
import { conventionTooltip, recordTypeForConvention } from "./recordTypes";
import { RecordResultCard } from "./RecordResultCard";
import { RecordTypeGroups } from "./RecordTypeGroups";
import { RecordTypeHelpModal } from "./RecordTypeHelpModal";
import { RecordTypePicker } from "./RecordTypePicker";
import { QueryInputPreview } from "./QueryInputPreview";
import { SrvFieldsInput, TlsaFieldsInput } from "./SrvTlsaFields";
import {
  DEFAULT_SRV_FIELDS,
  DEFAULT_TLSA_FIELDS,
  engagedConvention,
  transformQueryInput,
  type SrvFields,
  type TlsaFields,
  type TransformResult,
} from "./queryTransforms";
import { AuthExpiredOverlay } from "./AuthExpiredOverlay";
import { humanizeRequestError } from "./formatRecordResult";
import { decodeQueryFragment, encodeQueryFragment, type UrlQueryState } from "./urlQueryFragment";
import type {
  CustomDnsServer,
  DnsQueryResponse,
  DnsServerOption,
  LookupHistoryEntry,
  QuickLookup,
  RuntimeConfig,
  WsHeader,
} from "./types";

const DEFAULT_SELECTED = new Set(["A", "AAAA"]);

interface DnsOverrideNotice {
  source: string;
  name: string | null | undefined;
  requested: string;
  applied: string;
  label: string;
  unavailable: boolean;
}

interface PendingExecute {
  domain: string;
  recordTypes: string[];
  dnsServerAddress: string;
  dnsServerResolved: string;
  enumMode: boolean;
  srvFields: SrvFields;
  tlsaFields: TlsaFields;
}

interface ExecuteLookupResult {
  sent: boolean;
  error?: string;
}

export function App() {
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [customServers, setCustomServers] = useState<CustomDnsServer[]>([]);
  const [quickLookups, setQuickLookups] = useState<QuickLookup[]>([]);
  const [selectedWsUrl, setSelectedWsUrl] = useState("");
  const [httpServerUrl, setHttpServerUrl] = useState("");
  const [selectedDnsAddress, setSelectedDnsAddress] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPanel, setMenuPanel] = useState<MenuPanel>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [connectionHeaders, setConnectionHeaders] = useState<WsHeader[]>([]);
  const [defaultHeaderSuggestions, setDefaultHeaderSuggestions] = useState<WsHeader[]>([]);
  const [themePreference, setThemePreference] = useState<ThemeMode>("auto");
  const [helpExampleWrap, setHelpExampleWrap] = useState<HelpExampleWrapMode>("nowrap");
  const [rrDetailLevel, setRrDetailLevelState] = useState<DetailLevel>("standard");
  const [rrDefaultViewMode, setRrDefaultViewModeState] = useState<RrViewMode>("parsed");
  const [expandRecordTypesByDefault, setExpandRecordTypesByDefaultState] = useState(false);
  const [recordTypesFolded, setRecordTypesFolded] = useState(true);
  const [recordTypePickerOpen, setRecordTypePickerOpen] = useState(false);

  const [domain, setDomain] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(DEFAULT_SELECTED);
  const [enumMode, setEnumMode] = useState(false);
  const [srvFields, setSrvFields] = useState<SrvFields>(DEFAULT_SRV_FIELDS);
  const [tlsaFields, setTlsaFields] = useState<TlsaFields>(DEFAULT_TLSA_FIELDS);
  const [previewResult, setPreviewResult] = useState<TransformResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [helpRecordType, setHelpRecordType] = useState<string | null>(null);
  const [dnsOverrideNotice, setDnsOverrideNotice] = useState<DnsOverrideNotice | null>(null);
  const [pendingExecute, setPendingExecute] = useState<PendingExecute | null>(null);
  const [viewingHistoryEntry, setViewingHistoryEntry] = useState<LookupHistoryEntry | null>(null);
  const [lastExecutedDnsResolved, setLastExecutedDnsResolved] = useState("");
  const [pendingUrlSetup, setPendingUrlSetup] = useState<UrlQueryState | null>(null);
  const [demoDataset, setDemoDataset] = useState<DemoDataset | null>(null);
  const [demoReady, setDemoReady] = useState(false);
  const [demoLoadError, setDemoLoadError] = useState<string | null>(null);
  const [demoResponse, setDemoResponse] = useState<DnsQueryResponse | null>(null);
  const [demoErrorMessage, setDemoErrorMessage] = useState<string | null>(null);
  const [autoplayRunning, setAutoplayRunning] = useState(false);
  const [autoplayCountdownSec, setAutoplayCountdownSec] = useState(0);
  const [demoProgressIndex, setDemoProgressIndex] = useState<number | null>(null);
  const [mailDnsReport, setMailDnsReport] = useState<MailDnsCheckReport | null>(null);
  const [mailDnsCheckRunning, setMailDnsCheckRunning] = useState(false);
  const [mailDnsCheckProgress, setMailDnsCheckProgress] = useState<MailDnsCheckProgress | null>(
    null
  );
  const [mailDnsCheckError, setMailDnsCheckError] = useState<string | null>(null);

  const pendingHistoryRef = useRef<PendingExecute | null>(null);
  const autoplayRef = useRef<DemoAutoplay | null>(null);

  const isDemoMode = config?.demo.enabled === true;

  const resolvedWsUrls = useMemo(
    () => (config ? getResolvedWsUrls(config.wsUrls) : []),
    [config]
  );

  const effectiveWsUrl = useMemo(() => {
    const derived = deriveWsUrlFromHttp(httpServerUrl);
    return derived || selectedWsUrl;
  }, [httpServerUrl, selectedWsUrl]);

  const dnsOptions: DnsServerOption[] = useMemo(
    () =>
      config
        ? buildDnsServerOptions(config.dnsServers, customServers, effectiveWsUrl)
        : [],
    [config, customServers, effectiveWsUrl]
  );

  const selectedDnsResolved = useMemo(() => {
    const match = dnsOptions.find((option) => option.address === selectedDnsAddress);
    return match?.resolvedAddress ?? resolveDnsAddress(selectedDnsAddress, effectiveWsUrl);
  }, [dnsOptions, selectedDnsAddress, effectiveWsUrl]);

  const engagedConventionId = useMemo(
    () =>
      engagedConvention({
        recordTypes: Array.from(selectedTypes),
        domain,
        enumMode,
        srvFields,
        tlsaFields,
      }),
    [selectedTypes, domain, enumMode, srvFields, tlsaFields]
  );

  const engagedRecordType = useMemo(
    () => (engagedConventionId ? recordTypeForConvention(engagedConventionId) : null),
    [engagedConventionId]
  );

  // Types other than the engaged one that must be deselected before submitting
  // (already-checked selections are never silently cleared — see design.md).
  const blockingTypes = useMemo(
    () =>
      engagedRecordType
        ? Array.from(selectedTypes).filter((type) => type !== engagedRecordType)
        : [],
    [engagedRecordType, selectedTypes]
  );

  function isRecordTypeCheckboxDisabled(type: string): boolean {
    if (!engagedConventionId || type === engagedRecordType) return false;
    // Still allow unchecking an already-selected incompatible type.
    return !selectedTypes.has(type);
  }

  function recordTypeTitle(type: string): string | undefined {
    if (isRecordTypeCheckboxDisabled(type)) {
      return `Disabled — ${engagedRecordType} is using a transformed query right now. Uncheck it or clear its input to select ${type}.`;
    }
    return conventionTooltip(type) ?? undefined;
  }

  // Reported live by QueryInputPreview as the engaged convention's input is
  // (in)validated, so submission can be blocked proactively rather than only
  // after a failed submit attempt.
  const previewError = previewResult && "error" in previewResult ? previewResult.error : null;

  const { status, statusLabel, hasApiKey, response, errorMessage, saveApiKey, saveConnectionHeaders, query, queryAsync } =
    useDnsSocket(effectiveWsUrl, {
      connectionHeaders,
      queryMap: config?.wsHeaderQueryMap ?? {},
      credentialsReady: ready && !isDemoMode,
      identityProxy: config?.identityProxy,
    });

  const activeResponse = isDemoMode ? demoResponse : response;
  const activeErrorMessage = isDemoMode ? demoErrorMessage : errorMessage;

  const displayStatus = isDemoMode
    ? demoLoadError
      ? "error"
      : demoReady
        ? "demo"
        : "connecting"
    : status;

  const displayStatusLabel = isDemoMode
    ? demoLoadError
      ? `demo data failed: ${demoLoadError}`
      : demoReady
        ? "Demo mode"
        : "Loading demo…"
    : statusLabel;

  const canQuery = isDemoMode ? demoReady : status === "connected";

  useEffect(() => {
    async function init() {
      const theme = await initTheme();
      const exampleWrap = await initHelpExampleWrap();
      const rrViewPrefs = await initRrViewPrefs();
      const expandByDefault = await initExpandRecordTypesByDefault();
      const loaded = await loadConfig();
      const custom = await listCustomServers();
      const presets = await listQuickLookups();
      const savedForm = await getLookupForm();
      await migrateLegacyApiKey();
      const headers = await listWsHeaders();
      const httpUrl = getStoredHttpServerUrl();
      const wsUrls = getResolvedWsUrls(loaded.wsUrls);
      const wsUrl = pickInitialWsUrl(wsUrls, httpUrl) ?? "";
      const options = buildDnsServerOptions(loaded.dnsServers, custom, wsUrl);
      const dnsAddress = pickInitialDnsServer(options);

      setConfig(loaded);
      setCustomServers(custom);
      setQuickLookups(presets);
      setConnectionHeaders(headers);
      setDefaultHeaderSuggestions(mergeHeaderSuggestions(headers, loaded.wsConnectionHeaders));
      setThemePreference(theme);
      setHelpExampleWrap(exampleWrap);
      setRrDetailLevelState(rrViewPrefs.detailLevel);
      setRrDefaultViewModeState(rrViewPrefs.defaultViewMode);
      setExpandRecordTypesByDefaultState(expandByDefault);
      setRecordTypesFolded(!expandByDefault);
      setHttpServerUrl(httpUrl);
      setSelectedWsUrl(wsUrl);
      setSelectedDnsAddress(dnsAddress);
      setDomain(savedForm.domain);
      setSelectedTypes(new Set(savedForm.recordTypes));
      setEnumMode(savedForm.enumMode ?? false);
      setSrvFields(savedForm.srvFields ?? DEFAULT_SRV_FIELDS);
      setTlsaFields(savedForm.tlsaFields ?? DEFAULT_TLSA_FIELDS);
      setPendingUrlSetup(decodeQueryFragment(window.location.hash));

      if (loaded.demo.enabled) {
        try {
          const dataset = await loadDemoDataset(loaded.demo.dataUrl);
          setDemoDataset(dataset);
          setDemoReady(true);
          setDemoLoadError(null);

          const existingHistory = await listHistory();
          if (existingHistory.length === 0) {
            await importHistory(dataset.entries as unknown[]);
          }
        } catch (err) {
          setDemoLoadError(err instanceof Error ? err.message : "Failed to load demo data");
          setDemoReady(false);
        }
      }

      setReady(true);
    }

    init();
  }, []);

  // Browser back/forward moves between the URL fragments each executed
  // lookup pushes (see executeLookup below) — re-decode and stage the target
  // query so the effect below can apply it once dnsOptions are ready.
  useEffect(() => {
    function handlePopState() {
      setPendingUrlSetup(decodeQueryFragment(window.location.hash));
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!ready || !pendingUrlSetup || !dnsOptions.length) return;

    const { dnsServerAddress, ...rest } = pendingUrlSetup;
    applyLookupSetup({
      ...rest,
      includeDnsServer: Boolean(dnsServerAddress),
      dnsServerAddress: dnsServerAddress ?? null,
      overrideSource: "url",
      autoExecute: true,
    });
    setPendingUrlSetup(null);
  }, [ready, pendingUrlSetup, dnsOptions]);

  useEffect(() => {
    if (!ready) return;

    saveLookupForm({
      domain,
      recordTypes: Array.from(selectedTypes),
      enumMode,
      srvFields,
      tlsaFields,
    }).catch((err) => {
      console.error("[form] failed to save lookup form", err);
    });
  }, [domain, selectedTypes, enumMode, srvFields, tlsaFields, ready]);

  useEffect(() => {
    if (!ready || !dnsOptions.length) return;

    if (!dnsOptions.some((option) => option.address === selectedDnsAddress)) {
      const next = pickInitialDnsServer(dnsOptions);
      setSelectedDnsAddress(next);
      setStoredDnsServer(next);
    }
  }, [dnsOptions, selectedDnsAddress, ready]);

  useEffect(() => {
    if (!pendingHistoryRef.current) return;
    if (!activeResponse && !activeErrorMessage) return;

    const entry = pendingHistoryRef.current;
    pendingHistoryRef.current = null;
    addHistoryEntry({
      ...entry,
      results: activeResponse?.results,
      responseError: activeResponse ? undefined : activeErrorMessage ?? undefined,
    }).catch((err) => {
      console.error("[history] failed to save entry", err);
    });
  }, [activeResponse, activeErrorMessage]);

  useEffect(() => {
    if (!pendingExecute) return;

    if (!canQuery) {
      setFormError(isDemoMode ? "Demo data is not ready." : "Not connected to the server.");
      setPendingExecute(null);
      return;
    }

    const recordTypes = pendingExecute.recordTypes;
    if (recordTypes.length === 0) {
      setFormError("Select at least one record type.");
      setPendingExecute(null);
      return;
    }

    const dnsAddr = pendingExecute.dnsServerAddress ?? selectedDnsAddress;
    const match = dnsOptions.find((option) => option.address === dnsAddr);
    const resolved =
      pendingExecute.dnsServerResolved ??
      match?.resolvedAddress ??
      resolveDnsAddress(dnsAddr, effectiveWsUrl);

    executeLookup({
      domain: pendingExecute.domain,
      recordTypes,
      dnsServerAddress: dnsAddr,
      dnsServerResolved: resolved,
      enumMode: pendingExecute.enumMode,
      srvFields: pendingExecute.srvFields,
      tlsaFields: pendingExecute.tlsaFields,
    }).then(({ sent, error }) => {
      if (error) {
        setFormError(error);
      } else if (!sent) {
        setFormError(
          isDemoMode ? "No matching demo response for this query." : "Not connected to the server."
        );
      }
    });

    setPendingExecute(null);
  }, [pendingExecute, canQuery, isDemoMode, dnsOptions, effectiveWsUrl]);

  useEffect(() => {
    if (!isDemoMode || !demoReady || !demoDataset || !config?.demo.autoplay.enabled) return;
    if (autoplayRef.current) return;

    const autoplay = new DemoAutoplay(
      demoDataset.entries,
      config.demo.autoplay.intervalMs,
      (entry) => {
        applyLookupSetup({
          domain: entry.domain,
          recordTypes: entry.recordTypes,
          includeDnsServer: true,
          dnsServerAddress: entry.dnsServerAddress,
          enumMode: entry.enumMode,
          srvFields: entry.srvFields,
          tlsaFields: entry.tlsaFields,
          overrideSource: "demo-autoplay",
          autoExecute: true,
        });
        closeMenu();
      },
      (seconds) => setAutoplayCountdownSec(seconds)
    );
    autoplayRef.current = autoplay;
    autoplay.start(0, { immediate: true });
    setAutoplayRunning(true);

    return () => {
      autoplay.stop();
      autoplayRef.current = null;
      setAutoplayCountdownSec(0);
    };
  }, [isDemoMode, demoReady, demoDataset, config?.demo.autoplay.enabled, config?.demo.autoplay.intervalMs]);

  function dnsServerLabel(address: string): string {
    const match = dnsOptions.find((option) => option.address === address);
    if (!match) return address;
    return `${match.label} (${match.resolvedAddress})`;
  }

  function applyLookupSetup({
    domain: nextDomain,
    recordTypes,
    dnsServerAddress,
    includeDnsServer = false,
    enumMode: nextEnumMode = false,
    srvFields: nextSrvFields = DEFAULT_SRV_FIELDS,
    tlsaFields: nextTlsaFields = DEFAULT_TLSA_FIELDS,
    overrideSource = null,
    overrideName = null,
    autoExecute = false,
  }: LookupSetup) {
    setFormError(null);
    setDomain(nextDomain);
    setSelectedTypes(new Set(recordTypes));
    setEnumMode(nextEnumMode);
    setSrvFields(nextSrvFields);
    setTlsaFields(nextTlsaFields);

    let dnsAddr = selectedDnsAddress;

    if (includeDnsServer && dnsServerAddress) {
      const requested = dnsServerAddress;
      const unavailable = !dnsOptions.some((option) => option.address === requested);
      dnsAddr = unavailable ? selectedDnsAddress : requested;
      if (!unavailable && dnsAddr !== selectedDnsAddress) {
        setSelectedDnsAddress(dnsAddr);
        setStoredDnsServer(dnsAddr);
      }
      setDnsOverrideNotice({
        source: overrideSource || "preset",
        name: overrideName,
        requested,
        applied: dnsAddr,
        label: dnsServerLabel(dnsAddr),
        unavailable,
      });
    } else {
      setDnsOverrideNotice(null);
    }

    if (autoExecute) {
      const match = dnsOptions.find((option) => option.address === dnsAddr);
      const resolved =
        match?.resolvedAddress ?? resolveDnsAddress(dnsAddr, effectiveWsUrl);
      setPendingExecute({
        domain: nextDomain,
        recordTypes: [...recordTypes],
        dnsServerAddress: dnsAddr,
        dnsServerResolved: resolved,
        enumMode: nextEnumMode,
        srvFields: nextSrvFields,
        tlsaFields: nextTlsaFields,
      });
    }
  }

  async function executeLookup({
    domain: queryDomain,
    recordTypes,
    dnsServerAddress,
    dnsServerResolved,
    enumMode: execEnumMode,
    srvFields: execSrvFields,
    tlsaFields: execTlsaFields,
  }: PendingExecute): Promise<ExecuteLookupResult> {
    const trimmed = queryDomain.trim();
    const result = await transformQueryInput({
      recordTypes,
      domain: trimmed,
      enumMode: execEnumMode,
      srvFields: execSrvFields,
      tlsaFields: execTlsaFields,
    });
    if ("error" in result) {
      return { sent: false, error: result.error };
    }

    if (isDemoMode) {
      if (!demoDataset) {
        return { sent: false, error: "Demo data is not ready." };
      }

      const match = findDemoMatch(demoDataset, {
        domain: trimmed,
        recordTypes,
        dnsServerAddress,
        dnsServerResolved,
        enumMode: execEnumMode,
        srvFields: execSrvFields,
        tlsaFields: execTlsaFields,
      });

      if (!match) {
        return { sent: false, error: "No matching demo response for this query." };
      }

      const entryIndex = findDemoEntryIndex(demoDataset, {
        domain: trimmed,
        recordTypes,
        dnsServerAddress,
        dnsServerResolved,
        enumMode: execEnumMode,
        srvFields: execSrvFields,
        tlsaFields: execTlsaFields,
      });
      if (entryIndex >= 0) {
        setDemoProgressIndex(entryIndex);
      }

      autoplayRef.current?.pauseForReplay();

      await demoReplayDelay();

      const replay = replayDemoEntry(match, result.queryName);
      if (replay.error) {
        setDemoErrorMessage(replay.error);
        setDemoResponse(null);
      } else {
        setDemoErrorMessage(null);
        setDemoResponse(replay.response);
      }

      setLastExecutedDnsResolved(dnsServerResolved);
      pendingHistoryRef.current = {
        domain: trimmed,
        recordTypes,
        dnsServerAddress,
        dnsServerResolved,
        enumMode: execEnumMode,
        srvFields: execSrvFields,
        tlsaFields: execTlsaFields,
      };
      setViewingHistoryEntry(null);
      if (!expandRecordTypesByDefault) {
        setRecordTypesFolded(true);
      }

      const newHash = `#${encodeQueryFragment({
        domain: trimmed,
        recordTypes,
        dnsServerAddress,
        enumMode: execEnumMode,
        srvFields: execSrvFields,
        tlsaFields: execTlsaFields,
      })}`;
      if (window.location.hash !== newHash) {
        window.history.pushState(null, "", newHash);
      }

      autoplayRef.current?.resumeAfterReplay();

      return { sent: true };
    }

    const sent = query(result.queryName, recordTypes, dnsServerResolved);
    if (sent) {
      setLastExecutedDnsResolved(dnsServerResolved);
      pendingHistoryRef.current = {
        domain: trimmed,
        recordTypes,
        dnsServerAddress,
        dnsServerResolved,
        enumMode: execEnumMode,
        srvFields: execSrvFields,
        tlsaFields: execTlsaFields,
      };
      setViewingHistoryEntry(null);
      if (!expandRecordTypesByDefault) {
        setRecordTypesFolded(true);
      }

      // Push a browser-navigable entry for this executed lookup so back/forward
      // moves between queries, and the URL stays shareable. Skipped when the
      // fragment already matches (e.g. we just got here via popstate, or a
      // shared link that reproduces the query it was loaded with) so we don't
      // create a duplicate entry or fight the browser's own navigation.
      const newHash = `#${encodeQueryFragment({
        domain: trimmed,
        recordTypes,
        dnsServerAddress,
        enumMode: execEnumMode,
        srvFields: execSrvFields,
        tlsaFields: execTlsaFields,
      })}`;
      if (window.location.hash !== newHash) {
        window.history.pushState(null, "", newHash);
      }
    }
    return { sent };
  }

  function toggleType(type: string) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function handleWsUrlChange(url: string) {
    setHttpServerUrl("");
    setStoredHttpServerUrl("");
    setSelectedWsUrl(url);
    setStoredWsUrl(url);
  }

  function handleHttpServerUrlChange(url: string) {
    setHttpServerUrl(url);
    setStoredHttpServerUrl(url);

    const derived = deriveWsUrlFromHttp(url);
    if (derived) {
      setSelectedWsUrl(derived);
      setStoredWsUrl(derived);
    }
  }

  function handleDnsServerChange(address: string) {
    setSelectedDnsAddress(address);
    setStoredDnsServer(address);
    setDnsOverrideNotice(null);
  }

  function handleApiKeySave() {
    const key = apiKeyInput.trim();
    if (!key) return;
    saveApiKey(key).then(async () => {
      setApiKeyInput("");
      const headers = await listWsHeaders();
      setConnectionHeaders(headers);
      setDefaultHeaderSuggestions(mergeHeaderSuggestions(headers, config?.wsConnectionHeaders ?? []));
    });
  }

  async function handleConnectionHeadersChange(nextHeaders?: WsHeader[]): Promise<WsHeader[]> {
    if (nextHeaders) {
      const saved = await saveConnectionHeaders(nextHeaders);
      setConnectionHeaders(saved);
      setDefaultHeaderSuggestions(mergeHeaderSuggestions(saved, config?.wsConnectionHeaders ?? []));
      return saved;
    }

    const headers = await listWsHeaders();
    setConnectionHeaders(headers);
    setDefaultHeaderSuggestions(mergeHeaderSuggestions(headers, config?.wsConnectionHeaders ?? []));
    saveConnectionHeaders(headers);
    return headers;
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setFormError(null);
    setDnsOverrideNotice(null);

    const recordTypes = Array.from(selectedTypes);
    if (recordTypes.length === 0) {
      setFormError("Select at least one record type.");
      return;
    }

    if (blockingTypes.length > 0) {
      setFormError(
        `Deselect ${blockingTypes.join(", ")} — only ${engagedRecordType} can be queried while its lookup convention is engaged.`
      );
      return;
    }

    const { sent, error } = await executeLookup({
      domain,
      recordTypes,
      dnsServerAddress: selectedDnsAddress,
      dnsServerResolved: selectedDnsResolved,
      enumMode,
      srvFields,
      tlsaFields,
    });
    if (error) {
      setFormError(error);
    } else if (!sent) {
      setFormError(
        isDemoMode ? "No matching demo response for this query." : "Not connected to the server."
      );
    }
  }

  function handleStopAutoplay() {
    autoplayRef.current?.stop();
    setAutoplayRunning(false);
    setAutoplayCountdownSec(0);
  }

  function handleResumeAutoplay() {
    autoplayRef.current?.resume();
    setAutoplayRunning(autoplayRef.current?.isRunning() ?? false);
  }

  function runDemoStep(index: number) {
    if (!demoDataset || index < 0 || index >= demoDataset.entries.length) return;

    const entry = demoDataset.entries[index];
    autoplayRef.current?.alignAfterManualStep(index);

    applyLookupSetup({
      domain: entry.domain,
      recordTypes: entry.recordTypes,
      includeDnsServer: true,
      dnsServerAddress: entry.dnsServerAddress,
      enumMode: entry.enumMode,
      srvFields: entry.srvFields,
      tlsaFields: entry.tlsaFields,
      overrideSource: "demo-manual",
      autoExecute: true,
    });
    closeMenu();
  }

  function handleDemoSelectStep(index: number) {
    if (autoplayRunning) return;
    runDemoStep(index);
  }

  function handleDemoNextStep() {
    if (autoplayRunning || !demoDataset) return;
    const nextIndex = demoNextStepIndex(demoProgressIndex, demoDataset.entries.length);
    runDemoStep(nextIndex);
  }

  function handleRunLookupSetup(setup: LookupSetup) {
    applyLookupSetup({ ...setup, autoExecute: true });
    closeMenu();
  }

  function handleFollowUp({ domain: followUpDomain, recordTypes }: FollowUpQuery) {
    handleRunLookupSetup({ domain: followUpDomain, recordTypes });
  }

  function handleViewHistoryEntry(entry: LookupHistoryEntry) {
    setFormError(null);
    setViewingHistoryEntry(entry);
    closeMenu();
  }

  function handleThemeChange(mode: string) {
    saveThemePreference(mode).then((saved) => {
      setThemePreference(saved);
    });
  }

  function handleHelpExampleWrapChange(mode: string) {
    saveHelpExampleWrap(mode).then((saved) => {
      setHelpExampleWrap(saved);
    });
  }

  function handleRrDetailLevelChange(level: string) {
    setRrDetailLevel(level).then((saved) => {
      setRrDetailLevelState(saved);
    });
  }

  function handleRrDefaultViewModeChange(mode: string) {
    setRrDefaultViewMode(mode).then((saved) => {
      setRrDefaultViewModeState(saved);
    });
  }

  function handleExpandRecordTypesByDefaultChange(value: boolean) {
    setExpandRecordTypesByDefault(value).then((saved) => {
      setExpandRecordTypesByDefaultState(saved);
      if (saved) setRecordTypesFolded(false);
    });
  }

  function openMenu(panel: MenuPanel = null) {
    setMenuPanel(panel);
    setMenuOpen(true);
  }

  function closeMenu() {
    setMenuOpen(false);
    setMenuPanel(null);
  }

  async function handleRunMailDnsCheck(input: { domain: string; dkimSelectors: string }) {
    if (isDemoMode) {
      setMailDnsCheckError("Mail DNS check requires a live backend connection.");
      return;
    }
    if (status !== "connected") {
      setMailDnsCheckError("Not connected to the server.");
      return;
    }

    closeMenu();
    setMailDnsCheckError(null);
    setMailDnsCheckRunning(true);
    setMailDnsCheckProgress({
      phase: "starting",
      message: "Starting mail DNS check…",
      completed: 0,
      total: 1,
    });

    const mailQuery = async (req: {
      domain: string;
      recordTypes: string[];
      dnsServer?: string;
    }) => queryAsync(req.domain, req.recordTypes, req.dnsServer);

    try {
      const report = await runMailDnsCheck(
        {
          domain: input.domain,
          dkimSelectors: parseDkimSelectorsInput(input.dkimSelectors),
        },
        mailQuery,
        {
          defaultResolver: selectedDnsResolved,
          onProgress: setMailDnsCheckProgress,
        }
      );
      setMailDnsReport(report);
    } catch (error) {
      setMailDnsCheckError(
        error instanceof Error ? error.message : "Mail DNS check failed unexpectedly."
      );
    } finally {
      setMailDnsCheckRunning(false);
      setMailDnsCheckProgress(null);
    }
  }

  if (mailDnsReport) {
    return (
      <main class="app app--mail-dns-report">
        <AuthExpiredOverlay />
        <MailDnsCheckReportView
          report={mailDnsReport}
          onBack={() => setMailDnsReport(null)}
        />
      </main>
    );
  }

  if (!ready) {
    return (
      <main class="app">
        <p class="loading">Loading configuration…</p>
      </main>
    );
  }

  return (
    <main class="app">
      <AuthExpiredOverlay />
      <header>
        <h1>DNS Lookup</h1>
        <div class="header-actions">
          <span class={`status status--${displayStatus}`}>{displayStatusLabel}</span>
          {isDemoMode && demoReady && config?.demo.autoplay.enabled && (
            <button
              type="button"
              class="demo-replay-control"
              onClick={autoplayRunning ? handleStopAutoplay : handleResumeAutoplay}
            >
              {autoplayRunning ? "Stop replay" : "Resume replay"}
            </button>
          )}
          <button
            type="button"
            class="hamburger"
            aria-label="Open menu"
            onClick={() => openMenu(null)}
          >
            ☰
          </button>
        </div>
      </header>

      {mailDnsCheckRunning && mailDnsCheckProgress && (
        <p class="mail-dns-check-progress" role="status">
          {mailDnsCheckProgress.message}
        </p>
      )}

      {mailDnsCheckError && (
        <div class="record-card record-card--error" role="alert">
          <h3>Mail DNS check failed</h3>
          <p class="record-message record-message--error">{mailDnsCheckError}</p>
          <button type="button" onClick={() => setMailDnsCheckError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {isDemoMode && demoReady && demoDataset && (
        <DemoProgressBar
          entries={demoDataset.entries}
          currentIndex={demoProgressIndex}
          autoplayRunning={autoplayRunning}
          autoplayCountdownSec={autoplayCountdownSec}
          autoplayIntervalMs={config?.demo.autoplay.intervalMs ?? 5000}
          onSelectStep={handleDemoSelectStep}
          onNextStep={handleDemoNextStep}
        />
      )}

      <p class={`active-settings${dnsOverrideNotice ? " active-settings--overridden" : ""}`}>
        Resolver: <strong>{selectedDnsResolved}</strong>
        {dnsOverrideNotice && (
          <span class="active-settings__override-badge">overridden</span>
        )}
      </p>

      {dnsOverrideNotice && (
        <p class="dns-override-notice" role="status">
          {dnsOverrideNotice.source === "quick-lookup" ? (
            <>
              Quick lookup <strong>{dnsOverrideNotice.name}</strong> set the resolver to{" "}
              <strong>{dnsOverrideNotice.label}</strong>
            </>
          ) : dnsOverrideNotice.source === "history" ? (
            <>
              History re-run set the resolver to <strong>{dnsOverrideNotice.label}</strong>
            </>
          ) : (
            <>
              Preset set the resolver to <strong>{dnsOverrideNotice.label}</strong>
            </>
          )}
          {dnsOverrideNotice.unavailable && (
            <> (saved resolver unavailable; using current default)</>
          )}
        </p>
      )}

      <form class="query-form" onSubmit={handleSubmit}>
        <QueryInputPreview
          id="domain"
          domain={domain}
          onDomainChange={setDomain}
          recordTypes={Array.from(selectedTypes)}
          enumMode={enumMode}
          srvFields={srvFields}
          tlsaFields={tlsaFields}
          onResultChange={setPreviewResult}
        />

        {selectedTypes.has("NAPTR") && (
          <label class="convention-toggle">
            <input
              type="checkbox"
              checked={enumMode}
              onChange={(e) => setEnumMode((e.currentTarget as HTMLInputElement).checked)}
            />
            ENUM lookup (treat input as a phone number)
          </label>
        )}
        {selectedTypes.has("SRV") && <SrvFieldsInput value={srvFields} onChange={setSrvFields} />}
        {selectedTypes.has("TLSA") && <TlsaFieldsInput value={tlsaFields} onChange={setTlsaFields} />}

        <fieldset>
          <legend>Record types</legend>
          {recordTypesFolded ? (
            <div class="record-type-folded">
              <p class="record-type-folded__summary">
                {Array.from(selectedTypes).join(", ") || "None selected"}
              </p>
              <button
                type="button"
                class="record-type-folded__change"
                onClick={() => setRecordTypePickerOpen(true)}
              >
                Change
              </button>
            </div>
          ) : (
            <RecordTypeGroups
              selectedTypes={selectedTypes}
              toggleType={toggleType}
              isRecordTypeCheckboxDisabled={isRecordTypeCheckboxDisabled}
              recordTypeTitle={recordTypeTitle}
              onOpenHelp={setHelpRecordType}
            />
          )}
        </fieldset>

        {recordTypePickerOpen && (
          <RecordTypePicker
            selectedTypes={selectedTypes}
            toggleType={toggleType}
            isRecordTypeCheckboxDisabled={isRecordTypeCheckboxDisabled}
            recordTypeTitle={recordTypeTitle}
            onOpenHelp={setHelpRecordType}
            onClose={() => setRecordTypePickerOpen(false)}
          />
        )}

        {blockingTypes.length > 0 && (
          <p class="form-error" role="alert">
            Deselect {blockingTypes.join(", ")} — only {engagedRecordType} can be queried while its
            lookup convention is engaged.
          </p>
        )}

        {formError && <p class="form-error">{formError}</p>}

        <button
          type="submit"
          disabled={!canQuery || blockingTypes.length > 0 || Boolean(previewError)}
        >
          Lookup
        </button>
      </form>

      {viewingHistoryEntry && (
        <div class="history-view-banner" role="status">
          <p>
            Showing history from <strong>{formatHistoryTime(viewingHistoryEntry.timestamp)}</strong> for{" "}
            <strong>{viewingHistoryEntry.domain}</strong> ({viewingHistoryEntry.recordTypes.join(", ")})
          </p>
          <button
            type="button"
            class="history-view-banner__dismiss"
            onClick={() => setViewingHistoryEntry(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <section class="results" aria-live="polite">
        {viewingHistoryEntry ? (
          <>
            {viewingHistoryEntry.responseError && (
              <div class="record-card record-card--error">
                <h3>Lookup failed</h3>
                <p class="record-message record-message--error">
                  {humanizeRequestError(viewingHistoryEntry.responseError)}
                </p>
              </div>
            )}
            {viewingHistoryEntry.results && viewingHistoryEntry.results.length > 0
              ? viewingHistoryEntry.results.map((result) => (
                  <RecordResultCard
                    key={result.record_type}
                    result={result}
                    domain={viewingHistoryEntry.domain}
                    defaultViewMode={rrDefaultViewMode}
                    detailLevel={rrDetailLevel}
                    dnsServerResolved={viewingHistoryEntry.dnsServerResolved}
                    onFollowUp={handleFollowUp}
                  />
                ))
              : !viewingHistoryEntry.responseError && (
                  <p class="menu-hint">
                    No stored results for this entry — it was recorded before result history was
                    tracked.
                  </p>
                )}
          </>
        ) : (
          <>
            {activeErrorMessage && (
              <div class="record-card record-card--error">
                <h3>Lookup failed</h3>
                <p class="record-message record-message--error">
                  {humanizeRequestError(activeErrorMessage)}
                </p>
              </div>
            )}
            {activeResponse &&
              activeResponse.results.map((result) => (
                <RecordResultCard
                  key={result.record_type}
                  result={result}
                  domain={activeResponse.domain}
                  defaultViewMode={rrDefaultViewMode}
                  detailLevel={rrDetailLevel}
                  dnsServerResolved={lastExecutedDnsResolved || selectedDnsResolved}
                  onFollowUp={handleFollowUp}
                />
              ))}
          </>
        )}
      </section>

      <RecordTypeHelpModal
        recordType={helpRecordType}
        onClose={() => setHelpRecordType(null)}
        defaultViewMode={rrDefaultViewMode}
        detailLevel={rrDetailLevel}
      />

      <Menu
        open={menuOpen}
        panel={menuPanel}
        onOpenPanel={setMenuPanel}
        onClose={closeMenu}
        quickLookups={quickLookups}
        onQuickLookupsChange={setQuickLookups}
        onRunLookupSetup={handleRunLookupSetup}
        onViewHistoryEntry={handleViewHistoryEntry}
        currentDomain={domain}
        currentRecordTypes={Array.from(selectedTypes)}
        currentDnsServerAddress={selectedDnsAddress}
        currentEnumMode={enumMode}
        currentSrvFields={srvFields}
        currentTlsaFields={tlsaFields}
        wsUrls={resolvedWsUrls}
        selectedWsUrl={selectedWsUrl}
        httpServerUrl={httpServerUrl}
        onWsUrlChange={handleWsUrlChange}
        onHttpServerUrlChange={handleHttpServerUrlChange}
        dnsOptions={dnsOptions}
        selectedDnsAddress={selectedDnsAddress}
        onDnsServerChange={handleDnsServerChange}
        apiKeyInput={apiKeyInput}
        hasApiKey={hasApiKey}
        onApiKeyInput={setApiKeyInput}
        onApiKeySave={handleApiKeySave}
        connectionHeaders={connectionHeaders}
        defaultHeaderSuggestions={defaultHeaderSuggestions}
        onConnectionHeadersChange={handleConnectionHeadersChange}
        onCustomServersChange={setCustomServers}
        themePreference={themePreference}
        onThemeChange={handleThemeChange}
        helpExampleWrap={helpExampleWrap}
        onHelpExampleWrapChange={handleHelpExampleWrapChange}
        rrDetailLevel={rrDetailLevel}
        onRrDetailLevelChange={handleRrDetailLevelChange}
        rrDefaultViewMode={rrDefaultViewMode}
        onRrDefaultViewModeChange={handleRrDefaultViewModeChange}
        expandRecordTypesByDefault={expandRecordTypesByDefault}
        onExpandRecordTypesByDefaultChange={handleExpandRecordTypesByDefaultChange}
        canRunMailDnsCheck={canQuery && !isDemoMode}
        onRunMailDnsCheck={handleRunMailDnsCheck}
        mailDnsCheckDomainSeed={domain}
      />
    </main>
  );
}
