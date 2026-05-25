import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Users,
  Upload,
  Activity,
  RefreshCw,
  LogOut,
  Download,
  Trash2,
  FileText,
  MousePointerClick,
  Globe,
  Clock,
  HardDrive,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Filefox Admin Panel" },
      { name: "description", content: "Panel de administración de Filefox." },
    ],
  }),
  component: AdminDashboard,
});

// ============================================================
// Tipos
// ============================================================
type AdminStats = {
  total_users: number;
  total_conversions: number;
  conversions_today: number;
  total_files: number;
};

type Conversion = {
  id: number;
  user_id: number | null;
  user_email: string;
  original_name: string;
  original_size: number;
  source_format: string;
  target_format: string;
  status: string;
  created_at: string;
};

type UploadFile = {
  name: string;
  size: number;
  created_at: string;
};

type ActivityLog = {
  id: number;
  user_id: number | null;
  user_email: string;
  action: string;
  details: string;
  ip: string;
  created_at: string;
};

// ============================================================
// Helpers
// ============================================================
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return dateStr;
  }
}

function getActionIcon(action: string) {
  switch (action) {
    case "LOGIN":
    case "ADMIN_LOGIN":
      return <LogOut className="h-4 w-4 text-green-500" />;
    case "REGISTER":
      return <Users className="h-4 w-4 text-blue-500" />;
    case "CONVERSION":
      return <FileText className="h-4 w-4 text-purple-500" />;
    case "LOGOUT":
      return <LogOut className="h-4 w-4 text-orange-500" />;
    default:
      return <MousePointerClick className="h-4 w-4 text-gray-500" />;
  }
}

// ============================================================
// Componente principal
// ============================================================
function AdminDashboard() {
  const router = useRouter();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Verificar autenticación de admin
  useEffect(() => {
    const adminToken = localStorage.getItem("filefox:admin-token");
    if (!adminToken) {
      router.navigate({ to: "/admin/login" });
      return;
    }
    fetchAllData();
  }, []);

  async function fetchWithAdminToken(url: string): Promise<Response> {
    const adminToken = localStorage.getItem("filefox:admin-token");
    if (!adminToken) throw new Error("No admin token");

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (response.status === 401) {
      const data = await response.json().catch(() => ({}));
      if (data.code === "ADMIN_TOKEN_EXPIRED") {
        localStorage.removeItem("filefox:admin-token");
        router.navigate({ to: "/admin/login" });
        throw new Error("Sesión expirada");
      }
    }

    return response;
  }

  async function fetchAllData() {
    setLoading(true);
    setError("");
    try {
      const [statsRes, conversionsRes, uploadsRes, activityRes] = await Promise.all([
        fetchWithAdminToken("/api/admin/stats"),
        fetchWithAdminToken("/api/admin/conversions"),
        fetchWithAdminToken("/api/admin/uploads"),
        fetchWithAdminToken("/api/admin/activity"),
      ]);

      if (!statsRes.ok || !conversionsRes.ok || !uploadsRes.ok || !activityRes.ok) {
        throw new Error("Error al cargar datos");
      }

      const statsData = await statsRes.json();
      const conversionsData = await conversionsRes.json();
      const uploadsData = await uploadsRes.json();
      const activityData = await activityRes.json();

      setStats(statsData);
      setConversions(conversionsData.conversions || []);
      setUploads(uploadsData.files || []);
      setActivity(activityData.logs || []);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Sesión expirada") return;
      setError("Error al cargar los datos del panel.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("filefox:admin-token");
    router.navigate({ to: "/admin/login" });
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 md:px-6 py-16">
        <div className="space-y-6">
          {/* Header */}
          <div className="rounded-3xl border bg-card p-8 shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-primary" />
                  <p className="text-sm text-muted-foreground">Admin Panel</p>
                </div>
                <h1 className="text-3xl font-bold tracking-tight mt-1">
                  Filefox Dashboard
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Panel de administración y monitoreo del sistema.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  className="rounded-full border-border"
                  onClick={fetchAllData}
                  disabled={loading}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Actualizar
                </Button>
                <Button
                  className="rounded-full bg-destructive text-white hover:bg-destructive/90"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </Button>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center">
              <p className="text-destructive">{error}</p>
              <Button
                variant="outline"
                className="mt-3 rounded-full"
                onClick={fetchAllData}
              >
                Reintentar
              </Button>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500">
                <Users className="h-5 w-5" />
              </div>
              <p className="mt-5 text-sm text-muted-foreground">Usuarios totales</p>
              <p className="mt-2 text-3xl font-semibold">
                {stats ? stats.total_users : "—"}
              </p>
            </div>

            <div className="rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-500">
                <FileText className="h-5 w-5" />
              </div>
              <p className="mt-5 text-sm text-muted-foreground">Conversiones totales</p>
              <p className="mt-2 text-3xl font-semibold">
                {stats ? stats.total_conversions : "—"}
              </p>
            </div>

            <div className="rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-green-500/10 text-green-500">
                <Activity className="h-5 w-5" />
              </div>
              <p className="mt-5 text-sm text-muted-foreground">Conversiones hoy</p>
              <p className="mt-2 text-3xl font-semibold">
                {stats ? stats.conversions_today : "—"}
              </p>
            </div>

            <div className="rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
                <HardDrive className="h-5 w-5" />
              </div>
              <p className="mt-5 text-sm text-muted-foreground">Archivos guardados</p>
              <p className="mt-2 text-3xl font-semibold">
                {stats ? stats.total_files : "—"}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="conversions" className="w-full">
            <TabsList className="rounded-2xl bg-muted p-1 w-full max-w-2xl mx-auto grid grid-cols-3">
              <TabsTrigger value="conversions" className="rounded-xl data-[state=active]:bg-background">
                <FileText className="mr-2 h-4 w-4" />
                Conversiones
              </TabsTrigger>
              <TabsTrigger value="uploads" className="rounded-xl data-[state=active]:bg-background">
                <Upload className="mr-2 h-4 w-4" />
                Archivos
              </TabsTrigger>
              <TabsTrigger value="activity" className="rounded-xl data-[state=active]:bg-background">
                <Activity className="mr-2 h-4 w-4" />
                Actividad
              </TabsTrigger>
            </TabsList>

            {/* Pestaña: Conversiones */}
            <TabsContent value="conversions" className="mt-6">
              <div className="rounded-3xl border bg-card shadow-[var(--shadow-card)] overflow-hidden">
                <div className="p-6 border-b border-border">
                  <h2 className="text-xl font-semibold">Historial de Conversiones</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Últimas 100 conversiones realizadas en el sistema.
                  </p>
                </div>
                {loading ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <RefreshCw className="mx-auto h-8 w-8 animate-spin mb-2" />
                    Cargando conversiones...
                  </div>
                ) : conversions.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    No hay conversiones registradas.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left p-4 font-medium">Usuario</th>
                          <th className="text-left p-4 font-medium">Archivo</th>
                          <th className="text-left p-4 font-medium">De</th>
                          <th className="text-left p-4 font-medium">A</th>
                          <th className="text-left p-4 font-medium">Tamaño</th>
                          <th className="text-left p-4 font-medium">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conversions.slice(0, 50).map((conv) => (
                          <tr key={conv.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                            <td className="p-4">{conv.user_email}</td>
                            <td className="p-4 max-w-[200px] truncate" title={conv.original_name}>
                              {conv.original_name}
                            </td>
                            <td className="p-4 uppercase">{conv.source_format}</td>
                            <td className="p-4 uppercase">{conv.target_format}</td>
                            <td className="p-4">{formatBytes(conv.original_size)}</td>
                            <td className="p-4">{formatDate(conv.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Pestaña: Archivos */}
            <TabsContent value="uploads" className="mt-6">
              <div className="rounded-3xl border bg-card shadow-[var(--shadow-card)] overflow-hidden">
                <div className="p-6 border-b border-border">
                  <h2 className="text-xl font-semibold">Archivos Guardados</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Archivos originales subidos al servidor ({uploads.length} archivos).
                  </p>
                </div>
                {loading ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <RefreshCw className="mx-auto h-8 w-8 animate-spin mb-2" />
                    Cargando archivos...
                  </div>
                ) : uploads.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    No hay archivos guardados en el servidor.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left p-4 font-medium">Nombre</th>
                          <th className="text-left p-4 font-medium">Tamaño</th>
                          <th className="text-left p-4 font-medium">Subido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploads.map((file) => (
                          <tr key={file.name} className="border-b border-border hover:bg-muted/30 transition-colors">
                            <td className="p-4 max-w-[300px] truncate" title={file.name}>
                              {file.name}
                            </td>
                            <td className="p-4">{formatBytes(file.size)}</td>
                            <td className="p-4">{formatDate(file.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Pestaña: Actividad */}
            <TabsContent value="activity" className="mt-6">
              <div className="rounded-3xl border bg-card shadow-[var(--shadow-card)] overflow-hidden">
                <div className="p-6 border-b border-border">
                  <h2 className="text-xl font-semibold">Actividad de Usuarios</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Últimas 50 acciones registradas en el sistema.
                  </p>
                </div>
                {loading ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <RefreshCw className="mx-auto h-8 w-8 animate-spin mb-2" />
                    Cargando actividad...
                  </div>
                ) : activity.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    No hay actividad registrada.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left p-4 font-medium">Acción</th>
                          <th className="text-left p-4 font-medium">Usuario</th>
                          <th className="text-left p-4 font-medium">Detalles</th>
                          <th className="text-left p-4 font-medium">IP</th>
                          <th className="text-left p-4 font-medium">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activity.map((log) => (
                          <tr key={log.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                {getActionIcon(log.action)}
                                <span className="font-medium">{log.action}</span>
                              </div>
                            </td>
                            <td className="p-4">{log.user_email}</td>
                            <td className="p-4 max-w-[200px] truncate" title={log.details}>
                              {log.details || "—"}
                            </td>
                            <td className="p-4 font-mono text-xs">{log.ip || "—"}</td>
                            <td className="p-4">{formatDate(log.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
}
