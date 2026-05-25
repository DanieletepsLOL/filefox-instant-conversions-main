import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

function runProcess(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Timeout de conversión ICO"));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) return resolve(stdout);
      reject(new Error(`ico-to-png failed: ${stderr || stdout}`));
    });
  });
}

/**
 * Convierte un archivo .ico a otro formato usando ico-to-png (PNG intermedio) + ImageMagick.
 */
export async function convertIco(inputPath, outputPath, targetFormat, timeoutMs) {
  const ext = targetFormat.toLowerCase();

  // ico-to-png solo produce PNG, así que primero convertimos a PNG intermedio
  const pngPath = outputPath.replace(/\.[^.]+$/, "") + "-temp.png";

  try {
    // Paso 1: .ico → .png con ico-to-png
    const icoToPng = (await import("ico-to-png")).default;
    const icoBuffer = await fs.readFile(inputPath);
    const pngBuffer = await icoToPng(icoBuffer, 256);
    await fs.writeFile(pngPath, pngBuffer);

    // Paso 2: si el destino es PNG, ya estamos
    if (ext === "png") {
      await fs.rename(pngPath, outputPath);
      return;
    }

    // Paso 3: si no, convertir PNG intermedio al formato deseado con ImageMagick
    await runProcess("convert", [pngPath, outputPath], timeoutMs);
  } finally {
    // Limpiar el PNG temporal si existe y no es el output final
    if (ext !== "png") {
      await fs.unlink(pngPath).catch(() => {});
    }
  }
}
