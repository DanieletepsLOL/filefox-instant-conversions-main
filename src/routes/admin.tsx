import { useState, useEffect } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import "./admin.css";

// ============================================================
// Panel de Administración - Filefox
// Diseño vertical, clásico, con pestañas laterales
// ============================================================

type TabId = "dashboard" | "users" | "activity" | "uploads" | "conversions" | "errors";

interface User {
  id: number;
  name: string;
  email: string;
  email_verified: number;
  auth_provider: string;
  locale: string | null;
  total_conversions: number;
  conversions_today: number;
  last_conversion_date: string | null;
  login_count: number;
  last_login_ip: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string | null;
  is_deleted: number;
}

interface Conversion {
  id: number;
  original_name: string;
  original_size: number;
  source_format: string;
  target_format: string;
  status: string;
  download_count: number;
  ip: string | null;
  created_at: string;
  user_email?: string;
  user_id?: number;
}

interface ActivityLog {
  id: number;
  user_id: number | null;
  user_email: string | null;
  action: string;
  details: string;
  ip: string | null;
  created_at: string;
}

interface Stats {
  total_users: number;
  total_conversions: number;
  conversions_today: number;
  total_files: number;
}

function AdminPage() {
  const router = useRouter();
  const [token, setToken] = useState<string>("");
  const [email, setEmail] = useState("");
  const [adminTokenInput, setAdminTokenInput] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [conversions, setConversions] = useState<Conversion[]>([]);
    const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [uploads, setUploads] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userConversions, setUserConversions] = useState<Conversion[]>([]);
  const [userActivity, setUserActivity] = useState<ActivityLog[]>([]);
  const [resetPassEmail, setResetPassEmail] = useState("");
  const [resetPassMsg, setResetPassMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [checkingToken, setCheckingToken] = useState(false);

  // Cargar token desde localStorage solo en cliente
  useEffect(() => {
    const saved = localStorage.getItem('filefox:admin-token') || ''
    if (saved) {
      setToken(saved);
    }
  }, []);

  // Verificar si ya hay token al cargar
  useEffect(() => {
        if (token) {
      fetchStats();
      fetchConversions();
      fetchActivity();
      fetchUploads();
      fetchUsers();
      fetchErrors();
    }
  }, [token]);

  // Login de admin
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), admin_token: adminTokenInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al autenticar");
      localStorage.setItem("filefox:admin-token", data.admin_token);
      setToken(data.admin_token);
      fetchStats();
      fetchConversions();
      fetchActivity();
      fetchUploads();
      fetchUsers();
      fetchErrors();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

      const handleLogout = () => {
    localStorage.removeItem("filefox:admin-token");
    setToken("");
    setStats(null);
    setUsers([]);
    setConversions([]);
    setActivity([]);
    setUploads([]);
    router.navigate({ to: '/login' });
  };

  // Fetch helpers
  const apiGet = async (url: string) => {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      handleLogout();
      throw new Error("Sesión expirada");
    }
    return res.json();
  };

  const apiPost = async (url: string, body?: any) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      handleLogout();
      throw new Error("Sesión expirada");
    }
    return res.json();
  };

  const fetchStats = async () => {
    try {
      const data = await apiGet("/api/admin/stats");
      setStats(data);
    } catch {}
  };

  const fetchUsers = async (search?: string) => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams();
      if (search?.trim()) params.set("search", search.trim());
      const data = await apiGet(`/api/admin/users?${params}`);
      setUsers(data.users || []);
      setUsersTotal(data.total || 0);
    } catch {} finally {
      setUsersLoading(false);
    }
  };

  const fetchConversions = async () => {
    try {
      const data = await apiGet("/api/admin/conversions");
      setConversions(data.conversions || []);
    } catch {}
  };

  const fetchActivity = async () => {
    try {
      const data = await apiGet("/api/admin/activity");
      setActivity(data.logs || []);
    } catch {}
  };

    const fetchUploads = async () => {
    try {
      const data = await apiGet("/api/admin/uploads");
      setUploads(data.files || []);
    } catch {}
  };

  const fetchErrors = async () => {
    try {
      const data = await apiGet("/api/admin/errors");
      setErrors(data.errors || []);
    } catch {}
  };

    const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(searchQuery);
  };

  const fetchDeletedUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await apiGet("/api/admin/users?search=&show_deleted=1");
      setUsers(data.users || []);
      setUsersTotal(data.total || 0);
    } catch {} finally {
      setUsersLoading(false);
    }
  };

  const viewUser = async (user: User) => {
    setSelectedUser(user);
    try {
      const data = await apiGet(`/api/admin/users/${user.id}`);
      setUserConversions(data.conversions || []);
      setUserActivity(data.activity || []);
    } catch {}
  };

  const resetPassword = async (userId: number) => {
    if (!resetPassEmail || resetPassEmail.length < 8) {
      setResetPassMsg("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    try {
      setResetPassMsg("");
      const data = await apiPost(`/api/admin/users/${userId}/reset-password`, { new_password: resetPassEmail });
      setResetPassMsg(data.message || "Contraseña restablecida");
      setResetPassEmail("");
    } catch (err: any) {
      setResetPassMsg(err.message);
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm("¿Estás seguro de eliminar este usuario?")) return;
    try {
      await apiPost(`/api/admin/users/${userId}/delete`);
      fetchUsers(searchQuery);
      setSelectedUser(null);
    } catch {}
  };

  const restoreUser = async (userId: number) => {
    try {
      await apiPost(`/api/admin/users/${userId}/restore`);
      fetchUsers(searchQuery);
    } catch {}
  };

  // Formatear fecha
  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    const date = new Date(d);
    return date.toLocaleDateString("es-ES", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

    // Si no hay token en localStorage, redirigir a /login
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('filefox:admin-token')) {
      router.navigate({ to: '/login' });
    }
  }, []);

// Panel principal con sidebar vertical
    const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "dashboard", label: "Panel", icon: "📊" },
    { id: "users", label: "Usuarios", icon: "👥" },
    { id: "activity", label: "Actividad", icon: "📋" },
    { id: "conversions", label: "Conversiones", icon: "🔄" },
    { id: "errors", label: "Errores", icon: "🐞" },
    { id: "uploads", label: "Archivos", icon: "📁" },
  ];

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2>Filefox Admin</h2>
          <p className="admin-sidebar-sub">Panel de control</p>
        </div>
        <nav className="admin-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`admin-nav-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="admin-nav-icon">{tab.icon}</span>
              <span className="admin-nav-label">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <button onClick={handleLogout} className="admin-btn admin-btn-logout">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="admin-content">
        {/* ===== DASHBOARD ===== */}
        {activeTab === "dashboard" && (
          <div className="admin-section">
            <h2 className="admin-section-title">Resumen del sistema</h2>
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <div className="admin-stat-number">{stats?.total_users ?? "—"}</div>
                <div className="admin-stat-label">Usuarios registrados</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-number">{stats?.total_conversions ?? "—"}</div>
                <div className="admin-stat-label">Conversiones totales</div>
              </div>
              <div className="admin-stat-card accent">
                <div className="admin-stat-number">{stats?.conversions_today ?? "—"}</div>
                <div className="admin-stat-label">Conversiones hoy</div>
              </div>
                            <div className="admin-stat-card">
                <div className="admin-stat-number">{stats?.total_files ?? "—"}</div>
                <div className="admin-stat-label">Archivos en servidor</div>
              </div>
              <div className="admin-stat-card" style={{ borderColor: (stats?.error_reports ?? 0) > 0 ? "#ef4444" : undefined }}>
                <div className="admin-stat-number" style={{ color: (stats?.error_reports ?? 0) > 0 ? "#ef4444" : undefined }}>
                  {stats?.error_reports ?? "—"}
                </div>
                <div className="admin-stat-label">Reportes de error</div>
              </div>
            </div>

            {/* Actividad reciente en dashboard */}
            <h3 className="admin-subsection-title">Actividad reciente</h3>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Acción</th>
                    <th>Detalle</th>
                    <th>IP</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.slice(0, 10).map((log) => (
                    <tr key={log.id}>
                      <td>{log.user_email || "—"}</td>
                      <td><span className="admin-badge">{log.action}</span></td>
                      <td className="admin-cell-detail">{log.details}</td>
                      <td className="admin-cell-ip">{log.ip || "—"}</td>
                      <td className="admin-cell-date">{fmtDate(log.created_at)}</td>
                    </tr>
                  ))}
                  {activity.length === 0 && (
                    <tr><td colSpan={5} className="admin-empty">No hay actividad registrada</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== USUARIOS ===== */}
        {activeTab === "users" && (
          <div className="admin-section">
            <h2 className="admin-section-title">Usuarios registrados</h2>

                        {/* Búsqueda */}
            <form onSubmit={handleSearch} className="admin-search-form">
              <input
                type="text"
                className="admin-search-input"
                placeholder="Buscar por email, nombre o IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="admin-btn admin-btn-primary">Buscar</button>
              {searchQuery && (
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => { setSearchQuery(""); fetchUsers(); }}>
                  Limpiar
                </button>
              )}
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => fetchDeletedUsers()}
              >
                Ver eliminados
              </button>
            </form>

            <p className="admin-total-count">{usersTotal} usuario(s) encontrado(s)</p>

            {usersLoading ? (
              <p className="admin-loading">Cargando usuarios...</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Proveedor</th>
                      <th>Idioma</th>
                      <th>Conversiones</th>
                      <th>Inicios sesión</th>
                      <th>Última IP</th>
                      <th>Último login</th>
                      <th>Registro</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="admin-cell-id">{u.id}</td>
                        <td className="admin-cell-name">{u.name}</td>
                        <td className="admin-cell-email">{u.email}</td>
                        <td><span className="admin-badge">{u.auth_provider}</span></td>
                        <td>{u.locale || "—"}</td>
                        <td className="admin-cell-num">{u.total_conversions}</td>
                        <td className="admin-cell-num">{u.login_count}</td>
                        <td className="admin-cell-ip">{u.last_login_ip || "—"}</td>
                        <td className="admin-cell-date">{fmtDate(u.last_login_at)}</td>
                        <td className="admin-cell-date">{fmtDate(u.created_at)}</td>
                        <td className="admin-cell-actions">
                                                    <button className="admin-btn admin-btn-sm" onClick={() => viewUser(u)}>
                            Ver
                          </button>
                          {u.is_deleted ? (
                            <button className="admin-btn admin-btn-sm admin-btn-warning" onClick={() => restoreUser(u.id)}>
                              Restaurar
                            </button>
                          ) : (
                            <button className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => deleteUser(u.id)}>
                              Eliminar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={11} className="admin-empty">No hay usuarios</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Modal de detalle de usuario */}
            {selectedUser && (
              <div className="admin-modal-overlay" onClick={() => setSelectedUser(null)}>
                <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="admin-modal-header">
                    <h3>Usuario: {selectedUser.name}</h3>
                    <button className="admin-modal-close" onClick={() => setSelectedUser(null)}>×</button>
                  </div>
                  <div className="admin-modal-body">
                                        <div className="admin-user-detail-grid">
                      <div><strong>Email:</strong> {selectedUser.email}</div>
                      <div><strong>Proveedor:</strong> {selectedUser.auth_provider}</div>
                      <div><strong>Verificado:</strong> {selectedUser.email_verified ? "Sí" : "No"}</div>
                      <div><strong>Idioma:</strong> {selectedUser.locale || "No detectado"}</div>
                      <div><strong>Conversiones totales:</strong> {selectedUser.total_conversions}</div>
                      <div><strong>Hoy:</strong> {selectedUser.conversions_today}</div>
                      <div><strong>Inicios de sesión:</strong> {selectedUser.login_count}</div>
                      <div><strong>Última IP:</strong> {selectedUser.last_login_ip || "—"}</div>
                      <div><strong>Último login:</strong> {fmtDate(selectedUser.last_login_at)}</div>
                      <div><strong>Registrado:</strong> {fmtDate(selectedUser.created_at)}</div>
                      <div><strong>Estado:</strong> {selectedUser.is_deleted ? <span style={{color:"var(--danger)", fontWeight:600}}>Eliminado</span> : <span style={{color:"green"}}>Activo</span>}</div>
                    </div>
                    {selectedUser.is_deleted ? (
                      <div style={{marginTop:"12px"}}>
                        <button className="admin-btn admin-btn-warning" onClick={() => { restoreUser(selectedUser.id); setSelectedUser(null); }}>
                          Restaurar este usuario
                        </button>
                      </div>
                    ) : null}

                    <h4 className="admin-subsection-title">Restablecer contraseña</h4>
                    <div className="admin-reset-password">
                      <input
                        type="password"
                        placeholder="Nueva contraseña (mín. 8 caracteres)"
                        value={resetPassEmail}
                        onChange={(e) => setResetPassEmail(e.target.value)}
                      />
                      <button className="admin-btn admin-btn-primary" onClick={() => resetPassword(selectedUser.id)}>
                        Restablecer
                      </button>
                      {resetPassMsg && <p className="admin-success-msg">{resetPassMsg}</p>}
                    </div>

                    <h4 className="admin-subsection-title">Conversiones ({userConversions.length})</h4>
                    <div className="admin-table-wrapper">
                      <table className="admin-table admin-table-sm">
                        <thead>
                          <tr>
                            <th>Archivo</th>
                            <th>De → A</th>
                            <th>IP</th>
                            <th>Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userConversions.map((c) => (
                            <tr key={c.id}>
                              <td>{c.original_name}</td>
                              <td>{c.source_format} → {c.target_format}</td>
                              <td className="admin-cell-ip">{c.ip || "—"}</td>
                              <td className="admin-cell-date">{fmtDate(c.created_at)}</td>
                            </tr>
                          ))}
                          {userConversions.length === 0 && (
                            <tr><td colSpan={4} className="admin-empty">Sin conversiones</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <h4 className="admin-subsection-title">Actividad ({userActivity.length})</h4>
                    <div className="admin-table-wrapper">
                      <table className="admin-table admin-table-sm">
                        <thead>
                          <tr>
                            <th>Acción</th>
                            <th>Detalle</th>
                            <th>IP</th>
                            <th>Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userActivity.map((a) => (
                            <tr key={a.id}>
                              <td><span className="admin-badge">{a.action}</span></td>
                              <td>{a.details}</td>
                              <td className="admin-cell-ip">{a.ip || "—"}</td>
                              <td className="admin-cell-date">{fmtDate(a.created_at)}</td>
                            </tr>
                          ))}
                          {userActivity.length === 0 && (
                            <tr><td colSpan={4} className="admin-empty">Sin actividad</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== ACTIVIDAD ===== */}
        {activeTab === "activity" && (
          <div className="admin-section">
            <h2 className="admin-section-title">Registro de actividad</h2>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Usuario</th>
                    <th>Acción</th>
                    <th>Detalle</th>
                    <th>IP</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((log) => (
                    <tr key={log.id}>
                      <td className="admin-cell-id">{log.id}</td>
                      <td>{log.user_email || "—"}</td>
                      <td><span className="admin-badge">{log.action}</span></td>
                      <td className="admin-cell-detail">{log.details}</td>
                      <td className="admin-cell-ip">{log.ip || "—"}</td>
                      <td className="admin-cell-date">{fmtDate(log.created_at)}</td>
                    </tr>
                  ))}
                  {activity.length === 0 && (
                    <tr><td colSpan={6} className="admin-empty">No hay registros</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== CONVERSIONES ===== */}
        {activeTab === "conversions" && (
          <div className="admin-section">
            <h2 className="admin-section-title">Historial de conversiones</h2>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Usuario</th>
                    <th>Archivo original</th>
                    <th>Tamaño</th>
                    <th>De → A</th>
                    <th>Descargas</th>
                    <th>IP</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {conversions.map((c) => (
                    <tr key={c.id}>
                      <td className="admin-cell-id">{c.id}</td>
                      <td>{c.user_email}</td>
                      <td className="admin-cell-name">{c.original_name}</td>
                      <td className="admin-cell-num">{fmtSize(c.original_size)}</td>
                      <td>{c.source_format} → {c.target_format}</td>
                      <td className="admin-cell-num">{c.download_count}</td>
                      <td className="admin-cell-ip">{c.ip || "—"}</td>
                      <td className="admin-cell-date">{fmtDate(c.created_at)}</td>
                    </tr>
                  ))}
                  {conversions.length === 0 && (
                    <tr><td colSpan={8} className="admin-empty">No hay conversiones</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== ERRORES REPORTADOS ===== */}
        {activeTab === "errors" && (
          <div className="admin-section">
            <h2 className="admin-section-title">Reportes de errores 🐞</h2>
            <p className="admin-total-count">{errors.length} reporte(s) de error</p>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>De → A</th>
                    <th>Descripción</th>
                    <th>Email</th>
                    <th>IP</th>
                    <th>Error</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((e: any) => (
                    <tr key={e.id}>
                      <td className="admin-cell-id">{e.id}</td>
                      <td>{e.source_format} → {e.target_formats}</td>
                      <td className="admin-cell-detail" style={{ maxWidth: 250 }}>{e.description}</td>
                      <td>{e.email || "—"}</td>
                      <td className="admin-cell-ip">{e.ip || "—"}</td>
                      <td className="admin-cell-detail" style={{ maxWidth: 200, fontSize: "0.75rem", fontFamily: "monospace" }}>
                        {e.error_message ? e.error_message.slice(0, 80) + (e.error_message.length > 80 ? "..." : "") : "—"}
                      </td>
                      <td className="admin-cell-date">{fmtDate(e.created_at)}</td>
                    </tr>
                  ))}
                  {errors.length === 0 && (
                    <tr><td colSpan={7} className="admin-empty">No hay reportes de errores</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== UPLOADS ===== */}
        {activeTab === "uploads" && (
          <div className="admin-section">
            <h2 className="admin-section-title">Archivos en servidor</h2>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tamaño</th>
                    <th>Subido</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((f, i) => (
                    <tr key={i}>
                      <td className="admin-cell-name">{f.name}</td>
                      <td className="admin-cell-num">{fmtSize(f.size)}</td>
                      <td className="admin-cell-date">{fmtDate(f.created_at)}</td>
                    </tr>
                  ))}
                  {uploads.length === 0 && (
                    <tr><td colSpan={3} className="admin-empty">No hay archivos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});
