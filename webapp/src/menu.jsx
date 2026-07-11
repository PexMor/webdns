import { useEffect, useRef, useState } from "preact/hooks";
import buildInfo from "./build-info.json";
import { THEME_MODES } from "./themeStore.js";
import { HELP_EXAMPLE_WRAP_MODES } from "./displayPrefsStore.js";
import {
  exportCustomServers,
  importCustomServers,
  listCustomServers,
  addCustomServer,
  removeCustomServer,
} from "./dnsServerStore.js";
import {
  clearHistory,
  listHistory,
  suggestQuickLookupName,
} from "./lookupHistoryStore.js";
import {
  addQuickLookup,
  exportQuickLookups,
  importQuickLookups,
  listQuickLookups,
  removeQuickLookup,
  reorderQuickLookups,
  updateQuickLookup,
} from "./quickLookupStore.js";
import {
  exportWsHeaders,
  importWsHeaders,
  listWsHeaders,
  removeWsHeader,
} from "./wsHeaderStore.js";
import { deriveWsUrlFromHttp, isValidIpAddress } from "./loadConfig.js";

function maskHeaderValue(value) {
  if (!value) return "";
  return "••••••";
}

function formatHistoryTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString();
}

function dnsServerLabel(address, dnsOptions) {
  const match = dnsOptions.find((option) => option.address === address);
  if (!match) return address;
  return `${match.label} (${match.resolvedAddress})`;
}

function quickLookupDnsMeta(preset, dnsOptions) {
  if (!preset.includeDnsServer || !preset.dnsServerAddress) return null;
  return dnsServerLabel(preset.dnsServerAddress, dnsOptions);
}

export function Menu({
  open,
  panel,
  onOpenPanel,
  onClose,
  quickLookups,
  onQuickLookupsChange,
  onRunLookupSetup,
  currentDomain,
  currentRecordTypes,
  currentDnsServerAddress,
  wsUrls,
  selectedWsUrl,
  httpServerUrl,
  onWsUrlChange,
  onHttpServerUrlChange,
  dnsOptions,
  selectedDnsAddress,
  onDnsServerChange,
  apiKeyInput,
  hasApiKey,
  onApiKeyInput,
  onApiKeySave,
  connectionHeaders,
  defaultHeaderSuggestions,
  onConnectionHeadersChange,
  onCustomServersChange,
  themePreference,
  onThemeChange,
  helpExampleWrap,
  onHelpExampleWrapChange,
}) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleOverlayClick(event) {
    if (event.target === overlayRef.current) onClose();
  }

  return (
    <div class="menu-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div class="menu-panel" role="dialog" aria-modal="true">
        <header class="menu-panel__header">
          <h2>
            {panel === "settings" && "Settings"}
            {panel === "history" && "History"}
            {panel === "quick-lookups" && "Manage Quick Lookups"}
            {panel === "about" && "About"}
            {!panel && "Menu"}
          </h2>
          <button type="button" class="menu-close" onClick={onClose} aria-label="Close menu">
            ×
          </button>
        </header>

        {!panel && (
          <nav class="menu-nav">
            {quickLookups.length > 0 && (
              <p class="menu-nav__section-label">Quick lookups</p>
            )}
            {quickLookups.map((preset) => (
              <button
                key={preset.id}
                type="button"
                class="menu-nav__quick-lookup"
                onClick={() =>
                  onRunLookupSetup({
                    domain: preset.domain,
                    recordTypes: preset.recordTypes,
                    includeDnsServer: preset.includeDnsServer,
                    dnsServerAddress: preset.dnsServerAddress,
                    overrideSource: "quick-lookup",
                    overrideName: preset.name,
                  })
                }
              >
                <span class="menu-nav__quick-lookup-name">{preset.name}</span>
                <span class="menu-nav__quick-lookup-meta">
                  {preset.recordTypes.join(", ")} · {preset.domain}
                  {preset.includeDnsServer && (
                    <span class="quick-lookup-dns-badge">
                      DNS: {quickLookupDnsMeta(preset, dnsOptions)}
                    </span>
                  )}
                </span>
              </button>
            ))}
            {quickLookups.length > 0 && <hr class="menu-divider" />}
            <button type="button" onClick={() => onOpenPanel("history")}>
              History
            </button>
            <button type="button" onClick={() => onOpenPanel("settings")}>
              Settings
            </button>
            <button type="button" onClick={() => onOpenPanel("quick-lookups")}>
              Manage Quick Lookups
            </button>
            <button type="button" onClick={() => onOpenPanel("about")}>
              About
            </button>
          </nav>
        )}

        {panel === "settings" && (
          <SettingsPanel
            wsUrls={wsUrls}
            selectedWsUrl={selectedWsUrl}
            httpServerUrl={httpServerUrl}
            onWsUrlChange={onWsUrlChange}
            onHttpServerUrlChange={onHttpServerUrlChange}
            dnsOptions={dnsOptions}
            selectedDnsAddress={selectedDnsAddress}
            onDnsServerChange={onDnsServerChange}
            apiKeyInput={apiKeyInput}
            hasApiKey={hasApiKey}
            onApiKeyInput={onApiKeyInput}
            onApiKeySave={onApiKeySave}
            connectionHeaders={connectionHeaders}
            defaultHeaderSuggestions={defaultHeaderSuggestions}
            onConnectionHeadersChange={onConnectionHeadersChange}
            themePreference={themePreference}
            onThemeChange={onThemeChange}
            helpExampleWrap={helpExampleWrap}
            onHelpExampleWrapChange={onHelpExampleWrapChange}
            onCustomServersChange={onCustomServersChange}
            onBack={() => onOpenPanel(null)}
          />
        )}

        {panel === "history" && (
          <HistoryPanel
            onRunLookupSetup={onRunLookupSetup}
            onQuickLookupsChange={onQuickLookupsChange}
            dnsOptions={dnsOptions}
            onBack={() => onOpenPanel(null)}
          />
        )}

        {panel === "quick-lookups" && (
          <QuickLookupsPanel
            quickLookups={quickLookups}
            onQuickLookupsChange={onQuickLookupsChange}
            currentDomain={currentDomain}
            currentRecordTypes={currentRecordTypes}
            currentDnsServerAddress={currentDnsServerAddress}
            dnsOptions={dnsOptions}
            onBack={() => onOpenPanel(null)}
          />
        )}

        {panel === "about" && <AboutPanel onBack={() => onOpenPanel(null)} />}
      </div>
    </div>
  );
}

function SettingsPanel({
  wsUrls,
  selectedWsUrl,
  httpServerUrl,
  onWsUrlChange,
  onHttpServerUrlChange,
  dnsOptions,
  selectedDnsAddress,
  onDnsServerChange,
  apiKeyInput,
  hasApiKey,
  onApiKeyInput,
  onApiKeySave,
  connectionHeaders,
  defaultHeaderSuggestions,
  onConnectionHeadersChange,
  themePreference,
  onThemeChange,
  helpExampleWrap,
  onHelpExampleWrapChange,
  onCustomServersChange,
  onBack,
}) {
  const derivedWsUrl = deriveWsUrlFromHttp(httpServerUrl);
  const usingHttpDerivation = Boolean(derivedWsUrl);
  const [customAddress, setCustomAddress] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [dnsMessage, setDnsMessage] = useState(null);
  const [dnsError, setDnsError] = useState(null);
  const dnsFileInputRef = useRef(null);
  const [headerName, setHeaderName] = useState("");
  const [headerValue, setHeaderValue] = useState("");
  const [headerMessage, setHeaderMessage] = useState(null);
  const [headerError, setHeaderError] = useState(null);
  const headerFileInputRef = useRef(null);

  const displayedHeaders =
    connectionHeaders.length > 0 ? connectionHeaders : defaultHeaderSuggestions;
  const headersAreSuggestions = connectionHeaders.length === 0 && defaultHeaderSuggestions.length > 0;

  const customOptions = dnsOptions.filter((option) => option.custom);

  async function refreshCustom() {
    const servers = await listCustomServers();
    onCustomServersChange(servers);
  }

  async function handleAddCustom(event) {
    event.preventDefault();
    setDnsError(null);
    setDnsMessage(null);

    const trimmed = customAddress.trim();
    if (!isValidIpAddress(trimmed)) {
      setDnsError("Enter a valid IPv4 or IPv6 address.");
      return;
    }

    const known = dnsOptions.map((option) => option.address);
    if (known.includes(trimmed)) {
      setDnsError("That DNS server is already in the list.");
      return;
    }

    await addCustomServer(trimmed, customLabel.trim() || trimmed);
    setCustomAddress("");
    setCustomLabel("");
    setDnsMessage("DNS server added.");
    await refreshCustom();
  }

  async function handleRemoveCustom(serverAddress) {
    await removeCustomServer(serverAddress);
    setDnsMessage("DNS server removed.");
    await refreshCustom();
  }

  async function handleImportCustom(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setDnsError(null);
    setDnsMessage(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array.");

      const known = dnsOptions.map((option) => option.address);
      const { added, skipped } = await importCustomServers(parsed, known);
      setDnsMessage(`Import complete: ${added} added, ${skipped} skipped.`);
      await refreshCustom();
    } catch (err) {
      setDnsError(err.message || "Invalid import file.");
    }
  }

  async function handleExportCustom() {
    const data = await exportCustomServers();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dns-servers.json";
    link.click();
    URL.revokeObjectURL(url);
    setDnsMessage(`Exported ${data.length} custom server(s).`);
  }

  async function refreshHeaders(nextHeaders) {
    await onConnectionHeadersChange(nextHeaders);
  }

  async function handleAddHeader(event) {
    event.preventDefault();
    setHeaderError(null);
    setHeaderMessage(null);

    const name = headerName.trim();
    if (!name) {
      setHeaderError("Header name cannot be empty.");
      return;
    }

    const next = [...connectionHeaders];
    const index = next.findIndex((entry) => entry.name.toLowerCase() === name.toLowerCase());
    const row = {
      name,
      value: headerValue,
      enabled: true,
      builtin: name.toLowerCase() === "apikey",
    };

    if (index >= 0) {
      next[index] = { ...next[index], ...row };
    } else {
      next.push(row);
    }

    await refreshHeaders(next);
    setHeaderName("");
    setHeaderValue("");
    setHeaderMessage(index >= 0 ? "Header updated." : "Header added.");
  }

  async function handleToggleHeader(name, enabled) {
    setHeaderError(null);
    setHeaderMessage(null);
    const next = connectionHeaders.map((entry) =>
      entry.name === name ? { ...entry, enabled } : entry
    );
    await refreshHeaders(next);
    setHeaderMessage(enabled ? "Header enabled." : "Header disabled.");
  }

  async function handleRemoveHeader(name) {
    setHeaderError(null);
    setHeaderMessage(null);
    await removeWsHeader(name);
    const next = connectionHeaders.filter((entry) => entry.name !== name);
    await refreshHeaders(next);
    setHeaderMessage("Header removed.");
  }

  async function handleImportHeaders(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setHeaderError(null);
    setHeaderMessage(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const { added, updated } = await importWsHeaders(parsed, { merge: true });
      await onConnectionHeadersChange();
      setHeaderMessage(`Import complete: ${added} added, ${updated} updated.`);
    } catch (err) {
      setHeaderError(err.message || "Invalid import file.");
    }
  }

  async function handleExportHeaders() {
    setHeaderError(null);
    setHeaderMessage(null);
    try {
      const data = await exportWsHeaders();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ws-connection-headers.json";
      link.click();
      URL.revokeObjectURL(url);
      setHeaderMessage(`Exported ${data.length} header(s).`);
    } catch (err) {
      setHeaderError(err.message || "Could not export headers.");
    }
  }

  return (
    <div class="menu-section">
      <button type="button" class="menu-back" onClick={onBack}>
        ← Back
      </button>

      <label for="theme-mode">Color theme</label>
      <select
        id="theme-mode"
        value={themePreference}
        onChange={(e) => onThemeChange(e.currentTarget.value)}
      >
        {THEME_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {mode === "auto" ? "Auto (system)" : mode.charAt(0).toUpperCase() + mode.slice(1)}
          </option>
        ))}
      </select>

      <label for="help-example-wrap">Help example layout</label>
      <select
        id="help-example-wrap"
        value={helpExampleWrap}
        onChange={(e) => onHelpExampleWrapChange(e.currentTarget.value)}
      >
        {HELP_EXAMPLE_WRAP_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {mode === "nowrap" ? "Single line (scroll)" : "Wrap text"}
          </option>
        ))}
      </select>
      <p class="menu-hint">
        Controls how DNS record examples are displayed in record-type help.
      </p>

      <label for="http-server-url">Server URL (HTTP/HTTPS)</label>
      <input
        id="http-server-url"
        type="url"
        placeholder="http://localhost:4545/some/path"
        autocomplete="off"
        value={httpServerUrl}
        onInput={(e) => onHttpServerUrlChange(e.currentTarget.value)}
      />
      {derivedWsUrl ? (
        <p class="menu-hint">
          WebSocket: <code>{derivedWsUrl}</code>
        </p>
      ) : httpServerUrl.trim() ? (
        <p class="menu-error">Enter a valid http:// or https:// URL.</p>
      ) : (
        <p class="menu-hint">Derives the WebSocket URL, e.g. http://host/path → ws://host/path/ws</p>
      )}

      <label for="ws-url">WebSocket URL</label>
      <select
        id="ws-url"
        value={usingHttpDerivation ? "" : selectedWsUrl}
        disabled={usingHttpDerivation}
        onChange={(e) => onWsUrlChange(e.currentTarget.value)}
      >
        {usingHttpDerivation && (
          <option value="" disabled>
            Using server URL above
          </option>
        )}
        {wsUrls.map((url) => (
          <option key={url} value={url}>
            {url}
          </option>
        ))}
      </select>

      <label for="dns-server">DNS server</label>
      <select
        id="dns-server"
        value={selectedDnsAddress}
        onChange={(e) => onDnsServerChange(e.currentTarget.value)}
      >
        {dnsOptions.map((option) => (
          <option key={option.address} value={option.address}>
            {option.label} ({option.resolvedAddress})
          </option>
        ))}
      </select>

      <hr class="menu-divider" />
      <p class="menu-nav__section-label">Custom DNS servers</p>

      <form class="menu-form" onSubmit={handleAddCustom}>
        <label for="custom-dns-address">Add DNS server</label>
        <input
          id="custom-dns-address"
          type="text"
          placeholder="8.8.8.8"
          value={customAddress}
          onInput={(e) => setCustomAddress(e.currentTarget.value)}
        />
        <input
          type="text"
          placeholder="Label (optional)"
          value={customLabel}
          onInput={(e) => setCustomLabel(e.currentTarget.value)}
        />
        <button type="submit">Add server</button>
      </form>

      {customOptions.length > 0 && (
        <ul class="dns-list">
          {customOptions.map((option) => (
            <li key={option.address}>
              <span>
                {option.label} ({option.address})
              </span>
              <button type="button" onClick={() => handleRemoveCustom(option.address)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div class="menu-row">
        <button type="button" onClick={() => dnsFileInputRef.current?.click()}>
          Import JSON
        </button>
        <button type="button" onClick={handleExportCustom}>
          Export JSON
        </button>
        <input
          ref={dnsFileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleImportCustom}
        />
      </div>

      {dnsMessage && <p class="menu-message">{dnsMessage}</p>}
      {dnsError && <p class="menu-error">{dnsError}</p>}

      <hr class="menu-divider" />

      <label for="menu-api-key">API key</label>
      {hasApiKey && (
        <p class="menu-hint">A saved API key is in use. Enter a new one to replace the builtin header.</p>
      )}
      <div class="menu-row">
        <input
          id="menu-api-key"
          type="password"
          placeholder="server API key"
          autocomplete="off"
          value={apiKeyInput}
          onInput={(e) => onApiKeyInput(e.currentTarget.value)}
        />
        <button type="button" onClick={onApiKeySave}>
          Connect
        </button>
      </div>

      <hr class="menu-divider" />
      <p class="menu-nav__section-label">Connection headers</p>
      <p class="menu-hint">
        Browsers cannot attach custom HTTP headers to WebSocket handshakes. Enabled headers are
        sent as query parameters (e.g. <code>Authorization</code> → <code>?authorization=…</code>).
        Configure your reverse proxy to map them to real HTTP headers when needed.
      </p>

      {headersAreSuggestions && (
        <p class="menu-hint menu-hint--suggestion">
          Showing suggested headers from <code>config.json</code>. Add or save one to persist.
        </p>
      )}

      {displayedHeaders.length > 0 && (
        <ul class="ws-header-list">
          {displayedHeaders.map((header) => (
            <li key={header.name} class="ws-header-list__item">
              <div class="ws-header-list__info">
                <strong>{header.name}</strong>
                <span class="ws-header-list__value">{maskHeaderValue(header.value)}</span>
                {header.suggestion && <span class="ws-header-list__badge">suggested</span>}
                {header.builtin && <span class="ws-header-list__badge">builtin</span>}
              </div>
              <div class="ws-header-list__actions">
                {!header.suggestion && (
                  <label class="ws-header-list__toggle">
                    <input
                      type="checkbox"
                      checked={header.enabled !== false}
                      onChange={(e) => handleToggleHeader(header.name, e.currentTarget.checked)}
                    />
                    On
                  </label>
                )}
                {!header.suggestion && !header.builtin && (
                  <button type="button" onClick={() => handleRemoveHeader(header.name)}>
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form class="menu-form" onSubmit={handleAddHeader}>
        <label for="ws-header-name">Add connection header</label>
        <input
          id="ws-header-name"
          type="text"
          placeholder="Authorization"
          value={headerName}
          onInput={(e) => setHeaderName(e.currentTarget.value)}
        />
        <input
          type="password"
          placeholder="Header value"
          autocomplete="off"
          value={headerValue}
          onInput={(e) => setHeaderValue(e.currentTarget.value)}
        />
        <button type="submit">Save header</button>
      </form>

      <div class="menu-row">
        <button type="button" onClick={() => headerFileInputRef.current?.click()}>
          Import JSON
        </button>
        <button type="button" onClick={handleExportHeaders} disabled={connectionHeaders.length === 0}>
          Export JSON
        </button>
        <input
          ref={headerFileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleImportHeaders}
        />
      </div>

      {headerMessage && <p class="menu-message">{headerMessage}</p>}
      {headerError && <p class="menu-error">{headerError}</p>}
    </div>
  );
}

function HistoryPanel({ onRunLookupSetup, onQuickLookupsChange, dnsOptions, onBack }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listHistory()
      .then((items) => {
        if (!cancelled) setEntries(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load history.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleClear() {
    if (!window.confirm("Clear all lookup history?")) return;
    setError(null);
    setMessage(null);
    await clearHistory();
    setEntries([]);
    setMessage("History cleared.");
  }

  async function handleSaveAsQuickLookup(entry) {
    const defaultName = suggestQuickLookupName(entry.domain, entry.recordTypes);
    const name = window.prompt("Quick lookup name:", defaultName);
    if (!name?.trim()) return;

    const includeDnsServer = window.confirm(
      `Include DNS server ${entry.dnsServerResolved} in this quick lookup?\n\nOK = save with DNS override\nCancel = domain and record types only`
    );

    setError(null);
    setMessage(null);
    try {
      await addQuickLookup({
        name: name.trim(),
        domain: entry.domain,
        recordTypes: entry.recordTypes,
        includeDnsServer,
        dnsServerAddress: includeDnsServer ? entry.dnsServerAddress : null,
      });
      const presets = await listQuickLookups();
      onQuickLookupsChange(presets);
      setMessage(`Saved quick lookup "${name.trim()}".`);
    } catch (err) {
      setError(err.message || "Could not save quick lookup.");
    }
  }

  return (
    <div class="menu-section">
      <button type="button" class="menu-back" onClick={onBack}>
        ← Back
      </button>

      {loading && <p class="menu-hint">Loading history…</p>}
      {!loading && entries.length === 0 && (
        <p class="menu-empty">No lookups yet. Run a query to build history.</p>
      )}

      {entries.length > 0 && (
        <ul class="history-list">
          {entries.map((entry) => (
            <li key={entry.id} class="history-list__item">
              <button
                type="button"
                class="history-list__run"
                onClick={() =>
                  onRunLookupSetup({
                    domain: entry.domain,
                    recordTypes: entry.recordTypes,
                    includeDnsServer: true,
                    dnsServerAddress: entry.dnsServerAddress,
                    overrideSource: "history",
                  })
                }
              >
                <span class="history-list__domain">{entry.domain}</span>
                <span class="history-list__meta">
                  {entry.recordTypes.join(", ")} · {entry.dnsServerResolved} ·{" "}
                  {formatHistoryTime(entry.timestamp)}
                </span>
              </button>
              <button
                type="button"
                class="history-list__save"
                onClick={() => handleSaveAsQuickLookup(entry)}
              >
                Save as Quick Lookup
              </button>
            </li>
          ))}
        </ul>
      )}

      {entries.length > 0 && (
        <button type="button" class="history-clear" onClick={handleClear}>
          Clear History
        </button>
      )}

      {message && <p class="menu-message">{message}</p>}
      {error && <p class="menu-error">{error}</p>}
    </div>
  );
}

function QuickLookupsPanel({
  quickLookups,
  onQuickLookupsChange,
  currentDomain,
  currentRecordTypes,
  currentDnsServerAddress,
  dnsOptions,
  onBack,
}) {
  const [name, setName] = useState("");
  const [includeDnsServer, setIncludeDnsServer] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const trimmedDomain = currentDomain.trim();
  const canSaveCurrent = trimmedDomain && currentRecordTypes.length > 0;
  const defaultName = canSaveCurrent
    ? suggestQuickLookupName(trimmedDomain, currentRecordTypes)
    : "";

  async function refresh() {
    const items = await listQuickLookups();
    onQuickLookupsChange(items);
  }

  async function handleSaveCurrent(event) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const presetName = (name.trim() || defaultName).trim();
    if (!presetName) {
      setError("Enter a name for the quick lookup.");
      return;
    }
    if (!canSaveCurrent) {
      setError("Set a domain and at least one record type on the main form first.");
      return;
    }

    await addQuickLookup({
      name: presetName,
      domain: trimmedDomain,
      recordTypes: currentRecordTypes,
      includeDnsServer,
      dnsServerAddress: includeDnsServer ? currentDnsServerAddress : null,
    });
    setName("");
    setMessage(`Saved quick lookup "${presetName}".`);
    await refresh();
  }

  async function handleRename(id) {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setError("Name cannot be empty.");
      return;
    }
    setError(null);
    await updateQuickLookup(id, { name: trimmed });
    setEditingId(null);
    setEditingName("");
    setMessage("Quick lookup renamed.");
    await refresh();
  }

  async function handleRemove(id, name) {
    if (!window.confirm(`Delete quick lookup "${name}"?`)) return;
    setError(null);
    await removeQuickLookup(id);
    setMessage("Quick lookup removed.");
    await refresh();
  }

  async function handleToggleDns(id, nextInclude) {
    setError(null);
    const preset = quickLookups.find((item) => item.id === id);
    if (!preset) return;

    await updateQuickLookup(id, {
      includeDnsServer: nextInclude,
      dnsServerAddress: nextInclude
        ? preset.dnsServerAddress || currentDnsServerAddress
        : null,
    });
    setMessage(nextInclude ? "DNS server will be applied with this quick lookup." : "DNS server removed from quick lookup.");
    await refresh();
  }

  async function handleReorder(id, direction) {
    setError(null);
    await reorderQuickLookups(id, direction);
    await refresh();
  }

  async function handleImport(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setError(null);
    setMessage(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array.");
      const { added, skipped } = await importQuickLookups(parsed);
      setMessage(`Import complete: ${added} added, ${skipped} skipped.`);
      await refresh();
    } catch (err) {
      setError(err.message || "Invalid import file.");
    }
  }

  async function handleExport() {
    const data = await exportQuickLookups();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "quick-lookups.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${data.length} quick lookup(s).`);
  }

  return (
    <div class="menu-section">
      <button type="button" class="menu-back" onClick={onBack}>
        ← Back
      </button>

      <form class="menu-form" onSubmit={handleSaveCurrent}>
        <label for="quick-lookup-name">Save current form as quick lookup</label>
        <input
          id="quick-lookup-name"
          type="text"
          placeholder={defaultName || "A+AAAA example.com"}
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <button type="submit" disabled={!canSaveCurrent}>
          Save quick lookup
        </button>
      </form>
      <label class="quick-lookup-option">
        <input
          type="checkbox"
          checked={includeDnsServer}
          onChange={(e) => setIncludeDnsServer(e.currentTarget.checked)}
        />
        Include DNS server: {dnsServerLabel(currentDnsServerAddress, dnsOptions)}
      </label>
      {!canSaveCurrent && (
        <p class="menu-hint">Fill in the main lookup form to save a new preset.</p>
      )}

      <div class="menu-row">
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          Import JSON
        </button>
        <button type="button" onClick={handleExport} disabled={quickLookups.length === 0}>
          Export JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleImport}
        />
      </div>
      <p class="menu-hint">
        Import expects a JSON array of{" "}
        <code>{`{ name, domain, recordTypes, includeDnsServer?, dnsServerAddress? }`}</code>{" "}
        objects. Duplicate names are skipped.
      </p>

      {quickLookups.length === 0 ? (
        <p class="menu-empty">No quick lookups yet. Save one from the form or import JSON.</p>
      ) : (
        <ul class="quick-lookup-list">
          {quickLookups.map((preset, index) => (
            <li key={preset.id} class="quick-lookup-list__item">
              {editingId === preset.id ? (
                <div class="quick-lookup-list__edit">
                  <input
                    type="text"
                    value={editingName}
                    onInput={(e) => setEditingName(e.currentTarget.value)}
                  />
                  <button type="button" onClick={() => handleRename(preset.id)}>
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setEditingName("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div class="quick-lookup-list__info">
                    <strong>{preset.name}</strong>
                    <span class="quick-lookup-list__meta">
                      {preset.recordTypes.join(", ")} · {preset.domain}
                      {preset.includeDnsServer && preset.dnsServerAddress ? (
                        <> · DNS: {dnsServerLabel(preset.dnsServerAddress, dnsOptions)}</>
                      ) : (
                        <> · current resolver</>
                      )}
                    </span>
                    <label class="quick-lookup-option quick-lookup-option--inline">
                      <input
                        type="checkbox"
                        checked={preset.includeDnsServer}
                        onChange={(e) => handleToggleDns(preset.id, e.currentTarget.checked)}
                      />
                      Override DNS server when run
                    </label>
                  </div>
                  <div class="quick-lookup-list__actions">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleReorder(preset.id, "up")}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === quickLookups.length - 1}
                      onClick={() => handleReorder(preset.id, "down")}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(preset.id);
                        setEditingName(preset.name);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      class="quick-lookup-list__delete"
                      onClick={() => handleRemove(preset.id, preset.name)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {message && <p class="menu-message">{message}</p>}
      {error && <p class="menu-error">{error}</p>}
    </div>
  );
}

function AboutPanel({ onBack }) {
  const [backendVersion, setBackendVersion] = useState(null);
  const [backendError, setBackendError] = useState(null);

  useEffect(() => {
    fetch("/version")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setBackendVersion(data))
      .catch((err) => setBackendError(err.message));
  }, []);

  return (
    <div class="menu-section">
      <button type="button" class="menu-back" onClick={onBack}>
        ← Back
      </button>

      <div class="about-block">
        <h3>Webapp</h3>
        <dl>
          <dt>Version</dt>
          <dd>{buildInfo.version}</dd>
          <dt>Git hash</dt>
          <dd>{buildInfo.gitHash}</dd>
          <dt>Built</dt>
          <dd>{buildInfo.buildTime}</dd>
        </dl>
      </div>

      <div class="about-block">
        <h3>Backend</h3>
        {backendVersion ? (
          <dl>
            <dt>Version</dt>
            <dd>{backendVersion.version}</dd>
            <dt>Git hash</dt>
            <dd>{backendVersion.gitHash}</dd>
            <dt>Built</dt>
            <dd>{backendVersion.buildTime}</dd>
          </dl>
        ) : (
          <p class="menu-error">{backendError || "Loading backend version…"}</p>
        )}
      </div>
    </div>
  );
}
