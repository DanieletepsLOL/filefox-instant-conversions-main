import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Sparkles, Upload, Folder, Clock3 } from "lucide-react";
import { getUserEmail, isAuthenticated, logoutUser } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Filefox — Panel" },
      { name: "description", content: "Panel de usuario de Filefox con resumen de actividad y accesos rápidos." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("Usuario");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.navigate({ to: "/login" });
      return;
    }

    setUserEmail(getUserEmail() ?? "Usuario");
  }, []);

  const handleLogout = () => {
    logoutUser();
    router.navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 md:px-6 py-16">
        <div className="space-y-6">
          <div className="rounded-3xl border bg-card p-8 shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bienvenido</p>
                <h1 className="text-3xl font-bold tracking-tight">Hola, {userEmail}</h1>
                <p className="mt-2 text-sm text-muted-foreground">Este es tu panel de control de Filefox.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button className="rounded-full bg-primary text-white hover:opacity-90" onClick={handleLogout}>
                  Cerrar sesión
                </Button>
                <Button className="rounded-full border border-border bg-background text-foreground hover:bg-accent/80" onClick={() => router.navigate({ to: "/" })}>
                  Ir al convertidor
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="mt-5 text-sm text-muted-foreground">Conversiones hoy</p>
              <p className="mt-2 text-3xl font-semibold">4</p>
            </div>

            <div className="rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Upload className="h-5 w-5" />
              </div>
              <p className="mt-5 text-sm text-muted-foreground">Archivos listos</p>
              <p className="mt-2 text-3xl font-semibold">2</p>
            </div>

            <div className="rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Folder className="h-5 w-5" />
              </div>
              <p className="mt-5 text-sm text-muted-foreground">Espacio usado</p>
              <p className="mt-2 text-3xl font-semibold">1.4 GB</p>
            </div>
          </div>

          <section className="rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Actividad reciente</p>
                <h2 className="mt-2 text-xl font-semibold">Tus últimas conversiones</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                <Clock3 className="h-4 w-4" /> Actualizado hace un momento
              </span>
            </div>

            <div className="mt-6 space-y-3">
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-sm font-medium">Documento PDF → Word</p>
                <p className="mt-1 text-xs text-muted-foreground">Finalizado</p>
              </div>
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-sm font-medium">Imagen JPG → PNG</p>
                <p className="mt-1 text-xs text-muted-foreground">Finalizado</p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
