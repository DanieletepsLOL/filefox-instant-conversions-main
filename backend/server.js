import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { runMigrations } from "./migrate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.join(os.tmpdir(), "filefox-tmp");

const upload = multer({
  dest: path.join(workRoot, "uploads"),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const app = express();

// ============================================================
// 1. SEGURIDAD: Helmet + CORS restringido
// ============================================================
app.use(helmet());

// Confiar en el proxy (Vite) para obtener la IP real del cliente
app.set("trust proxy", 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:8080",
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));

// ============================================================
// 2. RATE LIMITING (límite de peticiones)
// ============================================================
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30,             // máximo 30 peticiones por minuto
  message: { message: "Demasiadas peticiones. Intenta de nuevo en un minuto." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,               // máximo 5 intentos de login/register por minuto
  message: { message: "Demasiados intentos. Espera un minuto." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", generalLimiter);

// ============================================================
// 3. CONFIGURACIÓN
// ============================================================
const JWT_SECRET = process.env.JWT_SECRET || "filefox-secret-fijo-para-dev";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "filefox-refresh-" + "filefox-secret-fijo-para-dev";
const DATA_DIR = path.join(os.tmpdir(), "filefox-data");
const dbPath = path.join(DATA_DIR, "filefox.db");

// Carpeta permanente para guardar los archivos originales subidos
const PERMANENT_UPLOADS_DIR = "/var/filefox/uploads";
await fs.mkdir(PERMANENT_UPLOADS_DIR, { recursive: true }).catch((err) => {
  console.error("No se pudo crear /var/filefox/uploads:", err.message);
});

await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// ============================================================
// 4. ESQUEMA DE BASE DE DATOS + MIGRACIONES AUTOMÁTICAS
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email_verified INTEGER DEFAULT 0,
    conversions_today INTEGER DEFAULT 0,
    last_conversion_date TEXT,
    total_conversions INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    last_login_ip TEXT,
    last_login_at TEXT,
    login_count INTEGER DEFAULT 0,
    auth_provider TEXT DEFAULT 'email',
    locale TEXT,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS conversions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_email TEXT DEFAULT 'anónimo',
    original_name TEXT NOT NULL,
    original_size INTEGER NOT NULL,
    source_format TEXT NOT NULL,
    target_format TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    download_count INTEGER DEFAULT 0,
    ip TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_email TEXT,
    action TEXT NOT NULL,
    details TEXT,
    ip TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Ejecutar migraciones automáticas (columnas nuevas en tablas existentes)
console.log("📦 Ejecutando migraciones...");
runMigrations(db);

// ============================================================
// 5. FUNCIONES DE AYUDA
// ============================================================
function logActivity(userId, userEmail, action, details = "", ip = "") {
  try {
    db.prepare(`
      INSERT INTO activity_logs (user_id, user_email, action, details, ip)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, userEmail, action, details, ip);
  } catch (err) {
    console.error("Error logging activity:", err.message);
  }
}

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: "15m" }  // Access token: 15 minutos
  );
}

function generateRefreshToken(userId) {
  const token = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 días

  db.prepare("INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)")
    .run(userId, token, expiresAt);

  return { token, expires_at: expiresAt };
}

function cleanExpiredRefreshTokens() {
  db.prepare("DELETE FROM refresh_tokens WHERE expires_at < datetime('now')").run();
}

// ============================================================
// 6. MIDDLEWARE DE AUTENTICACIÓN
// ============================================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token requerido." });
  }
  try {
    req.user = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expirado.", code: "TOKEN_EXPIRED" });
    }
    return res.status(401).json({ message: "Token inválido." });
  }
}

// ============================================================
// 7. ENDPOINTS DE AUTENTICACIÓN
// ============================================================

// Registro
app.post("/api/auth/register", authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password?.trim())
      return res.status(400).json({ message: "Todos los campos son obligatorios." });
    if (password.length < 8)
      return res.status(400).json({ message: "La contraseña debe tener al menos 8 caracteres." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ message: "Correo electrónico inválido." });
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim().toLowerCase()))
      return res.status(409).json({ message: "Este correo ya está registrado." });

    const hash = await bcrypt.hash(password, 12);
    const acceptLanguage = req.headers["accept-language"] || "";
    const locale = acceptLanguage.split(",")[0]?.split("-")[0] || null;

    const result = db.prepare(`
      INSERT INTO users (name, email, password, locale, last_login_ip)
      VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), email.trim().toLowerCase(), hash, locale, req.ip);

    const userId = result.lastInsertRowid;
    const user = { id: userId, email: email.trim().toLowerCase(), name: name.trim() };

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(userId);

    logActivity(userId, email.trim().toLowerCase(), "REGISTER", "Nuevo registro", req.ip);

    res.status(201).json({
      message: "Cuenta creada. Por favor, verifica tu correo electrónico.",
      access_token: accessToken,
      refresh_token: refreshToken.token,
      expires_in: 900,  // 15 minutos en segundos
      user: { email: email.trim().toLowerCase(), name: name.trim() }
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Error al crear la cuenta." });
  }
});

// Login
app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password?.trim())
      return res.status(400).json({ message: "Correo y contraseña son obligatorios." });

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: "Correo o contraseña incorrectos." });

    // Detectar idioma del navegador desde el header Accept-Language
    const acceptLanguage = req.headers["accept-language"] || "";
    const locale = acceptLanguage.split(",")[0]?.split("-")[0] || null;

    // Actualizar IP, locale, login count y fecha del último login
    db.prepare(`
      UPDATE users SET
        last_login_ip = ?,
        last_login_at = datetime('now'),
        login_count = login_count + 1,
        locale = COALESCE(?, locale),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(req.ip, locale, user.id);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user.id);

    logActivity(user.id, user.email, "LOGIN", "Inicio de sesión", req.ip);

    res.json({
      message: "Inicio de sesión exitoso.",
      access_token: accessToken,
      refresh_token: refreshToken.token,
      expires_in: 900,
      user: { email: user.email, name: user.name }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Error al iniciar sesión." });
  }
});

// Refresh Token (renovar access token sin pedir contraseña otra vez)
app.post("/api/auth/refresh", (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ message: "Refresh token requerido." });
    }

    cleanExpiredRefreshTokens();

    const stored = db.prepare(`
      SELECT rt.*, u.name, u.email FROM refresh_tokens rt
      JOIN users u ON u.id = rt.user_id
      WHERE rt.token = ? AND rt.expires_at > datetime('now')
    `).get(refresh_token);

    if (!stored) {
      return res.status(401).json({ message: "Refresh token inválido o expirado. Inicia sesión de nuevo.", code: "REFRESH_INVALID" });
    }

    // Eliminar el refresh token usado (para que no se pueda reusar)
    db.prepare("DELETE FROM refresh_tokens WHERE id = ?").run(stored.id);

    const user = { id: stored.user_id, email: stored.email, name: stored.name };
    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(stored.user_id);

    logActivity(stored.user_id, stored.email, "REFRESH_TOKEN", "Token renovado", req.ip);

    res.json({
      access_token: accessToken,
      refresh_token: newRefreshToken.token,
      expires_in: 900
    });
  } catch (error) {
    console.error("Refresh error:", error);
    res.status(500).json({ message: "Error al renovar el token." });
  }
});

// Logout (eliminar refresh tokens)
app.post("/api/auth/logout", authMiddleware, (req, res) => {
  try {
    db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(req.user.id);
    logActivity(req.user.id, req.user.email, "LOGOUT", "Cierre de sesión", req.ip);
    res.json({ message: "Sesión cerrada." });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Error al cerrar sesión." });
  }
});

// Obtener perfil del usuario
app.get("/api/auth/me", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT id, name, email, email_verified, total_conversions, created_at FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
  res.json({ user });
});

// ============================================================
// Formatos permitidos
// ============================================================
const allowedFormats = new Set([
  "JPG", "PNG", "WEBP", "AVIF", "GIF", "BMP", "TIFF", "HEIC", "ICO", "SVG", "PDF", "EPS",
  "MP4", "WEBM", "MOV", "MKV", "AVI", "M4V", "FLV",
  "MP3", "WAV", "AAC", "FLAC", "OGG", "M4A", "OPUS",
  "DOC", "DOCX", "ODT", "RTF", "TXT", "HTML", "MD", "EPUB", "CSV", "XLSX", "JSON", "XML", "YAML",
  "ZIP", "7Z", "TAR", "TAR.GZ", "TGZ", "GZ", "BZ2", "XZ",
]);

const imageExts = ["jpg","jpeg","png","webp","avif","gif","bmp","tiff","heic","ico","svg","pdf","eps"];
const videoExts = ["mp4","webm","mov","mkv","avi","m4v","flv"];
const audioExts = ["mp3","wav","aac","flac","ogg","m4a","opus"];
const docExts = ["doc","docx","odt","rtf","txt","html","md","epub","csv","xlsx","json","xml","yaml"];
const archiveExts = ["zip","7z","rar","tar","gz","tgz","bz2","xz"];

function detectSourceKind(filename) {
  const ext = path.extname(filename).toLowerCase().replace(".", "");
  if (imageExts.includes(ext)) return "image";
  if (videoExts.includes(ext)) return "video";
  if (audioExts.includes(ext)) return "audio";
  if (docExts.includes(ext)) return "document";
  if (archiveExts.includes(ext)) return "archive";
  return "other";
}

function normalizeFormat(format) {
  return String(format ?? "").trim().toUpperCase();
}

function outputExtension(format) {
  return format.toLowerCase().replace(".", ".");
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${command} failed with code ${code}: ${stderr}`));
    });
  });
}

function findCommand(cmd) {
  if (process.platform !== "win32" && cmd === "magick") return "convert";
  return cmd;
}

// ============================================================
// Convertidores
// ============================================================
async function convertImage(inputPath, outputPath) {
  await run(findCommand("magick"), [inputPath, outputPath]);
}

async function convertMedia(inputPath, outputPath) {
  await run("ffmpeg", ["-y", "-i", inputPath, outputPath]);
}

async function convertDocument(inputPath, outputDir, targetFormat) {
  await run("libreoffice", ["--headless", "--convert-to", targetFormat.toLowerCase(), "--outdir", outputDir, inputPath]);
  const files = await fs.readdir(outputDir);
  const ext = `.${outputExtension(targetFormat)}`;
  const match = files.find((f) => f.toLowerCase().endsWith(ext));
  if (!match) throw new Error("LibreOffice no generó el archivo esperado.");
  return path.join(outputDir, match);
}

const SEVEN_ZIP = "7z";

async function convertArchive(inputPath, outputPath, outputDir, targetFormat) {
  const extractDir = path.join(outputDir, "extracted");
  await fs.mkdir(extractDir, { recursive: true });
  await run(SEVEN_ZIP, ["x", inputPath, `-o${extractDir}`, "-y"]);

  if (targetFormat === "TAR") {
    await run("tar", ["-cf", outputPath, "-C", extractDir, "."]);
    return;
  }
  if (targetFormat === "TAR.GZ" || targetFormat === "TGZ") {
    await run("tar", ["-czf", outputPath, "-C", extractDir, "."]);
    return;
  }
  if (targetFormat === "GZ" || targetFormat === "BZ2" || targetFormat === "XZ") {
    const flag = targetFormat === "GZ" ? "z" : targetFormat === "BZ2" ? "j" : "J";
    await run("tar", [`-c${flag}f`, outputPath, "-C", extractDir, "."]);
    return;
  }

  // ZIP, 7Z y otros formatos de 7-Zip
  const outDir = path.dirname(outputPath);
  const outName = path.basename(outputPath);
  await run(SEVEN_ZIP, ["a", outName, `${extractDir}${path.sep}.`, `-t${outputExtension(targetFormat)}`], { cwd: outDir });
}

// ============================================================
// Endpoint principal de conversión
// ============================================================
app.post("/api/conversions", upload.single("file"), async (req, res) => {
  const uploadedFile = req.file;
  const sourceKind = String(req.body.sourceKind ?? "");
  const targetFormat = normalizeFormat(req.body.targetFormat);
  const outputDir = path.join(workRoot, "outputs", crypto.randomUUID());

  if (!uploadedFile) {
    return res.status(400).json({ message: "No file uploaded." });
  }
  if (!allowedFormats.has(targetFormat)) {
    return res.status(400).json({ message: "Unsupported output format." });
  }

  try {
    // Guardar el archivo original en la carpeta permanente
    const originalExt = path.extname(uploadedFile.originalname);
    const permanentFileName = `${Date.now()}-${crypto.randomUUID()}${originalExt}`;
    const permanentPath = path.join(PERMANENT_UPLOADS_DIR, permanentFileName);
    await fs.copyFile(uploadedFile.path, permanentPath);

    await fs.mkdir(outputDir, { recursive: true });
    const kind = sourceKind || detectSourceKind(uploadedFile.originalname);
    let outputPath;

    if (kind === "image") {
      const ext = outputExtension(targetFormat);
      outputPath = path.join(outputDir, `converted-${crypto.randomUUID()}.${ext}`);
      await convertImage(uploadedFile.path, outputPath);
    } else if (kind === "video" || kind === "audio") {
      const ext = outputExtension(targetFormat);
      outputPath = path.join(outputDir, `converted-${crypto.randomUUID()}.${ext}`);
      await convertMedia(uploadedFile.path, outputPath);
    } else if (kind === "document" || kind === "text") {
      outputPath = await convertDocument(uploadedFile.path, outputDir, targetFormat);
    } else if (kind === "archive") {
      const ext = outputExtension(targetFormat);
      outputPath = path.join(outputDir, `converted-${crypto.randomUUID()}.${ext}`);
      await convertArchive(uploadedFile.path, outputPath, outputDir, targetFormat);
    } else {
      throw new Error("Tipo de archivo no soportado.");
    }

    // Guardar registro en la base de datos
    const userEmail = req.user?.email || "anónimo";
    const userId = req.user?.id || null;
    db.prepare(`
      INSERT INTO conversions (user_id, user_email, original_name, original_size, source_format, target_format, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, userEmail, uploadedFile.originalname, uploadedFile.size, originalExt.replace(".", ""), targetFormat, req.ip);

    // Actualizar contador del usuario
    if (userId) {
      const today = new Date().toISOString().split("T")[0];
      const user = db.prepare("SELECT last_conversion_date FROM users WHERE id = ?").get(userId);
      if (user?.last_conversion_date === today) {
        db.prepare("UPDATE users SET conversions_today = conversions_today + 1, total_conversions = total_conversions + 1 WHERE id = ?").run(userId);
      } else {
        db.prepare("UPDATE users SET conversions_today = 1, last_conversion_date = ?, total_conversions = total_conversions + 1 WHERE id = ?").run(today, userId);
      }
    }

    logActivity(userId, userEmail, "CONVERSION", `${uploadedFile.originalname} → ${targetFormat}`, req.ip);

    const downloadName = `${path.parse(uploadedFile.originalname).name}.${outputExtension(targetFormat)}`;
    res.download(outputPath, downloadName, async () => {
      await fs.rm(outputDir, { recursive: true, force: true });
      await fs.rm(uploadedFile.path, { force: true });
    });
  } catch (error) {
    await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(uploadedFile.path, { force: true }).catch(() => {});
    console.error("Conversion error:", error);
    res.status(500).json({ message: "No se pudo convertir el archivo en el servidor." });
  }
});

// ============================================================
// ADMIN AUTH - Login con token especial
// ============================================================

// Login para administradores (usa token en lugar de contraseña)
app.post("/api/auth/admin-login", authLimiter, (req, res) => {
  try {
    const { email, admin_token } = req.body;
    if (!email?.trim() || !admin_token?.trim())
      return res.status(400).json({ message: "Correo y token son obligatorios." });

    // Solo acepta el email de admin
    if (email.trim().toLowerCase() !== "admin@filefoxadmins.com") {
      return res.status(401).json({ message: "Credenciales inválidas." });
    }

    // Verificar el token en la base de datos
    const stored = db.prepare(`
      SELECT * FROM admin_tokens
      WHERE token = ? AND active = 1
    `).get(admin_token.trim());

    if (!stored) {
      return res.status(401).json({ message: "Token inválido o inactivo." });
    }

    // Generar un JWT de admin
    const adminJwt = jwt.sign(
      { role: "admin", email: "admin@filefoxadmins.com" },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logActivity(null, "admin@filefoxadmins.com", "ADMIN_LOGIN", "Inicio de sesión de administrador", req.ip);

    res.json({
      message: "Acceso de administrador concedido.",
      admin_token: adminJwt,
      expires_in: 86400, // 24 horas en segundos
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Error al autenticar administrador." });
  }
});

// Middleware para rutas de admin
function adminMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token de administrador requerido." });
  }
  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "No tienes permisos de administrador." });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Sesión de admin expirada.", code: "ADMIN_TOKEN_EXPIRED" });
    }
    return res.status(401).json({ message: "Token de administrador inválido." });
  }
}

// ============================================================
// Endpoints para ADMIN (protegidos con adminMiddleware)
// ============================================================

// Listar todas las conversiones
app.get("/api/admin/conversions", adminMiddleware, (req, res) => {
  try {
    const conversions = db.prepare(`
      SELECT c.id, c.user_id, c.user_email, c.original_name, c.original_size,
             c.source_format, c.target_format, c.status, c.created_at
      FROM conversions c
      ORDER BY c.created_at DESC
      LIMIT 100
    `).all();
    res.json({ conversions });
  } catch (error) {
    console.error("Error fetching conversions:", error);
    res.status(500).json({ message: "Error al obtener el historial." });
  }
});

// Listar archivos originales guardados
app.get("/api/admin/uploads", adminMiddleware, async (req, res) => {
  try {
    const files = await fs.readdir(PERMANENT_UPLOADS_DIR);
    const filesInfo = await Promise.all(
      files.map(async (filename) => {
        const filePath = path.join(PERMANENT_UPLOADS_DIR, filename);
        try {
          const stat = await fs.stat(filePath);
          return {
            name: filename,
            size: stat.size,
            created_at: stat.birthtime || stat.mtime,
          };
        } catch {
          return null;
        }
      })
    );
    res.json({ files: filesInfo.filter(Boolean).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) });
  } catch (error) {
    console.error("Error listing uploads:", error);
    res.status(500).json({ message: "Error al listar archivos." });
  }
});

// Listar actividad reciente
app.get("/api/admin/activity", adminMiddleware, (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT id, user_id, user_email, action, details, ip, created_at
      FROM activity_logs
      ORDER BY created_at DESC
      LIMIT 50
    `).all();
    res.json({ logs });
  } catch (error) {
    console.error("Error fetching activity:", error);
    res.status(500).json({ message: "Error al obtener actividad." });
  }
});

// Estadísticas
app.get("/api/admin/stats", adminMiddleware, (req, res) => {
  try {
    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get();
    const totalConversions = db.prepare("SELECT COUNT(*) as count FROM conversions").get();
    const conversionsToday = db.prepare("SELECT COUNT(*) as count FROM conversions WHERE date(created_at) = date('now')").get();
    const totalFiles = fs.readdir(PERMANENT_UPLOADS_DIR).then(files => files.length).catch(() => 0);

    Promise.all([totalFiles]).then(([fileCount]) => {
      res.json({
        total_users: totalUsers.count,
        total_conversions: totalConversions.count,
        conversions_today: conversionsToday.count,
        total_files: fileCount
      });
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ message: "Error al obtener estadísticas." });
  }
});

// ============================================================
// ADMIN - Gestión de usuarios
// ============================================================

// Listar usuarios (con búsqueda)
app.get("/api/admin/users", adminMiddleware, (req, res) => {
  try {
    const { search, page = "1", limit = "50" } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = "WHERE u.is_deleted = 0";
    const params = [];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      whereClause = `WHERE (u.name LIKE ? OR u.email LIKE ? OR u.last_login_ip LIKE ?) AND u.is_deleted = 0`;
      params.push(s, s, s);
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM users u ${whereClause}`).get(...params);
    const users = db.prepare(`
      SELECT
        u.id, u.name, u.email, u.email_verified, u.auth_provider, u.locale,
        u.total_conversions, u.conversions_today, u.last_conversion_date,
        u.login_count, u.last_login_ip, u.last_login_at,
        u.created_at, u.updated_at, u.is_deleted
      FROM users u
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    res.json({
      users,
      total: total.count,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(total.count / limitNum),
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error al obtener usuarios." });
  }
});

// Obtener un usuario por ID (con sus conversiones y actividad)
app.get("/api/admin/users/:id", adminMiddleware, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ message: "ID inválido." });

    const user = db.prepare(`
      SELECT id, name, email, email_verified, auth_provider, locale,
             total_conversions, conversions_today, last_conversion_date,
             login_count, last_login_ip, last_login_at,
             created_at, updated_at, is_deleted
      FROM users WHERE id = ?
    `).get(userId);

    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });

    const conversions = db.prepare(`
      SELECT id, original_name, original_size, source_format, target_format,
             status, download_count, ip, created_at
      FROM conversions WHERE user_id = ? OR user_email = ?
      ORDER BY created_at DESC LIMIT 50
    `).all(userId, user.email);

    const activity = db.prepare(`
      SELECT id, action, details, ip, created_at
      FROM activity_logs WHERE user_id = ? OR user_email = ?
      ORDER BY created_at DESC LIMIT 30
    `).all(userId, user.email);

    res.json({ user, conversions, activity });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Error al obtener usuario." });
  }
});

// Resetear contraseña de un usuario (admin)
app.post("/api/admin/users/:id/reset-password", adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { new_password } = req.body;
    if (!userId) return res.status(400).json({ message: "ID inválido." });
    if (!new_password || new_password.length < 8)
      return res.status(400).json({ message: "La contraseña debe tener al menos 8 caracteres." });

    const user = db.prepare("SELECT id, email FROM users WHERE id = ? AND is_deleted = 0").get(userId);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });

    const hash = await bcrypt.hash(new_password, 12);
    db.prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?").run(hash, userId);

    // Invalidar todos los refresh tokens del usuario
    db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(userId);

    logActivity(null, "admin@filefoxadmins.com", "ADMIN_RESET_PASSWORD",
      `Contraseña restablecida para: ${user.email}`, req.ip);

    res.json({ message: `Contraseña de ${user.email} restablecida correctamente.` });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Error al restablecer la contraseña." });
  }
});

// Eliminar (soft-delete) un usuario
app.post("/api/admin/users/:id/delete", adminMiddleware, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ message: "ID inválido." });

    const user = db.prepare("SELECT id, email FROM users WHERE id = ? AND is_deleted = 0").get(userId);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });

    db.prepare("UPDATE users SET is_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(userId);
    db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(userId);

    logActivity(null, "admin@filefoxadmins.com", "ADMIN_DELETE_USER",
      `Usuario eliminado: ${user.email}`, req.ip);

    res.json({ message: `Usuario ${user.email} eliminado.` });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Error al eliminar usuario." });
  }
});

// Restaurar un usuario eliminado
app.post("/api/admin/users/:id/restore", adminMiddleware, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ message: "ID inválido." });

    const user = db.prepare("SELECT id, email FROM users WHERE id = ? AND is_deleted = 1").get(userId);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado o no eliminado." });

    db.prepare("UPDATE users SET is_deleted = 0, deleted_at = NULL, updated_at = datetime('now') WHERE id = ?").run(userId);

    logActivity(null, "admin@filefoxadmins.com", "ADMIN_RESTORE_USER",
      `Usuario restaurado: ${user.email}`, req.ip);

    res.json({ message: `Usuario ${user.email} restaurado.` });
  } catch (error) {
    console.error("Error restoring user:", error);
    res.status(500).json({ message: "Error al restaurar usuario." });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, "0.0.0.0", () => {
  console.log(`Filefox backend listening on http://0.0.0.0:${port}`);
  console.log(`CORS origin: ${process.env.FRONTEND_URL || "http://localhost:8080"}`);
  console.log(`Rate limit: 30 req/min general, 5 req/min auth`);
});
