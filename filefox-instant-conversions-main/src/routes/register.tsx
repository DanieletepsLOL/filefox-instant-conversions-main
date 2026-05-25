import { FormEvent, useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { isAuthenticated, loginUser } from "@/lib/auth";

type RegisterResponse = {
  message?: string;
  access_token?: string;
  refresh_token?: string;
  user?: {
    email?: string;
    name?: string;
  };
};

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Filefox - Registro" },
      { name: "description", content: "Crea tu cuenta de Filefox para guardar tus archivos y acceder a tu panel." },
    ],
  }),
  component: Register,
});

function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("Completa todos los campos.");
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = (await response.json().catch(() => null)) as RegisterResponse | null;

      if (!response.ok) {
        setError(data?.message ?? "No se pudo crear la cuenta. Revisa los datos.");
        return;
      }

      loginUser(
        data?.user?.email ?? email.trim(),
        data?.user?.name ?? name.trim(),
        data?.access_token ?? "",
        data?.refresh_token ?? ""
      );
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
            <h1 className="text-3xl font-bold tracking-tight">Crear cuenta</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Regístrate en Filefox para guardar tus archivos y acceder a tu panel.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block text-sm font-medium text-foreground">
              Nombre
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Tu nombre"
                autoComplete="name"
              />
            </label>

            <label className="block text-sm font-medium text-foreground">
              Correo electrónico
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="usuario@ejemplo.com"
                autoComplete="email"
              />
            </label>

            <label className="block text-sm font-medium text-foreground">
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Crea una contraseña"
                autoComplete="new-password"
              />
            </label>

            <label className="block text-sm font-medium text-foreground">
              Repetir contraseña
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Repite tu contraseña"
                autoComplete="new-password"
              />
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" size="lg" className="w-full rounded-full bg-primary text-white hover:opacity-90" disabled={loading}>
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            &iquest;Ya tienes cuenta?{" "}
            <a href="/login" className="font-medium text-primary hover:underline">
              Inicia sesión
            </a>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
