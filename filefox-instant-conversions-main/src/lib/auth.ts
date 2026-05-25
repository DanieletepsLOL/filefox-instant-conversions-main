const ACCESS_TOKEN_KEY = "filefox:access-token";
const REFRESH_TOKEN_KEY = "filefox:refresh-token";
const EMAIL_KEY = "filefox:user-email";
const NAME_KEY = "filefox:user-name";

// Keys para sesión de administrador
const ADMIN_TOKEN_KEY = "filefox:admin-token";
const ADMIN_EMAIL_KEY = "filefox:admin-email";

const ADMIN_EMAIL = "admin@filefoxadmins.com";

type AuthListener = () => void;
const authListeners = new Set<AuthListener>();

function dispatchAuthChange() {
  authListeners.forEach((listener) => listener());
}

export function isAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

export function loginUser(email: string, name: string, accessToken: string, refreshToken: string) {
  if (typeof window === "undefined") return false;

  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(EMAIL_KEY, email);
  localStorage.setItem(NAME_KEY, name);
  // Limpiar sesión de admin si existe
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_EMAIL_KEY);
  dispatchAuthChange();

  return true;
}

export function loginAdmin(adminToken: string) {
  if (typeof window === "undefined") return false;

  localStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
  localStorage.setItem(ADMIN_EMAIL_KEY, ADMIN_EMAIL);
  // Limpiar sesión de usuario normal
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
  localStorage.removeItem(NAME_KEY);
  dispatchAuthChange();

  return true;
}

export function logoutUser() {
  if (typeof window === "undefined") return;

  // Intentar invalidar refresh token en el servidor
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (accessToken) {
    fetch("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {});
  }

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_EMAIL_KEY);
  dispatchAuthChange();
}

export function isAuthenticated() {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(ACCESS_TOKEN_KEY)) || Boolean(localStorage.getItem(ADMIN_TOKEN_KEY));
}

export function isAdmin() {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(ADMIN_TOKEN_KEY));
}

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getAdminToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getUserEmail() {
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem(EMAIL_KEY) ?? undefined;
}

export function getUserName() {
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem(NAME_KEY) ?? undefined;
}

/**
 * Intenta renovar el access token usando el refresh token.
 * Devuelve el nuevo access token o null si falla.
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      // Si el refresh token también expiró, cerrar sesión
      logoutUser();
      return null;
    }

    const data = await response.json();
    localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    return data.access_token;
  } catch {
    logoutUser();
    return null;
  }
}

/**
 * Hace una petición fetch con renovación automática de token.
 * Si el token expira (401), lo renueva y reintenta la petición.
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("No autenticado");
  }

  // Primera intento con el token actual
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  // Si el token expiró, renovarlo y reintentar
  if (response.status === 401) {
    const data = await response.json().catch(() => ({}));
    if (data.code === "TOKEN_EXPIRED") {
      const newToken = await refreshAccessToken();
      if (newToken) {
        response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${newToken}`,
          },
        });
      }
    }
  }

  return response;
}

export function subscribeAuthChange(listener: AuthListener) {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}
