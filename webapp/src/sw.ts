/// <reference lib="webworker" />
import { cleanupOutdatedCaches, PrecacheController } from "workbox-precaching";
import type { WorkboxPlugin } from "workbox-core/types.js";

declare const self: ServiceWorkerGlobalScope;

const CONFIG_PATH = "config.json";
const NAVIGATE_FALLBACK_URL = "index.html";

let identityProxyEnabled = false;
let identityProxyProbePath = "/version";

/**
 * A redirect/opaqueredirect status, or HTML where a non-HTML asset was
 * expected, means an identity-aware proxy (Cloudflare Access-style) swapped
 * the real response for its own login flow. Navigation requests are exempt
 * from the HTML check (a full top-level navigation to an expired session is
 * expected to land the user on the proxy's own login page), and so are
 * requests for URLs that are themselves `.html` assets — this app precaches
 * a legitimate static `icons/icon.html` file, which must not be mistaken
 * for an intercept.
 */
function isAuthIntercept(request: Request, response: Response): boolean {
  if (response.type === "opaqueredirect") return true;
  if (response.status >= 300 && response.status < 400) return true;
  if (request.mode === "navigate") return false;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return false;

  const pathname = new URL(request.url).pathname;
  return !pathname.endsWith(".html");
}

async function notifyClientsAuthExpired(): Promise<void> {
  // Only meaningful when the deployment actually sits behind an identity
  // proxy: on a disabled/local deployment, a bad response is just a bad
  // response, not a reason to show the blocking re-login overlay.
  if (!identityProxyEnabled) return;

  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage({ type: "AUTH_EXPIRED" });
  }
}

/**
 * Guards precache population (run during `install`): never let an
 * auth-intercept response get written into the cache under a real asset's
 * key, and tell open tabs when it happens. Skipping the cache write is safe
 * to do unconditionally (a redirect/wrong-content-type response should
 * never be cached as if it were the real asset); only the client
 * notification is gated on `identityProxyEnabled` (see above).
 */
const authInterceptGuard: WorkboxPlugin = {
  async cacheWillUpdate({ request, response }) {
    if (isAuthIntercept(request, response)) {
      await notifyClientsAuthExpired();
      return null;
    }
    return response;
  },
};

cleanupOutdatedCaches();

const precacheController = new PrecacheController({ plugins: [authInterceptGuard] });
precacheController.precache(self.__WB_MANIFEST);

async function loadIdentityProxyConfig(): Promise<void> {
  try {
    const response = await fetch(CONFIG_PATH, { cache: "no-store" });
    if (!response.ok) return;
    const data: unknown = await response.json();
    const proxy =
      data && typeof data === "object" ? (data as Record<string, unknown>).identityProxy : null;
    if (!proxy || typeof proxy !== "object") return;

    const candidate = proxy as Record<string, unknown>;
    identityProxyEnabled = candidate.enabled === true;
    if (typeof candidate.probePath === "string" && candidate.probePath.trim()) {
      identityProxyProbePath = candidate.probePath;
    }
  } catch {
    // Offline or config.json unreachable during activate: keep defaults.
  }
}

async function checkProbeOnActivate(): Promise<void> {
  if (!identityProxyEnabled) return;
  try {
    const response = await fetch(identityProxyProbePath, {
      cache: "no-store",
      redirect: "manual",
    });
    if (response.type === "opaqueredirect" || !response.ok) {
      await notifyClientsAuthExpired();
    }
  } catch {
    // Offline during activate: not an auth signal.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await loadIdentityProxyConfig();
      await precacheController.install(event);
    })()
  );
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await precacheController.activate(event);
      await loadIdentityProxyConfig();
      await checkProbeOnActivate();
    })()
  );
  void self.clients.claim();
});

function isNetworkOnlyPath(pathname: string): boolean {
  return pathname === CONFIG_PATH || pathname === identityProxyProbePath;
}

/**
 * Network-first with an offline fallback to the precached app shell.
 * Auth-intercept responses are notified but still shown as the page's
 * content: a real top-level navigation to an expired session is expected
 * to land on the proxy's own login page.
 */
async function handleNavigate(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (isAuthIntercept(request, response)) {
      await notifyClientsAuthExpired();
    }
    return response;
  } catch {
    const cached = await precacheController.matchPrecache(NAVIGATE_FALLBACK_URL);
    if (cached) return cached;
    throw new Error("offline and app shell not cached");
  }
}

/** Always hits the network; never masks an intercept behind a cached copy. */
async function handleNetworkOnly(request: Request): Promise<Response> {
  const response = await fetch(request, { cache: "no-store" });
  if (isAuthIntercept(request, response)) {
    await notifyClientsAuthExpired();
  }
  return response;
}

async function handlePrecached(request: Request): Promise<Response> {
  const cached = await precacheController.matchPrecache(request);
  if (cached) return cached;
  return fetch(request);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigate(request));
    return;
  }

  const url = new URL(request.url);
  if (isNetworkOnlyPath(url.pathname)) {
    event.respondWith(handleNetworkOnly(request));
    return;
  }

  event.respondWith(handlePrecached(request));
});
