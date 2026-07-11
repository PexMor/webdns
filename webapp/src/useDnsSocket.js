import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { setApiKey } from "./apiKeyStore.js";
import { buildWsUrlWithHeaders } from "./loadConfig.js";
import {
  BUILTIN_APIKEY_NAME,
  hasEnabledCredentials,
  setWsHeaders,
  upsertBuiltinApiKey,
} from "./wsHeaderStore.js";

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const RECONNECT_BACKOFF_FACTOR = 2;

function closeLabel(event) {
  if (event.code === 1006 || event.code === 1008 || event.code === 1002) {
    return "connection failed (check credentials)";
  }
  if (event.code === 1000) {
    return "disconnected";
  }
  return "disconnected";
}

function reconnectDelayMs(attempt) {
  return Math.min(
    INITIAL_RECONNECT_DELAY_MS * RECONNECT_BACKOFF_FACTOR ** attempt,
    MAX_RECONNECT_DELAY_MS
  );
}

function hasBuiltinApiKey(headers) {
  return headers.some(
    (header) =>
      header.enabled &&
      header.value &&
      header.name.toLowerCase() === BUILTIN_APIKEY_NAME
  );
}

export function useDnsSocket(
  wsUrl,
  { connectionHeaders = [], queryMap = {}, credentialsReady = false } = {}
) {
  const [status, setStatus] = useState("error");
  const [statusLabel, setStatusLabel] = useState("loading…");
  const [hasCredentials, setHasCredentials] = useState(false);
  const [response, setResponse] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const wsRef = useRef(null);
  const headersRef = useRef([]);
  const queryMapRef = useRef(queryMap);
  const connectionGenRef = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);

  headersRef.current = connectionHeaders;
  queryMapRef.current = queryMap;

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    connectionGenRef.current += 1;
    if (wsRef.current) {
      console.log("[ws] disconnect requested");
      wsRef.current.close(1000);
      wsRef.current = null;
    }
  }, [clearReconnectTimer]);

  const startSocket = useCallback(
    (gen) => {
      const headers = headersRef.current;
      if (!hasEnabledCredentials(headers) || !wsUrl) return;

      setStatus("connecting");
      setStatusLabel(
        reconnectAttemptRef.current > 0
          ? `reconnecting (attempt ${reconnectAttemptRef.current + 1})…`
          : "connecting…"
      );

      const socketUrl = buildWsUrlWithHeaders(wsUrl, headers, queryMapRef.current);
      const logUrl = new URL(socketUrl);
      for (const [key] of logUrl.searchParams) {
        logUrl.searchParams.set(key, "••••••");
      }

      console.log(
        `[ws] connecting to ${logUrl.toString()}` +
          (reconnectAttemptRef.current > 0
            ? ` (reconnect attempt ${reconnectAttemptRef.current + 1})`
            : "")
      );

      const ws = new WebSocket(socketUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (gen !== connectionGenRef.current || wsRef.current !== ws) return;
        if (ws.readyState !== WebSocket.OPEN) return;

        if (reconnectAttemptRef.current > 0) {
          console.log(
            `[ws] reconnected after ${reconnectAttemptRef.current} failed attempt(s)`
          );
        } else {
          console.log(`[ws] connected to ${wsUrl}`);
        }

        reconnectAttemptRef.current = 0;
        setStatus("connected");
        setStatusLabel("connected");
      };

      ws.onclose = (event) => {
        if (gen !== connectionGenRef.current) return;
        if (wsRef.current === ws) {
          wsRef.current = null;
        }

        const label = closeLabel(event);
        console.log(
          `[ws] disconnected (code=${event.code}, reason=${event.reason || "none"})`
        );
        setStatus("error");
        setStatusLabel(label);

        const attempt = reconnectAttemptRef.current;
        const delay = reconnectDelayMs(attempt);
        reconnectAttemptRef.current = attempt + 1;

        console.log(
          `[ws] scheduling reconnect attempt ${attempt + 1} in ${delay}ms (${label})`
        );
        setStatus("connecting");
        setStatusLabel(`reconnecting in ${Math.round(delay / 1000)}s…`);

        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          if (gen !== connectionGenRef.current) {
            console.log("[ws] reconnect cancelled (connection superseded)");
            return;
          }
          if (!hasEnabledCredentials(headersRef.current) || !wsUrl) return;
          console.log(`[ws] reconnect attempt ${attempt + 1} starting`);
          startSocket(gen);
        }, delay);
      };

      ws.onmessage = (event) => {
        if (gen !== connectionGenRef.current || wsRef.current !== ws) return;

        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          setErrorMessage("Received malformed response from server");
          setResponse(null);
          return;
        }
        if (data.error) {
          setErrorMessage(data.error);
          setResponse(null);
          return;
        }
        setErrorMessage(null);
        setResponse(data);
      };
    },
    [wsUrl]
  );

  const connect = useCallback(
    ({ resetBackoff = true } = {}) => {
      const headers = headersRef.current;
      if (!hasEnabledCredentials(headers)) {
        setStatus("error");
        setStatusLabel("no connection credentials set");
        setHasCredentials(false);
        return;
      }

      if (!wsUrl) {
        setStatus("error");
        setStatusLabel("no WebSocket URL configured");
        return;
      }

      clearReconnectTimer();
      if (resetBackoff) {
        reconnectAttemptRef.current = 0;
      }
      disconnect();

      const gen = connectionGenRef.current;
      startSocket(gen);
    },
    [wsUrl, disconnect, clearReconnectTimer, startSocket]
  );

  useEffect(() => {
    if (!credentialsReady) return;

    setHasCredentials(hasEnabledCredentials(connectionHeaders));

    if (!hasEnabledCredentials(connectionHeaders)) {
      setStatus("error");
      setStatusLabel("no connection credentials set");
      return;
    }

    if (!wsUrl) {
      setStatus("error");
      setStatusLabel("no WebSocket URL configured");
      return;
    }

    connect();
    return disconnect;
  }, [credentialsReady, wsUrl, connectionHeaders, connect, disconnect]);

  const saveApiKey = useCallback(
    async (key) => {
      const trimmed = key?.trim();
      if (!trimmed) return;

      await setApiKey(trimmed);
      await upsertBuiltinApiKey(trimmed);
      setHasCredentials(true);
      connect();
    },
    [connect]
  );

  const saveConnectionHeaders = useCallback(
    async (headers) => {
      const saved = await setWsHeaders(headers);
      setHasCredentials(hasEnabledCredentials(saved));
      connect();
      return saved;
    },
    [connect]
  );

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  const query = useCallback((domain, recordTypes, dnsServer) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    const payload = { domain, record_types: recordTypes };
    if (dnsServer) {
      payload.dns_server = dnsServer;
    }

    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  return {
    status,
    statusLabel,
    hasApiKey: hasBuiltinApiKey(connectionHeaders) || hasCredentials,
    hasCredentials,
    response,
    errorMessage,
    connect,
    disconnect,
    reconnect,
    saveApiKey,
    saveConnectionHeaders,
    query,
  };
}
