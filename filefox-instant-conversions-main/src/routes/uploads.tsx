import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Folder, Clock3 } from "lucide-react";
import { clearStoredUploads, getStoredUploads, removeStoredUpload, StoredUploadedFile } from "@/lib/uploads";

export const Route = createFileRoute("/uploads")({
  head: () => ({
    meta: [
      { title: "Filefox — Últimas subidas" },
      { name: "description", content: "Revisa tus últimas subidas de archivos en Filefox." },
    ],
  }),
  component: Uploads,
});

function Uploads() {
  const [uploads, setUploads] = useState<StoredUploadedFile[]>([]);

  useEffect(() => {
    setUploads(getStoredUploads().sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1)));
  }, []);

  const handleClear = () => {
    clearStoredUploads();
    setUploads([]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 md:px-6 py-16">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="rounded-3xl border bg-card p-8 shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Archivo cargado</p>
                <h1 className="text-3xl font-bold tracking-tight">Últimas subidas</h1>
                <p className="mt-2 text-sm text-muted-foreground">Aquí aparecen las subidas reales que hiciste desde el convertidor.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  className="rounded-full border-border bg-background px-5 py-2 text-sm"
                  onClick={handleClear}
                >
                  Borrar historial
                </Button>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Volver al convertidor
                </Link>
              </div>
            </div>
          </div>

          {uploads.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
              <p className="text-lg font-medium text-foreground">Aún no hay subidas</p>
              <p className="mt-2 text-sm">Sube archivos desde el convertidor para verlos en esta página.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {uploads.map((upload) => (
                <div key={upload.id} className="rounded-3xl border bg-muted/60 p-5 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Folder className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{upload.name}</p>
                        <p className="text-xs text-muted-foreground">{upload.type || "Archivo"}</p>
                      </div>
                    </div>
                    <div className="grid gap-2 text-right text-sm text-muted-foreground">
                      <span>{new Date(upload.uploadedAt).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}</span>
                      <span>{(upload.size / 1024).toFixed(1)} KB</span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                        <Clock3 className="h-3.5 w-3.5" /> {upload.status === "done" ? "Subido" : upload.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const next = uploads.filter((item) => item.id !== upload.id);
                        setUploads(next);
                        removeStoredUpload(upload.id);
                      }}
                      className="rounded-full border border-destructive px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
