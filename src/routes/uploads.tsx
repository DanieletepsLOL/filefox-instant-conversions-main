import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Folder, FileText, Image, Music, Video, Archive, CheckCircle2, Download, Clock } from "lucide-react";
import { clearStoredUploads, getStoredUploads, removeStoredUpload, StoredUploadedFile } from "@/lib/uploads";

export const Route = createFileRoute("/uploads")({
  head: () => ({
    meta: [
      { title: "Filefox — Files" },
      { name: "description", content: "Revisa tus archivos convertidos en Filefox." },
    ],
  }),
  component: Uploads,
});

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getFileMeta(type: string) {
  const ext = type.toLowerCase();
  const image = ["jpg","jpeg","png","webp","gif","svg","avif","heic","bmp","tiff","ico"];
  const video = ["mp4","mov","webm","mkv","avi","m4v","flv"];
  const audio = ["mp3","wav","flac","aac","ogg","m4a","opus","wma"];
  const document = ["pdf","doc","docx","odt","rtf","txt","html","md"];
  const archive = ["zip","rar","7z","tar","gz","tgz","bz2","xz"];
  if (image.includes(ext)) return { icon: Image, label: "Imagen" };
  if (video.includes(ext)) return { icon: Video, label: "Video" };
  if (audio.includes(ext)) return { icon: Music, label: "Audio" };
  if (document.includes(ext)) return { icon: FileText, label: "Documento" };
  if (archive.includes(ext)) return { icon: Archive, label: "Comprimido" };
  return { icon: Folder, label: "Archivo" };
}

function Uploads() {
  const [uploads, setUploads] = useState<StoredUploadedFile[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // Filtrar archivos expirados y actualizar cada 30s para el contador de tiempo
    const stored = getStoredUploads()
      .filter((file) => {
        if (file.status !== "done") return false;
        if (file.expiresAt && Date.now() > new Date(file.expiresAt).getTime()) return false;
        return true;
      })
      .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
    setUploads(stored);

    const interval = setInterval(() => {
      setNow(Date.now());
      // Limpiar expirados cada 30s
      setUploads((prev) =>
        prev.filter((file) => !file.expiresAt || Date.now() <= new Date(file.expiresAt).getTime())
      );
    }, 30_000);

    return () => clearInterval(interval);
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
                <p className="text-sm text-muted-foreground">Archivos convertidos</p>
                <h1 className="text-3xl font-bold tracking-tight">Files</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tus archivos convertidos aparecen aquí. Descárgalos o elimínalos cuando quieras.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {uploads.length > 0 && (
                  <Button
                    variant="outline"
                    className="rounded-full border-destructive/50 text-destructive hover:bg-destructive/10 px-5 py-2 text-sm"
                    onClick={handleClear}
                  >
                    Vaciar todo
                  </Button>
                )}
                <Link
                  to="/"
                  className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:opacity-90 transition"
                >
                  Nueva conversión
                </Link>
              </div>
            </div>
          </div>

          {uploads.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-foreground">No hay archivos convertidos</p>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Convierte archivos desde el convertidor y aparecerán automáticamente aquí.
              </p>
              <Link
                to="/"
                className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition"
              >
                Ir al convertidor
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {uploads.map((upload) => {
                const ext = upload.name.includes(".") ? upload.name.split(".").pop()?.toLowerCase() || "" : "";
                const { icon: Icon, label } = getFileMeta(ext);
                return (
                  <div
                    key={upload.id}
                    className="rounded-2xl border bg-card p-5 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate max-w-[250px] md:max-w-[400px]">
                            {upload.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                            <span>{label}</span>
                            <span>·</span>
                            <span>{formatBytes(upload.size)}</span>
                            <span>·</span>
                            <span>{new Date(upload.uploadedAt).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}</span>
                          </div>
                        </div>
                      </div>
                                            <div className="flex items-center gap-2">
                        {upload.downloadUrl ? (
                          <>
                            {upload.expiresAt && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {Math.max(0, Math.round((new Date(upload.expiresAt).getTime() - now) / 60000))} min
                              </span>
                            )}
                            <a
                              href={upload.downloadUrl}
                              download
                              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-white hover:opacity-90 transition"
                            >
                              <Download className="h-3.5 w-3.5" /> Descargar
                            </a>
                          </>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full border-border"
                          onClick={() => {
                            const next = uploads.filter((item) => item.id !== upload.id);
                            setUploads(next);
                            removeStoredUpload(upload.id);
                          }}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
