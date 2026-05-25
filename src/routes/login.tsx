import { FormEvent, useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ShieldAlert, KeyRound } from "lucide-react";
import { loginUser, loginAdmin, isAuthenticated, isAdminEmail } from "@/lib/auth";

type LoginResponse = {
  message?: string;
  access_token?: string;
  refresh_token?: string;
  user?: {
    email?: string;
    name?: string;
  };
};

type AdminLoginResponse = {
  message?: string;
  admin_token?: string;
  expires_in?: number;
};

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Filefox - Iniciar sesión" },
      { name: "description", content: "Inicia sesión en Filefox para acceder a tu panel y tus archivos." },
    ],
  }),
  component: Login,
});

function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [passwordOrToken, setPasswordOrToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isAdmin = isAdminEmail(email);

  useEffect(() => {
    if (isAuthenticated()) {
      const adminToken = localStorage.getItem("filefox:admin-token");
      if (adminToken) {
        router.navigate({ to: "/admin" });
      } else {
        router.navigate({ to: "/dashboard" });
      }
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !passwordOrToken.trim()) {
      setError("Debes ingresar correo y contraseña.");
      return;
    }

    setLoading(true);

    if (isAdminEmail(email)) {
      // === LOGIN DE ADMIN (usa token) ===
      try {
        const response = await fetch("/api/auth/admin-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            admin_token: passwordOrToken,
          }),
        });

        const data = (await response.json().catch(() => null)) as AdminLoginResponse | null;

        if (!response.ok) {
          setError(data?.message ?? "Token inválido.");
          return;
        }

        if (!data?.admin_token) {
          setError("Error al obtener el token de administrador.");
          return;
        }

        loginAdmin(data.admin_token);
        router.navigate({ to: "/admin" });
      } catch {
        setError("No se pudo conectar con el servidor.");
      } finally {
        setLoading(false);
      }
    } else {
      // === LOGIN DE USUARIO NORMAL (usa contraseña) ===
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            password: passwordOrToken,
          }),
        });

        const data = (await response.json().catch(() => null)) as LoginResponse | null;

        if (!response.ok) {
          setError(data?.message ?? "No se pudo iniciar sesión. Revisa tus datos.");
          return;
        }

        loginUser(
          data?.user?.email ?? email.trim(),
          data?.user?.name ?? "",
          data?.access_token ?? "",
          data?.refresh_token ?? ""
        );
        router.navigate({ to: "/dashboard" });
      } catch {
        setError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 md:px-6 py-16">
        <div className="mx-auto w-full max-w-md rounded-3xl border bg-card p-8 shadow-[var(--shadow-card)]">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {isAdmin ? <ShieldAlert className="h-7 w-7" /> : <KeyRound className="h-7 w-7" />}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Iniciar sesión</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isAdmin
                ? "Correo de administrador detectado. Ingresa tu token."
                : "Accede a tu panel de Filefox para ver tus archivos y convertir más rápido."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block text-sm font-medium text-foreground">
              Correo electrónico
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setPasswordOrToken("");
                  setError("");
                }}
                className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="usuario@ejemplo.com"
              />
            </label>

            <label className="block text-sm font-medium text-foreground">
              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  <span className="text-amber-500 font-semibold">Token de Administrador</span>
                </div>
              ) : (
                "Contraseña"
              )}
              <input
                type={isAdmin ? "text" : "password"}
                value={passwordOrToken}
                onChange={(event) => setPasswordOrToken(event.target.value)}
                className={`mt-2 w-full rounded-2xl border px-4 py-3 text-sm text-foreground outline-none focus:ring-2 ${
                  isAdmin
                    ? "border-amber-500/50 bg-amber-500/5 focus:border-amber-500 focus:ring-amber-500/20"
                    : "border-input bg-background focus:border-primary focus:ring-primary/20"
                }`}
                placeholder={isAdmin ? "Pega aquí tu token de administrador" : "Ingresa tu contraseña"}
              />
              {isAdmin && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Token generado desde el servidor con:{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
                    bash generate-admin-token.sh
                  </code>
                </p>
              )}
            </label>

            {error && (
              <div className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full rounded-full bg-primary text-white hover:opacity-90" disabled={loading}>
              {loading
                ? "Entrando..."
                : isAdmin
                  ? "Acceder al panel de administración"
                  : "Iniciar sesión"}
            </Button>
          </form>

          {!isAdmin && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              &iquest;No tienes cuenta?{" "}
              <a href="/register" className="font-medium text-primary hover:underline">
                Reg&iacute;strate
              </a>
            </p>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
