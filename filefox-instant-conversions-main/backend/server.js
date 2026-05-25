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
// Carpeta temporal para archivos de trabajo
const workRoot = path.join(os.tmpdir(), "filefox-tmp");
const upload = multer({
  dest: path.join(workRoot, "uploads"),
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ============================================
// Base de datos SQLite + Auth
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || "filefox-secret-change-in-production-" + crypto.randomBytes(16).toString("hex");
const DATA_DIR = path.join(os.tmpdir(), "filefox-data");
const dbPath = path.join(DATA_DIR, "filefox.db");

// Asegurar que el directorio de datos existe
await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Crear tabla de usuarios si no existe
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Middleware para verificar token JWT
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token requerido." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido o expirado." });
  }
}

// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ message: "Todos los campos son obligatorios." });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "La contraseña debe tener al menos 8 caracteres." });
    }

    // Verificar si el email ya existe
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim().toLowerCase());
    if (existing) {
      return res.status(409).json({ message: "Este correo ya está registrado." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = db.prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)").run(
      name.trim(),
      email.trim().toLowerCase(),
      hashedPassword
    );

    const token = jwt.sign(
      { id: result.lastInsertRowid, email: email.trim().toLowerCase(), name: name.trim() },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(201).json({
      message: "Cuenta creada exitosamente.",
      token,
      user: { email: email.trim().toLowerCase(), name: name.trim() },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Error al crear la cuenta." });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password?.trim()) {
      return res.status(400).json({ message: "Correo y contraseña son obligatorios." });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ message: "Correo o contraseña incorrectos." });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Correo o contraseña incorrectos." });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      message: "Inicio de sesión exitoso.",
      token,
      user: { email: user.email, name: user.name },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Error al iniciar sesión." });
  }
});

// GET /api/auth/me - Obtener datos del usuario autenticado
app.get("/api/auth/me", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT id, name, email, created_at FROM users WHERE id = ?").get(req.user.id);
  if (!user) {
    return res.status(404).json({ message: "Usuario no encontrado." });
  }
  res.json({ user });
});

const allowedFormats = new Set([
  "JPG",
  "PNG",
  "WEBP",
  "AVIF",
  "GIF",
  "BMP",
  "TIFF",
  "HEIC",
  "ICO",
  "SVG",
  "PDF",
  "EPS",
  "MP4",
  "WEBM",
  "MOV",
  "MKV",
  "AVI",
  "M4V",
  "FLV",
  "MP3",
  "WAV",
  "AAC",
  "FLAC",
  "OGG",
  "M4A",
  "OPUS",
  "DOC",
  "DOCX",
  "ODT",
  "RTF",
  "TXT",
  "HTML",
  "MD",
  "EPUB",
  "CSV",
  "XLSX",
  "JSON",
  "XML",
  "YAML",
  "ZIP",
  "7Z",
  "TAR",
  "TAR.GZ",
  "TGZ",
  "GZ",
  "BZ2",
  "XZ",
]);

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

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} failed with code ${code}: ${stderr}`));
    });
  });
}

async function convertImage(inputPath, outputPath) {
  const cmd = findCommand("magick");
  await run(cmd, [inputPath, outputPath]);
}

async function convertMedia(inputPath, outputPath) {
  await run("ffmpeg", ["-y", "-i", inputPath, outputPath]);
}

async function convertDocument(inputPath, outputDir, targetFormat) {
  const libreOfficeFormat = targetFormat.toLowerCase();
  await run("libreoffice", ["--headless", "--convert-to", libreOfficeFormat, "--outdir", outputDir, inputPath]);
}

async function findConvertedDocument(outputDir, targetFormat) {
  const files = await fs.readdir(outputDir);
  const extension = `.${outputExtension(targetFormat)}`;
  const match = files.find((file) => file.toLowerCase().endsWith(extension));
  if (!match) throw new Error("LibreOffice did not create the expected output file.");
  return path.join(outputDir, match);
}

const SEVEN_ZIP = "7z";

function findCommand(cmd) {
  // En Linux, 'magick' puede ser 'convert' de ImageMagick
  if (process.platform !== "win32") {
    if (cmd === "magick") return "convert";
  }
  return cmd;
}

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
    const compressionFlag = targetFormat === "GZ" ? "z" : targetFormat === "BZ2" ? "j" : "J";
    await run("tar", [`-c${compressionFlag}f`, outputPath, "-C", extractDir, "."]);
    return;
  }

  // Para 7Z, ZIP y otros formatos usamos 7-Zip
  // Ejecutamos 7z directamente en el directorio de salida
  const outDir = path.dirname(outputPath);
  const outName = path.basename(outputPath);
  await run(SEVEN_ZIP, ["a", outName, `${extractDir}${path.sep}.`, `-t${outputExtension(targetFormat)}`], { cwd: outDir });
}

async function convertFile({ inputPath, outputDir, sourceKind, targetFormat }) {
  const extension = outputExtension(targetFormat);
  const outputPath = path.join(outputDir, `converted-${crypto.randomUUID()}.${extension}`);

  if (sourceKind === "image") {
    await convertImage(inputPath, outputPath);
    return outputPath;
  }

  if (sourceKind === "video" || sourceKind === "audio") {
    await convertMedia(inputPath, outputPath);
    return outputPath;
  }

  if (sourceKind === "document" || sourceKind === "text") {
    await convertDocument(inputPath, outputDir, targetFormat);
    return findConvertedDocument(outputDir, targetFormat);
  }

  if (sourceKind === "archive") {
    await convertArchive(inputPath, outputPath, outputDir, targetFormat);
    return outputPath;
  }

  throw new Error("Unsupported file type.");
}

app.post("/api/conversions", upload.single("file"), async (req, res) => {
  const uploadedFile = req.file;
  const sourceKind = String(req.body.sourceKind ?? "");
  const targetFormat = normalizeFormat(req.body.targetFormat);
  const outputDir = path.join(workRoot, "outputs", crypto.randomUUID());

  if (!uploadedFile) {
    res.status(400).json({ message: "No file uploaded." });
    return;
  }

  if (!allowedFormats.has(targetFormat)) {
    res.status(400).json({ message: "Unsupported output format." });
    return;
  }

  try {
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = await convertFile({
      inputPath: uploadedFile.path,
      outputDir,
      sourceKind,
      targetFormat,
    });

    const downloadName = `${path.parse(uploadedFile.originalname).name}.${outputExtension(targetFormat)}`;
    res.download(outputPath, downloadName, async () => {
      await fs.rm(outputDir, { recursive: true, force: true });
      await fs.rm(uploadedFile.path, { force: true });
    });
  } catch (error) {
    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.rm(uploadedFile.path, { force: true });
    console.error(error);
    res.status(500).json({ message: "No se pudo convertir el archivo en el servidor." });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, "0.0.0.0", () => {
  console.log(`Filefox backend listening on http://0.0.0.0:${port}`);
});
