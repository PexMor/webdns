import { useAuthExpired } from "./authProxyStore";

function handleSignIn() {
  // Top-level navigation only: a background fetch cannot complete the
  // identity provider's login flow or receive the fresh session cookie.
  window.location.assign(window.location.href);
}

export function AuthExpiredOverlay() {
  const expired = useAuthExpired();

  if (!expired) return null;

  return (
    <div class="auth-expired-overlay" role="presentation">
      <div
        class="auth-expired-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="auth-expired-title"
        aria-describedby="auth-expired-body"
      >
        <h2 id="auth-expired-title">Session expired</h2>
        <p id="auth-expired-body">
          Your sign-in has expired. The app can't reach the server until you sign in again.
        </p>
        <button type="button" class="auth-expired-signin" onClick={handleSignIn}>
          Sign in again
        </button>
      </div>
    </div>
  );
}
