import { useEffect, useState } from "preact/hooks";

/**
 * Module-level store for identity-proxy (Cloudflare Access-style) session
 * expiry. Needed because expiry can be detected outside the component tree
 * (main.tsx startup probe, the service worker's AUTH_EXPIRED message,
 * useDnsSocket's pre-reconnect probe) and must still reach the blocking
 * overlay rendered by App.
 */
type Listener = (expired: boolean) => void;

let authExpired = false;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener(authExpired);
}

export function isAuthExpired(): boolean {
  return authExpired;
}

export function reportAuthExpired(): void {
  if (authExpired) return;
  authExpired = true;
  notify();
}

export function clearAuthExpired(): void {
  if (!authExpired) return;
  authExpired = false;
  notify();
}

export function subscribeAuthExpired(listener: Listener): () => void {
  listeners.add(listener);
  listener(authExpired);
  return () => {
    listeners.delete(listener);
  };
}

export function useAuthExpired(): boolean {
  const [expired, setExpired] = useState(authExpired);
  useEffect(() => subscribeAuthExpired(setExpired), []);
  return expired;
}
