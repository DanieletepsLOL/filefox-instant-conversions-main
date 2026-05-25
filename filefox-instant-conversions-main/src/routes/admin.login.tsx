import { FormEvent, useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ShieldAlert, KeyRound, Mail } from "lucide-react";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Filefox Admin - Iniciar sesión" },
      { name: "description", content: "Panel de administración de Filefox." },
    ],
  }),
  component: AdminLogin,
});

const ADMIN_EMAIL = "admin@filefoxadmins.com";

function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [passwordOrToken, setPasswordOrToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isAdminEmail = email.trim().toLowerCase() === ADMIN_EMAIL;

  // Verificar si ya hay sesión de admin activa
  useEffect(() => {
    const adminToken = localStorage.getItem("filefox:admin-token");
    if (adminToken) {
      router.navigate({ to: "/admin" });
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !passwordOrToken.trim()) {
      setError("Debes ingresar correo y contraseña.");
      return;
    }

    // Si es el email de admin, usar login con token
    if (isAdminEmail) {
      setLoading(true);
      try {
        const response = await fetch("/api/auth/admin-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            admin_token: passwordOrToken,
          }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          setError(data?.message ?? "Token inválido.");
          return;
        }

        // Guardar token de admin
        localStorage.setItem("filefox:admin-token", data.admin_token);
        router.navigate({ to: "/admin" });
      } catch {
        setError("No se pudo conectar con el servidor.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Usuario normal - login con email y contraseña
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: passwordOrToken,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "Credenciales inválidas.");
        return;
      }

      // Guardar sesión normal
      localStorage.setItem("filefox:access-token", data.access_token || "");
      localStorage.setItem("filefox:refresh-token", data.refresh_token || "");
      localStorage.setItem("filefox:user-email", data?.user?.email ?? email.trim());
      localStorage.setItem("filefox:user-name", data?.user?.name ?? "");
      router.navigate({ to: "/dashboard" });
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 md:px-6 py-16">
        <div className="mx-auto w-full max-w-md rounded-3xl border bg-card p-8 shadow-[var(--shadow-card)]">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {isAdminEmail ? (
                <ShieldAlert className="h-7 w-7" />
              ) : (
                <Mail className="h-7 w-7" />
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isAdminEmail ? "Admin Panel" : "Iniciar sesión"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isAdminEmail
                ? "Ingresa tu token de administrador para acceder al panel."
                : "Accede a tu panel de Filefox para ver tus archivos."}
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
                  setPasswordOrToken(""); // Limpiar al cambiar email
                  setError("");
                }}
                className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="usuario@ejemplo.com"
              />
            </label>

            <label className="block text-sm font-medium text-foreground">
              {isAdminEmail ? "Token de Administrador" : "Contraseña"}
              <div className="relative mt-2">
                <input
                  type={isAdminEmail ? "text" : "password"}
                  value={passwordOrToken}
                  onChange={(event) => setPasswordOrToken(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder={isAdminEmail ? "Ingresa tu token de admin" : "Ingresa tu contraseña"}
                />
                {isAdminEmail && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-primary">
                    <KeyRound className="h-5 w-5" />
                  </div>
                )}
              </div>
            </label>

            {error && (
              <div className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full bg-primary text-white hover:opacity-90"
              disabled={loading}
            >
              {loading
                ? "Entrando..."
                : isAdminEmail
                  ? "Acceder como Admin"
                  : "Iniciar sesión"}
            </Button>
          </form>

          {!isAdminEmail && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              &iquest;No tienes cuenta?{" "}
              <a href="/register" className="font-medium text-primary hover:underline">
                Reg&iacute;strate
              </a>
            </p>
          )}

          {isAdminEmail && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Token generado desde el servidor. Ejecuta:{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
                sudo bash generate-admin-token.sh
              </code>
            </p>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
