import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { setApiKey } from "./apiKeyStore";
import { buildWsUrlWithHeaders } from "./loadConfig";
import { probeSession } from "./authProbe";
import { clearAuthExpired, reportAuthExpired } from "./authProxyStore";
import {
  BUILTIN_APIKEY_NAME,
  hasEnabledCredentials,
  setWsHeaders,
  upsertBuiltinApiKey,
} from "./wsHeaderStore";
import type { DnsQueryResponse, IdentityProxyConfig, WsHeader } from "./types";

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const RECONNECT_BACKOFF_FACTOR = 2;

export type ConnectionStatus = "connecting" | "connected" | "error" | "auth-expired";

function closeLabel(event: CloseEvent): string {
  if (event.code === 1006 || event.code === 1008 || event.code === 1002) {
    return "connection failed (check credentials)";
  }
  if (event.code === 1000) {
    return "disconnected";
  }
  return "disconnected";
}

function reconnectDelayMs(attempt: number): number {
  return Math.min(
    INITIAL_RECONNECT_DELAY_MS * RECONNECT_BACKOFF_FACTOR ** attempt,
    MAX_RECONNECT_DELAY_MS
  );
}

function hasBuiltinApiKey(headers: WsHeader[]): boolean {
  return headers.some(
    (header) =>
      header.enabled &&
      header.value &&
      header.name.toLowerCase() === BUILTIN_APIKEY_NAME
  );
}

export interface UseDnsSocketOptions {
  connectionHeaders?: WsHeader[];
  queryMap?: Record<string, string>;
  credentialsReady?: boolean;
  identityProxy?: IdentityProxyConfig;
}

export function useDnsSocket(
  wsUrl: string,
  {
    connectionHeaders = [],
    queryMap = {},
    credentialsReady = false,
    identityProxy,
  }: UseDnsSocketOptions = {}
) {
  const [status, setStatus] = useState<ConnectionStatus>("error");
  const [statusLabel, setStatusLabel] = useState("loading…");
  const [hasCredentials, setHasCredentials] = useState(false);
  const [response, setResponse] = useState<DnsQueryResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const headersRef = useRef<WsHeader[]>([]);
  const queryMapRef = useRef<Record<string, string>>(queryMap);
  const identityProxyRef = useRef<IdentityProxyConfig | undefined>(identityProxy);
  const connectionGenRef = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingQueriesRef = useRef<
    Array<{
      resolve: (response: DnsQueryResponse) => void;
      reject: (error: Error) => void;
    }>
  >([]);

  headersRef.current = connectionHeaders;
  queryMapRef.current = queryMap;
  identityProxyRef.current = identityProxy;

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
    (gen: number) => {
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
        clearAuthExpired();
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

        const attempt = reconnectAttemptRef.current;

        const scheduleReconnect = () => {
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

        const proxy = identityProxyRef.current;
        if (proxy?.enabled) {
          setStatus("connecting");
          setStatusLabel("checking session…");

          probeSession(proxy.probePath).then((result) => {
            if (gen !== connectionGenRef.current) return;

            if (result === "expired") {
              console.log("[ws] session expired — halting reconnect loop");
              reportAuthExpired();
              setStatus("auth-expired");
              setStatusLabel("session expired — sign in required");
              return;
            }

            setStatus("error");
            setStatusLabel(label);
            scheduleReconnect();
          });
          return;
        }

        setStatus("error");
        setStatusLabel(label);
        scheduleReconnect();
      };

      ws.onmessage = (event) => {
        if (gen !== connectionGenRef.current || wsRef.current !== ws) return;

        let data: DnsQueryResponse;
        try {
          data = JSON.parse(event.data);
        } catch {
          const pending = pendingQueriesRef.current.shift();
          if (pending) {
            pending.reject(new Error("Received malformed response from server"));
            return;
          }
          setErrorMessage("Received malformed response from server");
          setResponse(null);
          return;
        }

        const pending = pendingQueriesRef.current.shift();
        if (pending) {
          if (data.error) {
            pending.reject(new Error(data.error));
          } else {
            pending.resolve(data);
          }
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
    ({ resetBackoff = true }: { resetBackoff?: boolean } = {}) => {
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
    async (key: string) => {
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
    async (headers: WsHeader[]) => {
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

  const query = useCallback((domain: string, recordTypes: string[], dnsServer?: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    const payload: { domain: string; record_types: string[]; dns_server?: string } = {
      domain,
      record_types: recordTypes,
    };
    if (dnsServer) {
      payload.dns_server = dnsServer;
    }

    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  const queryAsync = useCallback(
    (domain: string, recordTypes: string[], dnsServer?: string): Promise<DnsQueryResponse> => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error("Not connected to the server."));
      }

      return new Promise((resolve, reject) => {
        pendingQueriesRef.current.push({ resolve, reject });

        const payload: { domain: string; record_types: string[]; dns_server?: string } = {
          domain,
          record_types: recordTypes,
        };
        if (dnsServer) {
          payload.dns_server = dnsServer;
        }

        try {
          ws.send(JSON.stringify(payload));
        } catch (error) {
          pendingQueriesRef.current.pop();
          reject(error instanceof Error ? error : new Error("Failed to send query"));
        }
      });
    },
    []
  );

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
    queryAsync,
  };
}
