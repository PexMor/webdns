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
import type { DetailLevel } from "./rr";
import { addHistoryEntry } from "./lookupHistoryStore";
import { getLookupForm, saveLookupForm } from "./lookupFormStore";
import { initAutoFoldRecordTypes, setAutoFoldRecordTypes } from "./queryFormPrefsStore";
import { listQuickLookups } from "./quickLookupStore";
import { listWsHeaders, migrateLegacyApiKey } from "./wsHeaderStore";
import { Menu, formatHistoryTime, type LookupSetup, type MenuPanel } from "./menu";
import { useDnsSocket } from "./useDnsSocket";
import {
  RECORD_TYPE_CONVENTION,
  RECORD_TYPE_GROUPS,
  conventionTooltip,
  recordTypeForConvention,
} from "./recordTypes";
import { RecordResultCard } from "./RecordResultCard";
import { RecordTypeHelpModal } from "./RecordTypeHelpModal";
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
import type {
  CustomDnsServer,
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
  const [autoFoldRecordTypes, setAutoFoldRecordTypesState] = useState(false);
  const [recordTypesFolded, setRecordTypesFolded] = useState(false);

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

  const pendingHistoryRef = useRef<PendingExecute | null>(null);

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

  const { status, statusLabel, hasApiKey, response, errorMessage, saveApiKey, saveConnectionHeaders, query } =
    useDnsSocket(effectiveWsUrl, {
      connectionHeaders,
      queryMap: config?.wsHeaderQueryMap ?? {},
      credentialsReady: ready,
      identityProxy: config?.identityProxy,
    });

  useEffect(() => {
    async function init() {
      const theme = await initTheme();
      const exampleWrap = await initHelpExampleWrap();
      const rrViewPrefs = await initRrViewPrefs();
      const foldRecordTypes = await initAutoFoldRecordTypes();
      const loaded = await loadConfig();
      const custom = await listCustomServers();
      const presets = await listQuickLookups();
      const savedForm = await getLookupForm();
      await migrateLegacyApiKey();
      const headers = await listWsHeaders();
      const httpUrl = getStoredHttpServerUrl();
      const wsUrls = getResolvedWsUrls(loaded.wsUrls);
      const wsUrl = pickInitialWsUrl(wsUrls, httpUrl);
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
      setAutoFoldRecordTypesState(foldRecordTypes);
      setHttpServerUrl(httpUrl);
      setSelectedWsUrl(wsUrl);
      setSelectedDnsAddress(dnsAddress);
      setDomain(savedForm.domain);
      setSelectedTypes(new Set(savedForm.recordTypes));
      setEnumMode(savedForm.enumMode ?? false);
      setSrvFields(savedForm.srvFields ?? DEFAULT_SRV_FIELDS);
      setTlsaFields(savedForm.tlsaFields ?? DEFAULT_TLSA_FIELDS);
      setReady(true);
    }

    init();
  }, []);

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
    if (!response && !errorMessage) return;

    const entry = pendingHistoryRef.current;
    pendingHistoryRef.current = null;
    addHistoryEntry({
      ...entry,
      results: response?.results,
      responseError: response ? undefined : errorMessage ?? undefined,
    }).catch((err) => {
      console.error("[history] failed to save entry", err);
    });
  }, [response, errorMessage]);

  useEffect(() => {
    if (!pendingExecute) return;

    if (status !== "connected") {
      setFormError("Not connected to the server.");
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
        setFormError("Not connected to the server.");
      }
    });

    setPendingExecute(null);
  }, [pendingExecute, status, dnsOptions, effectiveWsUrl]);

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

    const sent = query(result.queryName, recordTypes, dnsServerResolved);
    if (sent) {
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
      if (autoFoldRecordTypes) {
        setRecordTypesFolded(true);
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
      setFormError("Not connected to the server.");
    }
  }

  function handleRunLookupSetup(setup: LookupSetup) {
    applyLookupSetup({ ...setup, autoExecute: true });
    closeMenu();
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

  function handleAutoFoldRecordTypesChange(value: boolean) {
    setAutoFoldRecordTypes(value).then((saved) => {
      setAutoFoldRecordTypesState(saved);
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
          <span class={`status status--${status}`}>{statusLabel}</span>
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
          {autoFoldRecordTypes && recordTypesFolded ? (
            <div class="record-type-folded">
              <p class="record-type-folded__summary">
                {Array.from(selectedTypes).join(", ") || "None selected"}
              </p>
              <button type="button" class="record-type-folded__change" onClick={() => setRecordTypesFolded(false)}>
                Change
              </button>
            </div>
          ) : (
            <div class="record-type-groups">
              {RECORD_TYPE_GROUPS.map((group) => (
                <div key={group.label} class="record-type-group">
                  <p class="record-type-group__label">{group.label}</p>
                  <div class="record-type-group__options">
                    {group.types.map((type) => {
                      const disabled = isRecordTypeCheckboxDisabled(type);
                      const isConvention = Boolean(RECORD_TYPE_CONVENTION[type]);
                      const title = recordTypeTitle(type);
                      return (
                        <div
                          key={type}
                          class={`record-type-option${isConvention ? " record-type-option--convention" : ""}${
                            disabled ? " record-type-option--disabled" : ""
                          }`}
                          title={title}
                        >
                          <input
                            id={`record-type-${type}`}
                            type="checkbox"
                            checked={selectedTypes.has(type)}
                            disabled={disabled}
                            onChange={() => toggleType(type)}
                          />
                          <button
                            type="button"
                            class="record-type-help-trigger"
                            onClick={() => setHelpRecordType(type)}
                            aria-label={`What is a ${type} record?`}
                          >
                            {type}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </fieldset>

        {blockingTypes.length > 0 && (
          <p class="form-error" role="alert">
            Deselect {blockingTypes.join(", ")} — only {engagedRecordType} can be queried while its
            lookup convention is engaged.
          </p>
        )}

        {formError && <p class="form-error">{formError}</p>}

        <button
          type="submit"
          disabled={status !== "connected" || blockingTypes.length > 0 || Boolean(previewError)}
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
            {errorMessage && (
              <div class="record-card record-card--error">
                <h3>Lookup failed</h3>
                <p class="record-message record-message--error">
                  {humanizeRequestError(errorMessage)}
                </p>
              </div>
            )}
            {response &&
              response.results.map((result) => (
                <RecordResultCard
                  key={result.record_type}
                  result={result}
                  domain={response.domain}
                  defaultViewMode={rrDefaultViewMode}
                  detailLevel={rrDetailLevel}
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
        autoFoldRecordTypes={autoFoldRecordTypes}
        onAutoFoldRecordTypesChange={handleAutoFoldRecordTypesChange}
      />
    </main>
  );
}
