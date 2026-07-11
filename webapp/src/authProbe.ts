export type SessionProbeResult = "ok" | "expired" | "offline";

/**
 * Probes a same-origin resource to detect whether an identity-aware proxy
 * (e.g. Cloudflare Access) has intercepted the request because the user's
 * proxy session expired. Never follows redirects and never trusts caches,
 * since either would hide the intercept behind a stale "success" response.
 */
export async function probeSession(probePath: string): Promise<SessionProbeResult> {
  let response: Response;
  try {
    response = await fetch(probePath, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      credentials: "include",
    });
  } catch {
    return "offline";
  }

  if (response.type === "opaqueredirect") return "expired";
  if (response.status >= 300 && response.status < 400) return "expired";
  if (response.status >= 500) return "offline";

  const contentType = response.headers.get("content-type") ?? "";
  if (response.ok && contentType.includes("text/html")) return "expired";

  if (response.ok) return "ok";
  return "offline";
}
