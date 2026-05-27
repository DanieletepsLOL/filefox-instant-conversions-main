import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { spawnSync } from "node:child_process";
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

// Helper para obtener IP real del cliente (función mejorada)
function getClientIP(req) {
  // 1. Express con trust proxy ya calcula req.ip correctamente
  //    tomando la primera IP de x-forwarded-for
  // 2. Por si acaso, verificamos manualmente
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    // La primera IP de la cadena es la del cliente real
    const ips = forwarded.split(",").map(s => s.trim());
    const realIp = ips[0];
    // Ignorar IPs privadas/internas (loopback, LAN)
    if (realIp && realIp !== "127.0.0.1" && realIp !== "::1" && realIp !== "::ffff:127.0.0.1") {
      return cleanIp(realIp);
    }
  }
  const realIp = req.headers["x-real-ip"];
  if (realIp && realIp !== "127.0.0.1" && realIp !== "::1") return cleanIp(realIp);
  // Fallback: usar req.ip de Express (confía en trust proxy)
  const expressIp = req.ip || req.connection?.remoteAddress || "desconocida";
  // Si sigue siendo localhost y hay x-forwarded-for, devolver la primera IP aunque sea local
  if ((expressIp === "127.0.0.1" || expressIp === "::1" || expressIp === "::ffff:127.0.0.1") && forwarded) {
    return cleanIp(forwarded.split(",")[0].trim());
  }
  return cleanIp(expressIp);
}

// Limpiar formato IPv6 mapeado (::ffff:192.168.x.x → 192.168.x.x)
function cleanIp(ip) {
  if (!ip) return ip;
  return ip.replace(/^::ffff:/, '');
}

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
// Directorio raíz de datos (cámbialo a donde quieras en tu servidor)
// En producción, usa una ruta fija como /var/filefox/data
// Para desarrollo/local, puedes dejarlo en ./data dentro del proyecto
const DATA_DIR = process.env.FILEFOX_DATA_DIR || "/var/filefox/data";
const dbPath = path.join(DATA_DIR, "filefox.db");

// Carpeta permanente para guardar los archivos originales subidos (disco 1TB montado en /var/filefox/uploads)
let PERMANENT_UPLOADS_DIR = process.env.FILEFOX_UPLOADS_DIR || "/var/filefox/uploads";
try {
  await fs.mkdir(PERMANENT_UPLOADS_DIR, { recursive: true });
} catch (err) {
  console.error("No se pudo crear", PERMANENT_UPLOADS_DIR, ":", err.message);
  // Fallback a un directorio local si no se puede crear
  PERMANENT_UPLOADS_DIR = path.join(DATA_DIR, "uploads");
  console.log("Usando fallback:", PERMANENT_UPLOADS_DIR);
  await fs.mkdir(PERMANENT_UPLOADS_DIR, { recursive: true }).catch(() => {});
}

// Carpeta temporal para archivos convertidos disponibles por 1 hora
const TEMP_FILES_DIR = path.join(os.tmpdir(), "filefox-temp");
await fs.mkdir(TEMP_FILES_DIR, { recursive: true }).catch(() => {});

// Map en memoria: fileId → { filePath, downloadFilename, expiresAt, userId, originalName, size, sourceFormat, targetFormat }
const tempFiles = new Map();

// Limpieza automática cada 60 segundos: borra archivos expirados
const CLEANUP_INTERVAL = 60_000;
const FILE_TTL = 60 * 60 * 1000; // 1 hora
setInterval(async () => {
  const now = Date.now();
  for (const [fileId, meta] of tempFiles.entries()) {
    if (now > meta.expiresAt) {
      await fs.rm(meta.filePath, { force: true }).catch(() => {});
      tempFiles.delete(fileId);
      console.log(`🧹 Archivo temporal eliminado: ${fileId}`);
    }
  }
}, CLEANUP_INTERVAL);

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
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
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
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
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
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
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
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Ejecutar migraciones automáticas (columnas nuevas en tablas existentes)
console.log("📦 Ejecutando migraciones...");
runMigrations(db);

// ✅ Tabla de tokens de administrador (para login con token)
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);

// ✅ Tabla de reportes de errores de conversión
db.exec(`
  CREATE TABLE IF NOT EXISTS conversion_errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_format TEXT NOT NULL DEFAULT 'unknown',
    target_formats TEXT NOT NULL,
    error_message TEXT,
    description TEXT NOT NULL,
    email TEXT,
    ip TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);

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
  db.prepare("DELETE FROM refresh_tokens WHERE expires_at < datetime('now', 'localtime')").run();
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
    `).run(name.trim(), email.trim().toLowerCase(), hash, locale, getClientIP(req));

    const userId = result.lastInsertRowid;
    const user = { id: userId, email: email.trim().toLowerCase(), name: name.trim() };

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(userId);

    logActivity(userId, email.trim().toLowerCase(), "REGISTER", "Nuevo registro", getClientIP(req));

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
    if (user.is_deleted)
      return res.status(403).json({ message: "Esta cuenta ha sido eliminada." });

    // Detectar idioma del navegador desde el header Accept-Language
    const acceptLanguage = req.headers["accept-language"] || "";
    const locale = acceptLanguage.split(",")[0]?.split("-")[0] || null;

    // Actualizar IP, locale, login count y fecha del último login
    db.prepare(`
      UPDATE users SET
        last_login_ip = ?,
        last_login_at = datetime('now', 'localtime'),
        login_count = login_count + 1,
        locale = COALESCE(?, locale),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(getClientIP(req), locale, user.id);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user.id);

    logActivity(user.id, user.email, "LOGIN", "Inicio de sesión", getClientIP(req));

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
      WHERE rt.token = ? AND rt.expires_at > datetime('now', 'localtime')
    `).get(refresh_token);

    if (!stored) {
      return res.status(401).json({ message: "Refresh token inválido o expirado. Inicia sesión de nuevo.", code: "REFRESH_INVALID" });
    }

    // Eliminar el refresh token usado (para que no se pueda reusar)
    db.prepare("DELETE FROM refresh_tokens WHERE id = ?").run(stored.id);

    const user = { id: stored.user_id, email: stored.email, name: stored.name };
    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(stored.user_id);

    logActivity(stored.user_id, stored.email, "REFRESH_TOKEN", "Token renovado", getClientIP(req));

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
    logActivity(req.user.id, req.user.email, "LOGOUT", "Cierre de sesión", getClientIP(req));
    res.json({ message: "Sesión cerrada." });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Error al cerrar sesión." });
  }
});

// Obtener perfil del usuario
app.get("/api/auth/me", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT id, name, email, email_verified, total_conversions, created_at, is_deleted FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
  if (user.is_deleted) return res.status(403).json({ message: "Esta cuenta ha sido eliminada." });
  res.json({ user });
});

// ============================================================
// Formatos permitidos
// ============================================================
const allowedFormats = new Set([
  // Imagenes existentes + nuevos formatos
  "JPG", "JPEG", "PNG", "WEBP", "AVIF", "GIF", "BMP", "TIFF", "TIF", "HEIC", "HEIF", "ICO", "SVG", "PDF", "EPS",
  "PSD", "DDS", "HDR", "EXR", "TGA", "DNG", "PPM", "PGM", "PBM", "PNM", "PAM", "PFM", "XWD", "SUN", "RAS",
  "MTV", "PCD", "FTS", "RGBO", "IPL", "UYVY", "VIFF", "PALM", "HRZ", "XV", "PAL", "MNG", "JPS", "PICT",
  "JBIG", "JBG", "RGF", "SIX", "SIXEL", "SGI", "FAX", "G3", "G4", "JFI", "YUV", "PCT", "OTB", "VIPS", "MAP",
  "WBMP", "JP2", "J2K", "JPC", "PGX", "PICON", "PDB", "JIF", "JPE", "CUR",
  // Video
  "MP4", "WEBM", "MOV", "MKV", "AVI", "M4V", "FLV",
  // Audio
  "MP3", "WAV", "FLAC", "AAC", "OGG", "OGA", "M4A", "M4R", "OPUS", "WMA", "AIFF", "AIF", "AMR", "MP2", "AC3", "GSM", "CAF", "VOC", "WV", "AU", "DTS", "W64", "TTA", "8SVX", "IMA", "SPH", "RA", "SPX",
  // Documentos
  "DOC", "DOCX", "ODT", "RTF", "TXT", "HTML", "MD", "EPUB", "CSV", "XLSX", "JSON", "XML", "YAML",
  // Comprimidos
  "ZIP", "7Z", "TAR", "TAR.GZ", "TGZ", "GZ", "BZ2", "XZ",
]);

const imageExts = ["jpg","jpeg","png","webp","avif","gif","bmp","tiff","tif","heic","heif","ico","svg","pdf","eps",
  "psd","dds","hdr","exr","tga","dng","ppm","pgm","pbm","pnm","pam","pfm","xwd","sun","ras",
  "mtv","pcd","fts","rgbo","ipl","uyvy","viff","palm","hrz","xv","pal","mng","jps","pict",
  "jbig","jbg","rgf","six","sixel","sgi","fax","g3","g4","jfi","yuv","pct","otb","vips","map",
  "wbmp","jp2","j2k","jpc","pgx","picon","pdb","jif","jpe","cur"];
const videoExts = ["mp4","webm","mov","mkv","avi","m4v","flv"];
const audioExts = ["mp3","wav","aac","flac","ogg","m4a","m4r","opus","wma","aiff","aif","mid","midi","amr","mp2","ac3","gsm","caf","voc","wv","au","dts","w64","tta","8svx","ima","sph","ra","spx","cdda"];
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
  return format.toLowerCase();
}

function run(command, args, options = {}, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options });

    let stderr = "";

    const timeout = setTimeout(() => {
      child.kill("SIGKILL"); // 👈 ESTO mata el proceso REAL
      reject(new Error("Timeout de conversión"));
    }, timeoutMs);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code === 0) return resolve();

      reject(new Error(`${command} failed with code ${code}: ${stderr}`));
    });
  });
}

function findCommand(cmd) {
  if (process.platform !== "win32" && cmd === "magick") return "convert";
  return cmd;
}

async function convertImage(inputPath, outputPath, targetFormat, fileSize, originalName = "") {
  const timeout = fileSize < 1_000_000 ? 15000 : 120000;

  // Detectar .ico por el nombre original (multer cambia la ruta temporal)
  const sourceIsIco = (originalName || inputPath).toLowerCase().endsWith(".ico");

  if (sourceIsIco) {
    const { convertIco } = await import("./ico-converter.js");
    await convertIco(inputPath, outputPath, targetFormat, timeout);
    return;
  }

  const args = [
    inputPath,
    "-auto-orient"
  ];

  // ICO fix (por si alguien convierte a ICO desde otro formato)
  if (targetFormat === "ICO") {
    args.push(
      "-resize", "256x256",
      "-define", "icon:auto-resize=256,128,64,32,16"
    );
  }

  args.push(outputPath);

  await run(findCommand("convert"), args, {}, timeout);
}

// Formatos que requieren 8000 Hz forzosamente
const FORMATS_REQUIRE_8KHZ = new Set(["GSM"]);

// Formatos que requieren 16000 Hz
const FORMATS_REQUIRE_16KHZ = new Set(["SPX"]);

// Mapeo de extensiones especiales a formatos y codecs que FFmpeg soporte realmente
// Verificado con FFmpeg 8.0.1 (Ubuntu)
const FFMPEG_FORMAT_OVERRIDES = {
  // 8SVX: no hay muxer nativo en FFmpeg 8.0, usamos WAV con PCM 8-bit unsigned
  "8SVX":  { format: "wav",       codec: "pcm_u8" },
  // IMA ADPCM: se escribe como WAV con codec ADPCM IMA
  "IMA":   { format: "wav",       codec: "adpcm_ima_wav" },
  // NIST SPHERE
  "SPH":   { format: "nistsphere", codec: "pcm_s16le" },
  // MIDI/MID: FFmpeg 8.0 no tiene muxer MIDI, solo demuxer
  // "MIDI": { format: "midi", codec: null },
  // CDDA: no hay muxer CDDA en esta versión
  // "CDDA": { format: "cdda", codec: "pcm_s16le" },
};

// Añade un timeout explícito para que FFmpeg no deje colgado el servidor
async function convertMedia(inputPath, outputPath) {
  const ext = path.extname(outputPath).toLowerCase().replace(".", "").toUpperCase();

  // Construir args con re-muestreo automático si es necesario
  const args = [
    "-y",
    "-i", inputPath,
  ];

  // Re-muestreo forzado para formatos que lo requieren
  if (FORMATS_REQUIRE_8KHZ.has(ext)) {
    args.push("-ar", "8000");        // GSM requiere 8000 Hz
  } else if (FORMATS_REQUIRE_16KHZ.has(ext)) {
    args.push("-ar", "16000");       // Speex requiere 16000 Hz
  }

  // Codec específico para formatos problemáticos
  if (ext === "GSM") {
    args.push("-ac", "1");           // GSM es mono
    args.push("-codec:a", "libgsm");
  } else if (ext === "SPX") {
    args.push("-codec:a", "libspeex");
  } else if (ext === "RA") {
    args.push("-codec:a", "real_144"); // RealAudio 14.4
  } else if (ext === "DTS") {
    args.push("-strict", "-2");      // DTS usa codec experimental 'dca'
  } else if (ext === "AC3") {
    args.push("-codec:a", "ac3");    // Forzar codec AC3 explícito
  }

  // Para 8SVX, forzamos a 8-bit mono 8000Hz
  if (ext === "8SVX") {
    args.push("-ac", "1");
    args.push("-ar", "8000");
    args.push("-codec:a", "pcm_u8");
  }

  // Verificar si necesitamos un formato/muxer especial (no solo extensión)
  const override = FFMPEG_FORMAT_OVERRIDES[ext];
  if (override) {
    if (override.codec) {
      args.push("-codec:a", override.codec);
    }
    // Usar -f para forzar el nombre de formato que FFmpeg reconoce
    args.push("-f", override.format);
  }

  args.push(outputPath);

  await run("ffmpeg", args, {}, 120000); // Límite de 2 minutos
}
async function convertDocument(inputPath, outputDir, targetFormat) {
  await run("libreoffice", ["--headless", "--convert-to", targetFormat.toLowerCase(), "--outdir", outputDir, inputPath]);

  const files = await fs.readdir(outputDir);

  // Corrección crítica: Mapeo asíncrono puro para evitar la caída por fs.statSync
  const filesWithStats = await Promise.all(
    files.map(async (f) => {
      const fullPath = path.join(outputDir, f);
      const stat = await fs.stat(fullPath); // correcto usando fs/promises de forma asíncrona
      return { file: fullPath, time: stat.mtimeMs };
    })
  );

  const match = filesWithStats.sort((a, b) => b.time - a.time)[0]?.file;
  if (!match) throw new Error("LibreOffice no generó el archivo esperado.");

  return match;
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

// Middleware de autenticación opcional (no bloquea si no hay token)
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    } catch {
      // Token inválido o expirado → simplemente lo tratamos como anónimo
    }
  }
  next();
}

// ============================================================
// Endpoint principal de conversión
// ============================================================
app.post("/api/conversions", optionalAuth, upload.single("file"), async (req, res) => {
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
      // Pasar también el nombre original para detectar .ico por extensión
      await convertImage(uploadedFile.path, outputPath, targetFormat, uploadedFile.size, uploadedFile.originalname);
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
    `).run(userId, userEmail, uploadedFile.originalname, uploadedFile.size, originalExt.replace(".", ""), targetFormat, getClientIP(req));

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

    logActivity(userId, userEmail, "CONVERSION", `${uploadedFile.originalname} → ${targetFormat}`, getClientIP(req));

    // Guardar el archivo convertido en TEMP_FILES_DIR con un ID único para descarga por 1 hora
    const fileId = crypto.randomUUID();
    const downloadName = `${path.parse(uploadedFile.originalname).name}.${outputExtension(targetFormat)}`;
    const tempFilePath = path.join(TEMP_FILES_DIR, fileId);
    await fs.copyFile(outputPath, tempFilePath);

    const expiresAt = Date.now() + FILE_TTL;
    tempFiles.set(fileId, {
      filePath: tempFilePath,
      downloadFilename: downloadName,
      expiresAt,
      userId: req.user?.id || null,
      originalName: uploadedFile.originalname,
      size: uploadedFile.size,
      sourceFormat: originalExt.replace(".", ""),
      targetFormat,
    });

    // Limpiar los directorios temporales de conversión
    await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(uploadedFile.path, { force: true }).catch(() => {});

    const downloadUrl = `/api/files/${fileId}`;
    console.log(`📤 Archivo convertido disponible: ${downloadUrl} (expira en 1 hora)`);

    res.json({
      downloadUrl,
      downloadFilename: downloadName,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  } catch (error) {
    await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(uploadedFile.path, { force: true }).catch(() => {});
console.error("❌ Conversion error FULL:", error);
console.error("STD ERROR:", error?.message);
console.error("STACK:", error?.stack);

res.status(500).json({
  message: "No se pudo convertir el archivo en el servidor.",
  debug: error?.message
});
  }
});

// ============================================================
// Endpoint para reportar errores de conversión
// ============================================================
app.post("/api/conversions/errors", (req, res) => {
  try {
    const { sourceFormat, targetFormats, errorMessage, description, email } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ message: "Description is required." });
    }
    if (!targetFormats || !Array.isArray(targetFormats) || targetFormats.length === 0) {
      return res.status(400).json({ message: "At least one target format is required." });
    }

    db.prepare(`
      INSERT INTO conversion_errors (source_format, target_formats, error_message, description, email, ip)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      sourceFormat || "unknown",
      targetFormats.join(", "),
      (errorMessage || "").slice(0, 500),
      description.trim(),
      (email || "").trim() || null,
      getClientIP(req)
    );

    logActivity(null, email || null, "CONVERSION_ERROR_REPORT",
      `Error report: ${sourceFormat} → ${targetFormats.join(", ")}`, getClientIP(req));

    res.json({ message: "Report received. Thank you!" });
  } catch (error) {
    console.error("Error report error:", error);
    res.status(500).json({ message: "Error saving report." });
  }
});

// ============================================================
// ADMIN - Ver reportes de errores
// ============================================================
app.get("/api/admin/errors", adminMiddleware, (req, res) => {
  try {
    const errors = db.prepare(`
      SELECT id, source_format, target_formats, error_message, description, email, ip, created_at
      FROM conversion_errors
      ORDER BY created_at DESC
      LIMIT 100
    `).all();
    res.json({ errors });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ message: "Error al obtener reportes." });
  }
});

// ============================================================
// Endpoint para listar archivos convertidos del usuario autenticado
// Solo devuelve archivos que aún no hayan expirado
// ============================================================
app.get("/api/files", authMiddleware, (req, res) => {
  try {
    const now = Date.now();
    const userFiles = [];

    for (const [fileId, meta] of tempFiles.entries()) {
      // Solo archivos del usuario autenticado que no hayan expirado
      if (meta.userId === req.user.id && now < meta.expiresAt) {
        userFiles.push({
          id: fileId,
          name: meta.downloadFilename,
          originalName: meta.originalName,
          size: meta.size,
          sourceFormat: meta.sourceFormat,
          targetFormat: meta.targetFormat,
          downloadUrl: `/api/files/${fileId}`,
          expiresAt: new Date(meta.expiresAt).toISOString(),
          uploadedAt: new Date(meta.expiresAt - 60 * 60 * 1000).toISOString(), // estimado: 1 hora antes
        });
      }
    }

    // Ordenar por fecha de subida (más reciente primero)
    userFiles.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    res.json({ files: userFiles });
  } catch (error) {
    console.error("Error listing user files:", error);
    res.status(500).json({ message: "Error al listar archivos." });
  }
});

// ============================================================
// Endpoint para eliminar un archivo temporal del usuario
// ============================================================
app.delete("/api/files/:fileId", authMiddleware, async (req, res) => {
  const { fileId } = req.params;
  const meta = tempFiles.get(fileId);

  if (!meta) {
    return res.status(404).json({ message: "Archivo no encontrado o ya expiró." });
  }

  // Solo el dueño puede eliminar
  if (meta.userId !== req.user.id) {
    return res.status(403).json({ message: "No tienes permiso para eliminar este archivo." });
  }

  // Eliminar archivo físico y del map
  await fs.rm(meta.filePath, { force: true }).catch(() => {});
  tempFiles.delete(fileId);

  res.json({ message: "Archivo eliminado." });
});

// ============================================================
// Endpoint para descargar archivos convertidos (válidos por 1 hora)
// ============================================================
app.get("/api/files/:fileId", async (req, res) => {
  const { fileId } = req.params;
  const meta = tempFiles.get(fileId);

  if (!meta) {
    return res.status(404).json({ message: "Archivo no encontrado o ha expirado." });
  }

  if (Date.now() > meta.expiresAt) {
    tempFiles.delete(fileId);
    await fs.rm(meta.filePath, { force: true }).catch(() => {});
    return res.status(410).json({ message: "El archivo ha expirado (máximo 1 hora)." });
  }

  const exists = await fs.stat(meta.filePath).then(() => true).catch(() => false);
  if (!exists) {
    tempFiles.delete(fileId);
    return res.status(404).json({ message: "El archivo ya no está disponible." });
  }

  res.download(meta.filePath, meta.downloadFilename);
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

    logActivity(null, "admin@filefoxadmins.com", "ADMIN_LOGIN", "Inicio de sesión de administrador", getClientIP(req));

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

app.get("/api/admin/stats", adminMiddleware, async (req, res) => {
  try {
    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get();
    const totalConversions = db.prepare("SELECT COUNT(*) as count FROM conversions").get();
    const conversionsToday = db.prepare("SELECT COUNT(*) as count FROM conversions WHERE date(created_at) = date('now')").get();
    const errorCount = db.prepare("SELECT COUNT(*) as count FROM conversion_errors").get();

    const files = await fs.readdir(PERMANENT_UPLOADS_DIR);
    const fileCount = files.length;

    res.json({
      total_users: totalUsers.count,
      total_conversions: totalConversions.count,
      conversions_today: conversionsToday.count,
      total_files: fileCount,
      error_reports: errorCount.count
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

    const showDeleted = req.query.show_deleted === "1";
    let whereClause = showDeleted ? "WHERE u.is_deleted = 1" : "WHERE u.is_deleted = 0";
    const params = [];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      whereClause = showDeleted
        ? `WHERE (u.name LIKE ? OR u.email LIKE ? OR u.last_login_ip LIKE ?) AND u.is_deleted = 1`
        : `WHERE (u.name LIKE ? OR u.email LIKE ? OR u.last_login_ip LIKE ?) AND u.is_deleted = 0`;
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
    db.prepare("UPDATE users SET password = ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(hash, userId);

    // Invalidar todos los refresh tokens del usuario
    db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(userId);

    logActivity(null, "admin@filefoxadmins.com", "ADMIN_RESET_PASSWORD",
      `Contraseña restablecida para: ${user.email}`, getClientIP(req));

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

    db.prepare("UPDATE users SET is_deleted = 1, deleted_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime') WHERE id = ?").run(userId);
    db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(userId);

    logActivity(null, "admin@filefoxadmins.com", "ADMIN_DELETE_USER",
      `Usuario eliminado: ${user.email}`, getClientIP(req));

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

    db.prepare("UPDATE users SET is_deleted = 0, deleted_at = NULL, updated_at = datetime('now', 'localtime') WHERE id = ?").run(userId);

    logActivity(null, "admin@filefoxadmins.com", "ADMIN_RESTORE_USER",
      `Usuario restaurado: ${user.email}`, getClientIP(req));

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
