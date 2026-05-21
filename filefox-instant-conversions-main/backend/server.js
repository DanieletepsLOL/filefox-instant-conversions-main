import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import cors from "cors";
import express from "express";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.join(__dirname, "tmp");
const upload = multer({
  dest: path.join(workRoot, "uploads"),
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

const app = express();
app.use(cors({ origin: true }));

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
    const child = spawn(command, args, { ...options, windowsHide: true });
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
  await run("magick", [inputPath, outputPath]);
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

async function convertArchive(inputPath, outputPath, outputDir, targetFormat) {
  const extractDir = path.join(outputDir, "extracted");
  await fs.mkdir(extractDir, { recursive: true });
  await run("7z", ["x", inputPath, `-o${extractDir}`, "-y"]);

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

  await run("7z", ["a", outputPath, extractDir]);
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
app.listen(port, () => {
  console.log(`Filefox backend listening on http://localhost:${port}`);
});
