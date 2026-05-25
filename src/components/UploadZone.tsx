import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  Download,
  FileIcon,
  FileText,
  Image,
  Music,
  Search,
  Sparkles,
  Upload,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { addStoredUploads, getStoredUploads, saveUploads, StoredUploadedFile } from "@/lib/uploads";

type FileKind = "image" | "video" | "audio" | "document" | "text" | "archive" | "unknown";

type ConversionGroup = {
  label: string;
  formats: string[];
};

type UploadedFile = StoredUploadedFile & {
  progress: number;
  kind: FileKind;
  sourceFormat: string;
  targetFormat: string;
  sourceFile?: File;
  downloadUrl?: string;
  downloadFilename?: string;
};

const fileKindMeta: Record<FileKind, { label: string; icon: LucideIcon }> = {
  image: { label: "Imagen", icon: Image },
  video: { label: "Video", icon: Video },
  audio: { label: "Audio", icon: Music },
  document: { label: "Documento", icon: FileText },
  text: { label: "Texto", icon: FileText },
  archive: { label: "Comprimido", icon: Archive },
  unknown: { label: "Archivo", icon: FileIcon },
};

const conversionOptions: Record<FileKind, ConversionGroup[]> = {
  image: [
    { label: "Imagen", formats: ["JPG", "PNG", "WEBP", "AVIF", "GIF", "BMP", "TIFF", "HEIC", "ICO"] },
    { label: "RAW", formats: ["DNG", "EXR", "TGA", "PPM"] },
    { label: "Vector", formats: ["SVG", "PDF", "EPS"] },
    { label: "Documento", formats: ["PDF", "DOCX"] },
  ],
  video: [
    { label: "Video", formats: ["MP4", "WEBM", "MOV", "MKV", "AVI", "M4V", "FLV"] },
    { label: "Audio", formats: ["MP3", "WAV", "AAC", "FLAC", "OGG", "M4A"] },
    { label: "Animación", formats: ["GIF", "WEBP"] },
    { label: "Imagen", formats: ["PNG", "JPG"] },
  ],
  audio: [
    { label: "Audio", formats: ["MP3", "WAV", "FLAC", "AAC", "OGG", "M4A", "OPUS"] },
    { label: "Texto", formats: ["TXT", "SRT", "VTT"] },
  ],
  document: [
    { label: "Documento", formats: ["PDF", "DOC", "DOCX", "ODT", "RTF", "TXT", "HTML", "MD"] },
    { label: "Libro electrónico", formats: ["EPUB", "MOBI", "AZW3"] },
    { label: "Imagen", formats: ["PNG", "JPG", "WEBP", "TIFF"] },
    { label: "Datos", formats: ["CSV", "XLSX"] },
  ],
  text: [
    { label: "Texto", formats: ["TXT", "MD", "HTML", "RTF"] },
    { label: "Datos", formats: ["JSON", "XML", "YAML", "CSV"] },
    { label: "Documento", formats: ["PDF", "DOCX"] },
  ],
  archive: [
    { label: "Comprimido", formats: ["ZIP", "7Z", "TAR", "TAR.GZ", "TGZ", "GZ"] },
    { label: "Unix", formats: ["TAR", "GZ", "BZ2", "XZ"] },
  ],
  unknown: [
    { label: "Comunes", formats: ["PDF", "TXT", "ZIP"] },
  ],
};

const imageExtensions = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "svg",
  "avif",
  "heic",
  "heif",
  "bmp",
  "tif",
  "tiff",
  "ico",
  "raw",
  "cr2",
  "cr3",
  "nef",
  "arw",
  "orf",
  "rw2",
  "dng",
  "psd",
  "ai",
  "eps",
  "exr",
  "tga",
];

const videoExtensions = ["mp4", "mov", "webm", "mkv", "avi", "m4v", "flv", "wmv", "mpeg", "mpg", "3gp"];
const audioExtensions = ["mp3", "wav", "flac", "aac", "ogg", "oga", "m4a", "opus", "wma", "aiff", "mid", "midi"];
const documentExtensions = ["pdf", "doc", "docx", "odt", "rtf", "xls", "xlsx", "ods", "ppt", "pptx", "odp", "pages", "key"];
const textExtensions = ["txt", "md", "markdown", "csv", "json", "xml", "yaml", "yml", "html", "htm", "css", "js", "ts", "tsx", "jsx", "log"];
const archiveExtensions = ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "zst", "cab", "iso"];

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function extensionOf(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith(".tar.gz")) return "tar.gz";
  return lowerName.includes(".") ? lowerName.split(".").pop() ?? "" : "";
}

function labelSourceFormat(file: File | StoredUploadedFile) {
  const extension = extensionOf(file.name);
  if (extension) return extension.toUpperCase();
  return file.type || "Archivo";
}

function detectFileKind(file: File | StoredUploadedFile): FileKind {
  const mime = file.type.toLowerCase();
  const extension = extensionOf(file.name);

  if (mime.startsWith("image/") || imageExtensions.includes(extension)) return "image";
  if (mime.startsWith("video/") || videoExtensions.includes(extension)) return "video";
  if (mime.startsWith("audio/") || audioExtensions.includes(extension)) return "audio";
  if (archiveExtensions.includes(extension)) return "archive";
  if (mime.startsWith("text/") || textExtensions.includes(extension)) return "text";
  if (documentExtensions.includes(extension)) return "document";

  return "unknown";
}

function defaultTarget(kind: FileKind) {
  return conversionOptions[kind][0].formats[0];
}

function FormatPicker({
  disabled,
  file,
  onChange,
}: {
  disabled: boolean;
  file: UploadedFile;
  onChange: (format: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const groups = conversionOptions[file.kind];
  const [activeGroup, setActiveGroup] = useState(groups[0].label);

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      formats: group.formats.filter((format) => format.toLowerCase().includes(search.trim().toLowerCase())),
    }))
    .filter((group) => group.formats.length > 0);

  const selectedGroup = visibleGroups.find((group) => group.label === activeGroup) ?? visibleGroups[0];

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 text-left text-sm outline-none transition hover:border-primary disabled:pointer-events-none disabled:opacity-60"
      >
        <span className="text-xs text-muted-foreground">Convertir a</span>
        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
          {file.targetFormat}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-30 w-[min(420px,calc(100vw-2rem))] rounded-sm border border-white/10 bg-[#1d1d1d] p-5 text-white shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-sm text-white/45">
            <Search className="h-4 w-4" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Búsqueda"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>

          <div className="mt-4 grid grid-cols-[125px_1fr] gap-4">
            <div className="space-y-1 text-sm">
              {visibleGroups.map((group) => (
                <button
                  type="button"
                  key={group.label}
                  onClick={() => setActiveGroup(group.label)}
                  className={`flex w-full items-center justify-between border-b border-white/10 py-2 text-left transition ${
                    selectedGroup?.label === group.label ? "text-white" : "text-white/55 hover:text-white"
                  }`}
                >
                  <span>{group.label}</span>
                  {selectedGroup?.label === group.label ? <span>›</span> : null}
                </button>
              ))}
            </div>

            <div className="max-h-52 overflow-y-auto pr-1">
              {selectedGroup ? (
                <div className="grid grid-cols-3 gap-3">
                  {selectedGroup.formats.map((format) => (
                    <button
                      type="button"
                      key={format}
                      onClick={() => {
                        onChange(format);
                        setOpen(false);
                      }}
                      className={`h-10 rounded px-3 text-sm font-semibold transition ${
                        file.targetFormat === format ? "bg-black/35 text-white" : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/45">No hay formatos para esa búsqueda.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function UploadZone() {
  const [files, setFiles] = useState<UploadedFile[]>(() => {
    const stored = getStoredUploads();
    // Descartar archivos "converting" al recargar (perdieron el sourceFile y se quedarían colgados)
    const valid = stored.filter((file) => file.status !== "converting");
    saveUploads(valid);
    return valid.map((file) => {
      const kind = detectFileKind(file);
      return {
        ...file,
        kind,
        sourceFormat: labelSourceFormat(file),
        targetFormat: defaultTarget(kind),
        progress: 100,
      };
    });
  });
  const [dragging, setDragging] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const readyFiles = useMemo(() => files.filter((file) => file.status !== "done"), [files]);

  // ✅ Eliminamos el useEffect que sincronizaba localStorage (causaba pérdida de downloadUrl)
  // Ahora guardamos en localStorage de forma síncrona dentro del callback de setFiles en convert()

  const addFiles = useCallback((list: FileList | null) => {
    if (!list) return;

    const next = Array.from(list).map((file) => {
      const kind = detectFileKind(file);

      return {
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        size: file.size,
        type: file.type || extensionOf(file.name) || "file",
        progress: 100,
        status: "ready" as const,
        uploadedAt: new Date().toISOString(),
        kind,
        sourceFormat: labelSourceFormat(file),
        targetFormat: defaultTarget(kind),
        sourceFile: file,
      };
    });

    setError("");
    setFiles((prev) => {
      const merged = [...prev, ...next];
      addStoredUploads(next);
      return merged;
    });
  }, []);

  const remove = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const updateTarget = (id: string, targetFormat: string) => {
    setFiles((prev) => prev.map((file) => (file.id === id ? { ...file, targetFormat } : file)));
  };

  const convert = async () => {
    if (!readyFiles.length) return;

    const filesWithoutSource = readyFiles.filter((file) => !file.sourceFile);
    if (filesWithoutSource.length > 0) {
      setError("Algunos archivos vienen de una sesión anterior. Vuelve a subirlos para convertirlos.");
      return;
    }

    setError("");
    setConverting(true);

    // 1. Pasamos todos los archivos pendientes a estado de conversión
    setFiles((prev) =>
      prev.map((file) => (file.status === "done" ? file : { ...file, status: "converting", progress: 20 }))
    );

    try {
      for (const file of readyFiles) {
        const body = new FormData();
        body.append("file", file.sourceFile as File);
        body.append("sourceKind", file.kind);
        body.append("sourceFormat", file.sourceFormat);
        body.append("targetFormat", file.targetFormat);

        const timeoutMs = file.size < 1_000_000 ? 15_000 : 120_000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        let response;
        try {
          response = await fetch("/api/conversions", {
            method: "POST",
            body,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.message ?? "No se pudo convertir el archivo.");
        }

        const blob = await response.blob();

        const disposition = response.headers.get("Content-Disposition");
        let downloadFilename = file.name.replace(/\.[^.]+$/, "") + "." + file.targetFormat.toLowerCase();
        if (disposition) {
          const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (match?.[1]) {
            downloadFilename = match[1].replace(/['"]/g, "").trim();
          }
        }

        const downloadUrl = URL.createObjectURL(blob);

        // 2. Usamos el callback funcional de React para asegurar la mutación atómica en memoria
        setFiles((prev) => {
          const updated = prev.map((item) =>
            item.id === file.id
              ? { ...item, status: "done" as const, progress: 100, downloadUrl, downloadFilename }
              : item
        );
          // 3. Forzamos de forma segura el guardado de los metadatos en localStorage sin corromper el estado de la RAM
          saveUploads(
            updated.map((u) => ({
              id: u.id,
              name: u.name,
              size: u.size,
              type: u.type,
              status: u.status,
              uploadedAt: u.uploadedAt,
            }))
          );
          return updated;
        });
      }
    } catch (conversionError) {
      setFiles((prev) =>
        prev.map((file) => (file.status === "converting" ? { ...file, status: "ready", progress: 100 } : file))
      );
      let msg = conversionError instanceof Error ? conversionError.message : "No se pudo completar la conversión.";
      if (conversionError instanceof Error && conversionError.name === "AbortError") {
        msg = "La conversión tardó demasiado. Inténtalo de nuevo.";
      }
      setError(msg);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className={`relative rounded-3xl border border-dashed p-8 md:p-12 text-center transition-all bg-card ${
          dragging
            ? "border-primary bg-accent/40 scale-[1.01] shadow-[var(--shadow-glow)]"
            : "border-border hover:border-primary/60"
        }`}
      >
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(event) => addFiles(event.target.files)} />
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-foreground">
          <Upload className="h-6 w-6" />
        </div>
        <h3 className="text-xl md:text-2xl font-semibold tracking-tight">Sube tus archivos</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Detectamos automáticamente imágenes, videos, audio, documentos, texto y archivos comprimidos.
        </p>
        <Button
          size="lg"
          className="mt-6 rounded-full px-7 bg-gradient-to-r from-primary to-[var(--primary-glow)] hover:opacity-90 shadow-[var(--shadow-glow)]"
          onClick={() => inputRef.current?.click()}
        >
          Seleccionar archivos
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">Tamaño máximo recomendado: 100MB por archivo</p>
      </div>

      {files.length > 0 && (
        <div className="mt-6 rounded-2xl border bg-card shadow-[var(--shadow-card)] p-4 md:p-5 animate-[fade-up_0.4s_ease-out]">
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold tracking-tight">Panel de conversión</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              El sistema detecta el tipo de archivo y muestra formatos compatibles para convertir.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {files.map((file) => {
              const meta = fileKindMeta[file.kind];
              const Icon = meta.icon;

              return (
                <div key={file.id} className="grid gap-3 rounded-xl bg-muted/50 p-3 md:grid-cols-[1fr_220px_auto] md:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{file.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {meta.label} · {file.sourceFormat} · {formatBytes(file.size)}
                      </p>
                      {file.status === "converting" && <Progress value={file.progress} className="mt-2 h-1.5" />}
                    </div>
                  </div>

                  <FormatPicker disabled={file.status === "done" || converting} file={file} onChange={(format) => updateTarget(file.id, format)} />

                  <div className="flex justify-end gap-2">
                    {file.status === "done" && file.downloadUrl ? (
                      <Button asChild size="sm" variant="outline" className="rounded-full">

                        <a href={file.downloadUrl} download={file.downloadFilename}>
                          <Download className="h-4 w-4" /> Descargar
                        </a>
                      </Button>
                    ) : file.status === "done" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border px-3 py-2 text-xs text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Convertido
                      </span>
                    ) : file.status === "converting" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border px-3 py-2 text-xs text-muted-foreground">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Convirtiendo
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => remove(file.id)}
                        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Quitar archivo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {error && <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {readyFiles.length} archivo{readyFiles.length === 1 ? "" : "s"} listo{readyFiles.length === 1 ? "" : "s"} para convertir.
            </p>
            <Button
              onClick={convert}
              disabled={converting || readyFiles.length === 0}
              className="rounded-full bg-gradient-to-r from-primary to-[var(--primary-glow)] hover:opacity-90 shadow-[var(--shadow-glow)]"
            >
              <Sparkles className="h-4 w-4" />
              {converting ? "Convirtiendo..." : "Convertir ahora"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

