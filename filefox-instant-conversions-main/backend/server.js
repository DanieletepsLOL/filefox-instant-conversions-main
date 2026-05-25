async function convertArchive(inputPath, outputPath, outputDir, targetFormat) {
  const extractDir = path.join(outputDir, "extracted");
  await fs.mkdir(extractDir, { recursive: true });
  
  // 1. Extraer cualquier formato usando 7z
  await run(SEVEN_ZIP, ["x", inputPath, `-o${extractDir}`, "-y"]);

  // 2. Convertir al formato de destino solicitado
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

  // 3. Para 7Z, ZIP y otros formatos soportados por 7-Zip
  const outDir = path.dirname(outputPath);
  const outName = path.basename(outputPath);
  
  // Corregido: Usamos '*' para el contenido y pasamos el 'cwd' correctamente
  await run(SEVEN_ZIP, ["a", outName, path.join(extractDir, "*"), `-t${targetFormat.toLowerCase()}`], { 
    cwd: outDir 
  });
}

// ============================================
// Endpoint de ejemplo para procesar la conversión
// ============================================
app.post("/api/convert", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No se subió ningún archivo." });
    
    const targetFormat = normalizeFormat(req.body.targetFormat);
    if (!allowedFormats.has(targetFormat)) {
      return res.status(400).json({ message: "Formato no soportado." });
    }

    const uniqueId = crypto.randomBytes(8).toString("hex");
    const outputDir = path.join(workRoot, "outputs", uniqueId);
    await fs.mkdir(outputDir, { recursive: true });

    const inputPath = req.file.path;
    const outputName = `${path.parse(req.file.originalname).name}.${targetFormat.toLowerCase()}`;
    const outputPath = path.join(outputDir, outputName);

    // Ejecutar convertidor de archivos comprimidos
    await convertArchive(inputPath, outputPath, outputDir, targetFormat);

    // Enviar el archivo convertido al cliente
    res.download(outputPath, outputName, async (err) => {
      // Limpieza de archivos temporales del sistema
      await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
      await fs.rm(inputPath, { force: true }).catch(() => {});
    });

  } catch (error) {
    console.error("Conversion error:", error);
    res.status(500).json({ message: "Error al procesar el archivo comprimido." });
  }
});

// Inicializar el servidor Express
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor FileFox corriendo en http://localhost:${PORT}`);
});
