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
import { addHistoryEntry } from "./lookupHistoryStore";
import { getLookupForm, saveLookupForm } from "./lookupFormStore";
import { listQuickLookups } from "./quickLookupStore";
import { listWsHeaders, migrateLegacyApiKey } from "./wsHeaderStore";
import { Menu, type LookupSetup, type MenuPanel } from "./menu";
import { useDnsSocket } from "./useDnsSocket";
import { RECORD_TYPE_GROUPS } from "./recordTypes";
import { RecordResultCard } from "./RecordResultCard";
import { RecordTypeHelpModal } from "./RecordTypeHelpModal";
import { humanizeRequestError } from "./formatRecordResult";
import type { CustomDnsServer, DnsServerOption, QuickLookup, RuntimeConfig, WsHeader } from "./types";

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

  const [domain, setDomain] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(DEFAULT_SELECTED);
  const [formError, setFormError] = useState<string | null>(null);
  const [helpRecordType, setHelpRecordType] = useState<string | null>(null);
  const [dnsOverrideNotice, setDnsOverrideNotice] = useState<DnsOverrideNotice | null>(null);
  const [pendingExecute, setPendingExecute] = useState<PendingExecute | null>(null);

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

  const { status, statusLabel, hasApiKey, response, errorMessage, saveApiKey, saveConnectionHeaders, query } =
    useDnsSocket(effectiveWsUrl, {
      connectionHeaders,
      queryMap: config?.wsHeaderQueryMap ?? {},
      credentialsReady: ready,
    });

  useEffect(() => {
    async function init() {
      const theme = await initTheme();
      const exampleWrap = await initHelpExampleWrap();
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
      setHttpServerUrl(httpUrl);
      setSelectedWsUrl(wsUrl);
      setSelectedDnsAddress(dnsAddress);
      setDomain(savedForm.domain);
      setSelectedTypes(new Set(savedForm.recordTypes));
      setReady(true);
    }

    init();
  }, []);

  useEffect(() => {
    if (!ready) return;

    saveLookupForm({
      domain,
      recordTypes: Array.from(selectedTypes),
    }).catch((err) => {
      console.error("[form] failed to save lookup form", err);
    });
  }, [domain, selectedTypes, ready]);

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
    addHistoryEntry(entry).catch((err) => {
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

    const sent = executeLookup({
      domain: pendingExecute.domain,
      recordTypes,
      dnsServerAddress: dnsAddr,
      dnsServerResolved: resolved,
    });

    if (!sent) {
      setFormError("Not connected to the server.");
    }

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
    overrideSource = null,
    overrideName = null,
    autoExecute = false,
  }: LookupSetup) {
    setFormError(null);
    setDomain(nextDomain);
    setSelectedTypes(new Set(recordTypes));

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
      });
    }
  }

  function executeLookup({
    domain: queryDomain,
    recordTypes,
    dnsServerAddress,
    dnsServerResolved,
  }: PendingExecute): boolean {
    const trimmed = queryDomain.trim();
    const sent = query(trimmed, recordTypes, dnsServerResolved);
    if (sent) {
      pendingHistoryRef.current = {
        domain: trimmed,
        recordTypes,
        dnsServerAddress,
        dnsServerResolved,
      };
    }
    return sent;
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

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setFormError(null);
    setDnsOverrideNotice(null);

    const recordTypes = Array.from(selectedTypes);
    if (recordTypes.length === 0) {
      setFormError("Select at least one record type.");
      return;
    }

    const sent = executeLookup({
      domain,
      recordTypes,
      dnsServerAddress: selectedDnsAddress,
      dnsServerResolved: selectedDnsResolved,
    });
    if (!sent) {
      setFormError("Not connected to the server.");
    }
  }

  function handleRunLookupSetup(setup: LookupSetup) {
    applyLookupSetup({ ...setup, autoExecute: true });
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
        <label for="domain">Domain</label>
        <input
          id="domain"
          type="text"
          placeholder="example.com"
          autocomplete="off"
          required
          value={domain}
          onInput={(e) => setDomain((e.currentTarget as HTMLInputElement).value)}
        />

        <fieldset>
          <legend>Record types</legend>
          <div class="record-type-groups">
            {RECORD_TYPE_GROUPS.map((group) => (
              <div key={group.label} class="record-type-group">
                <p class="record-type-group__label">{group.label}</p>
                <div class="record-type-group__options">
                  {group.types.map((type) => (
                    <div key={type} class="record-type-option">
                      <input
                        id={`record-type-${type}`}
                        type="checkbox"
                        checked={selectedTypes.has(type)}
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
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        {formError && <p class="form-error">{formError}</p>}

        <button type="submit" disabled={status !== "connected"}>
          Lookup
        </button>
      </form>

      <section class="results" aria-live="polite">
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
            />
          ))}
      </section>

      <RecordTypeHelpModal
        recordType={helpRecordType}
        onClose={() => setHelpRecordType(null)}
      />

      <Menu
        open={menuOpen}
        panel={menuPanel}
        onOpenPanel={setMenuPanel}
        onClose={closeMenu}
        quickLookups={quickLookups}
        onQuickLookupsChange={setQuickLookups}
        onRunLookupSetup={handleRunLookupSetup}
        currentDomain={domain}
        currentRecordTypes={Array.from(selectedTypes)}
        currentDnsServerAddress={selectedDnsAddress}
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
      />
    </main>
  );
}
