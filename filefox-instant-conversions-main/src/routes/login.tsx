import { FormEvent, useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { loginUser, isAuthenticated } from "@/lib/auth";

type LoginResponse = {
  message?: string;
  token?: string;
  user?: {
    email?: string;
  };
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
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.navigate({ to: "/dashboard" });
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Debes ingresar correo y contraseña.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = (await response.json().catch(() => null)) as LoginResponse | null;

      if (!response.ok) {
        setError(data?.message ?? "No se pudo iniciar sesión. Revisa tus datos.");
        return;
      }

      loginUser(data?.user?.email ?? email.trim(), data?.token);
      router.navigate({ to: "/dashboard" });
    } catch {
      setError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
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
            <h1 className="text-3xl font-bold tracking-tight">Iniciar sesión</h1>
            <p className="mt-2 text-sm text-muted-foreground">Accede a tu panel de Filefox para ver tus archivos y convertir más rápido.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block text-sm font-medium text-foreground">
              Correo electrónico
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="usuario@ejemplo.com"
              />
            </label>

            <label className="block text-sm font-medium text-foreground">
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Ingresa tu contraseña"
              />
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" size="lg" className="w-full rounded-full bg-primary text-white hover:opacity-90" disabled={loading}>
              {loading ? "Entrando..." : "Iniciar sesión"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            &iquest;No tienes cuenta?{" "}
            <a href="/register" className="font-medium text-primary hover:underline">
              Reg&iacute;strate
            </a>
          </p>

        </div>
      </main>

      <Footer />
    </div>
  );
}
