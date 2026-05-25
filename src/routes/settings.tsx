import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { getUserEmail, isAuthenticated } from "@/lib/auth";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Filefox — Configuración" },
      { name: "description", content: "Ajusta tus preferencias y configuración de cuenta en Filefox." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const router = useRouter();
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [autoSave, setAutoSave] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.navigate({ to: "/login" });
      return;
    }
    setEmail(getUserEmail());
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 md:px-6 py-16">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <div className="rounded-3xl border bg-card p-8 shadow-[var(--shadow-card)]">
            <div className="mb-6">
              <p className="text-sm text-muted-foreground">Ajustes de cuenta</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">Configuración</h1>
              <p className="mt-2 text-sm text-muted-foreground">Controla tus preferencias, notificaciones y seguridad.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border bg-background p-6">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="mt-2 font-semibold text-foreground">{email ?? "No identificado"}</p>
              </div>
              <div className="rounded-3xl border bg-background p-6">
                <p className="text-sm text-muted-foreground">Cuenta</p>
                <p className="mt-2 text-sm text-foreground">Sesión activa en Filefox</p>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              <div className="rounded-3xl border bg-background p-6">
                <h2 className="text-xl font-semibold text-foreground">Notificaciones</h2>
                <p className="mt-2 text-sm text-muted-foreground">Recibe alertas sobre tus conversiones y actualizaciones del servicio.</p>
                <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-muted p-4">
                  <div>
                    <p className="font-medium text-foreground">Notificaciones por correo</p>
                    <p className="text-sm text-muted-foreground">Emails cuando termine una conversión.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifications((prev) => !prev)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${notifications ? "bg-primary text-white" : "bg-muted text-foreground"}`}
                  >
                    {notifications ? "Activadas" : "Desactivadas"}
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border bg-background p-6">
                <h2 className="text-xl font-semibold text-foreground">Preferencias</h2>
                <p className="mt-2 text-sm text-muted-foreground">Ajusta el aspecto y el comportamiento del panel.</p>
                <div className="mt-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => setDarkMode((prev) => !prev)}
                    className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition ${darkMode ? "bg-primary text-white" : "bg-muted text-foreground"}`}
                  >
                    Tema oscuro: {darkMode ? "Activado" : "Desactivado"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoSave((prev) => !prev)}
                    className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition ${autoSave ? "bg-primary text-white" : "bg-muted text-foreground"}`}
                  >
                    Guardado automático: {autoSave ? "Activado" : "Desactivado"}
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border bg-background p-6">
                <h2 className="text-xl font-semibold text-foreground">Seguridad</h2>
                <p className="mt-2 text-sm text-muted-foreground">Actualiza tu acceso y revisa tus sesiones activas.</p>
                <div className="mt-4 space-y-3">
                  <button type="button" className="w-full rounded-2xl bg-muted px-4 py-3 text-left text-sm text-foreground transition hover:bg-muted/80">
                    Cambiar contraseña
                  </button>
                  <button type="button" className="w-full rounded-2xl bg-muted px-4 py-3 text-left text-sm text-foreground transition hover:bg-muted/80">
                    Revisar sesiones
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <Button type="button" className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-white hover:opacity-90">
                Guardar cambios
              </Button>
              <Button type="button" variant="outline" className="rounded-full border-border bg-background px-6 py-3 text-sm font-medium text-foreground">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
