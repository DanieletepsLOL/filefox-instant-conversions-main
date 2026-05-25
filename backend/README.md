# Filefox Backend

Backend de ejemplo para convertir archivos en Ubuntu Server.

## Instalar herramientas en Ubuntu

```bash
sudo apt update
sudo apt install -y ffmpeg imagemagick libreoffice p7zip-full tar
```

Para RAW profesionales puedes añadir:

```bash
sudo apt install -y libraw-bin darktable
```

## Instalar dependencias Node

```bash
cd backend
npm install
npm run dev
```

El frontend manda los archivos a:

```txt
POST /api/conversions
```

En desarrollo, `vite.config.ts` redirige `/api` a `http://localhost:4000`.

## Cómo funciona

1. El frontend sube el archivo con `FormData`.
2. El backend lo guarda temporalmente en `backend/tmp/uploads`.
3. Según `sourceKind` y `targetFormat`, ejecuta una herramienta de Linux:
   - Imagen: `magick input output`
   - Video/audio: `ffmpeg -i input output`
   - Documento/texto: `libreoffice --headless --convert-to`
   - Comprimidos: `7z` para extraer y volver a comprimir
4. Devuelve el archivo convertido como descarga.
5. Borra los temporales.

En producción conviene añadir cola de trabajos, límites por usuario, antivirus, logs y almacenamiento temporal aislado.
