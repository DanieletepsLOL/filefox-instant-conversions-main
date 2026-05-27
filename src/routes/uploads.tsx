import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Folder, FileText, Image, Music, Video, Archive, CheckCircle2, Download, Clock, Trash2, AlertCircle } from "lucide-react";
import { getAccessToken, isAuthenticated } from "@/lib/auth";

export const Route = createFileRoute("/uploads")({
  head: () => ({
    meta: [
      { title: "Filefox — Files" },
      { name: "description", content: "Revisa tus archivos convertidos en Filefox." },
    ],
  }),
  component: Uploads,
});

interface ServerFile {
  id: string;
  name: string;
  originalName: string;
  size: number;
  sourceFormat: string;
  targetFormat: string;
  downloadUrl: string;
  expiresAt: string;
  uploadedAt: string;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getFileMeta(ext: string) {
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
  const [serverFiles, setServerFiles] = useState<ServerFile[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const authenticated = isAuthenticated();

  // Cargar archivos del servidor si el usuario está autenticado
  useEffect(() => {
    if (!authenticated) return;

    setLoading(true);
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    fetch("/api/files", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Error al obtener archivos");
        return res.json();
      })
      .then((data) => {
        setServerFiles(data.files || []);
        setError("");
      })
      .catch((err) => {
        console.error("Error fetching server files:", err);
        setError("No se pudieron cargar los archivos del servidor.");
      })
      .finally(() => setLoading(false));
  }, [authenticated]);

  // Refrescar cada 30 segundos para actualizar el contador de tiempo
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());

      if (authenticated) {
        const token = getAccessToken();
        if (token) {
          fetch("/api/files", {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
              if (data) setServerFiles(data.files || []);
            })
            .catch(() => {});
        }
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [authenticated]);

  const handleDeleteServerFile = async (fileId: string) => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al eliminar");
      setServerFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      console.error("Error deleting server file:", err);
    }
  };

  const hasFiles = serverFiles.length > 0;

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
                  {authenticated
                    ? "Tus archivos se guardan en el servidor por 1 hora. Se eliminan automáticamente tras ese tiempo."
                    : "Inicia sesión para guardar tus archivos en el servidor y verlos aquí."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/"
                  className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:opacity-90 transition"
                >
                  Nueva conversión
                </Link>
              </div>
            </div>
          </div>

          {loading && (
            <div className="rounded-3xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Cargando archivos...</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              {error}
            </div>
          )}

          {!authenticated ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-foreground">Inicia sesión para guardar tus archivos</p>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Los archivos convertidos solo se guardan en el servidor si has iniciado sesión.
                Si no, al recargar la página desaparecen.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition"
                >
                  Iniciar sesión
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition"
                >
                  Registrarse
                </Link>
              </div>
            </div>
          ) : !hasFiles && !loading ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-foreground">No hay archivos convertidos</p>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Convierte archivos desde el convertidor y aparecerán aquí por 1 hora.
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
              {/* Archivos del servidor (solo usuarios registrados) */}
              {serverFiles.map((file) => {
                const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() || "" : "";
                const { icon: Icon, label } = getFileMeta(ext);
                const minutesLeft = Math.max(0, Math.round((new Date(file.expiresAt).getTime() - now) / 60000));

                return (
                  <div
                    key={`server-${file.id}`}
                    className="rounded-2xl border bg-card p-5 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate max-w-[250px] md:max-w-[400px]">
                            {file.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                            <span>{label}</span>
                            <span>·</span>
                            <span>{file.sourceFormat} &rarr; {file.targetFormat}</span>
                            <span>·</span>
                            <span>{formatBytes(file.size)}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {minutesLeft} min restantes
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={file.downloadUrl}
                          download
                          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-white hover:opacity-90 transition"
                        >
                          <Download className="h-3.5 w-3.5" /> Descargar
                        </a>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full border-border"
                          onClick={() => handleDeleteServerFile(file.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
