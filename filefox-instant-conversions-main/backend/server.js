import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import cors from "cors";
import express from "express";
import multer from "multer";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.join(os.tmpdir(), "filefox-tmp");

const upload = multer({
  dest: path.join(workRoot, "uploads"),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ============================================================
// Configuración de carpetas
// ============================================================
const JWT_SECRET = process.env.JWT_SECRET || "filefox-secret-" + crypto.randomBytes(16).toString("hex");
const DATA_DIR = path.join(os.tmpdir(), "filefox-data");
const dbPath = path.join(DATA_DIR, "filefox.db");

// Carpeta permanente para guardar los archivos originales subidos
const PERMANENT_UPLOADS_DIR = "/var/filefox/uploads";
await fs.mkdir(PERMANENT_UPLOADS_DIR, { recursive: true }).catch(() => {});

await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Tabla para historial de conversiones (para que tú puedas ver lo que se subió)
db.exec(`
  CREATE TABLE IF NOT EXISTS conversions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_email TEXT,
    original_name TEXT NOT NULL,
    original_size INTEGER NOT NULL,
    source_format TEXT NOT NULL,
    target_format TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token requerido." });
  }
  try {
    req.user = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido o expirado." });
  }
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password?.trim())
      return res.status(400).json({ message: "Todos los campos son obligatorios." });
    if (password.length < 8)
      return res.status(400).json({ message: "La contraseña debe tener al menos 8 caracteres." });
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim().toLowerCase()))
      return res.status(409).json({ message: "Este correo ya está registrado." });

    const hash = await bcrypt.hash(password, 12);
    const result = db.prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)").run(
      name.trim(), email.trim().toLowerCase(), hash
    );
    const token = jwt.sign(
      { id: result.lastInsertRowid, email: email.trim().toLowerCase(), name: name.trim() },
      JWT_SECRET, { expiresIn: "30d" }
    );
    res.status(201).json({ message: "Cuenta creada.", token, user: { email: email.trim().toLowerCase(), name: name.trim() } });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Error al crear la cuenta." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password?.trim())
      return res.status(400).json({ message: "Correo y contraseña son obligatorios." });

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: "Correo o contraseña incorrectos." });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET, { expiresIn: "30d" }
    );
    res.json({ message: "Inicio de sesión exitoso.", token, user: { email: user.email, name: user.name } });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Error al iniciar sesión." });
  }
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT id, name, email, created_at FROM users WHERE id = ?").get(req.user.id);
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
      INSERT INTO conversions (user_id, user_email, original_name, original_size, source_format, target_format)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, userEmail, uploadedFile.originalname, uploadedFile.size, originalExt.replace(".", ""), targetFormat);

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
// Endpoints para que TÚ puedas ver los archivos subidos
// ============================================================

// Listar todas las conversiones registradas (solo para admin)
app.get("/api/admin/conversions", (req, res) => {
  try {
    const conversions = db.prepare(`
      SELECT id, user_id, user_email, original_name, original_size, source_format, target_format, status, created_at
      FROM conversions
      ORDER BY created_at DESC
      LIMIT 100
    `).all();
    res.json({ conversions });
  } catch (error) {
    console.error("Error fetching conversions:", error);
    res.status(500).json({ message: "Error al obtener el historial." });
  }
});

// Listar archivos originales guardados permanentemente
app.get("/api/admin/uploads", async (req, res) => {
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, "0.0.0.0", () => {
  console.log(`Filefox backend listening on http://0.0.0.0:${port}`);
});
