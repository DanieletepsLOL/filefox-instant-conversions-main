const AUTH_KEY = "filefox:auth-token";
const EMAIL_KEY = "filefox:user-email";

type AuthListener = () => void;
const authListeners = new Set<AuthListener>();

function dispatchAuthChange() {
  authListeners.forEach((listener) => listener());
}

export function loginUser(email: string, token = "authenticated") {
  if (typeof window === "undefined") return false;

  localStorage.setItem(AUTH_KEY, token);
  localStorage.setItem(EMAIL_KEY, email);
  dispatchAuthChange();

  return true;
}

export function logoutUser() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(EMAIL_KEY);
  dispatchAuthChange();
}

export function isAuthenticated() {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(AUTH_KEY));
}

export function getUserEmail() {
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem(EMAIL_KEY) ?? undefined;
}

export function subscribeAuthChange(listener: AuthListener) {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}
