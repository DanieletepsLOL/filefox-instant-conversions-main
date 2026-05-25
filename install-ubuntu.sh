#!/bin/bash
# ============================================
# Script de instalación para Ubuntu Server
# Filefox Backend + Frontend
# ============================================

set -e

echo "============================================"
echo "  Instalando Filefox en Ubuntu..."
echo "============================================"

# 1. Actualizar paquetes
echo "[1/7] Actualizando paquetes del sistema..."
sudo apt update

# 2. Instalar herramientas de conversión y compilación
echo "[2/7] Instalando herramientas de conversión..."
sudo apt install -y \
  p7zip-full p7zip-rar \
  ffmpeg \
  imagemagick \
  libreoffice-impressive \
  libreoffice-writer \
  libreoffice-calc \
  libreoffice-draw \
  sqlite3 \
  build-essential python3

# 3. Instalar Node.js (si no está instalado)
echo "[3/7] Instalando Node.js..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
else
  echo "  Node.js ya está instalado: $(node --version)"
fi

# 4. Crear carpeta permanente para uploads
echo "[4/7] Creando carpeta para archivos subidos..."
sudo mkdir -p /var/filefox/uploads
sudo chmod 777 /var/filefox/uploads
echo "  ✅ /var/filefox/uploads creada"

# 5. Instalar dependencias del backend
echo "[5/7] Instalando dependencias del backend..."
cd backend
npm install
cd ..

# 6. Instalar dependencias del frontend
echo "[6/7] Instalando dependencias del frontend..."
npm install

# 7. Crear script de inicio
echo "[7/7] Creando script de inicio..."
cat > start-filefox.sh << 'STARTEOF'
#!/bin/bash
echo "============================================"
echo "  Iniciando Filefox..."
echo "============================================"

# Crear carpeta permanente para archivos subidos
sudo mkdir -p /var/filefox/uploads
sudo chmod 777 /var/filefox/uploads

# Establecer variable de entorno para CORS
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:8080}"

# Matar procesos anteriores si existen
pkill -f "node server.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

sleep 1

# Iniciar backend (puerto 4000)
cd "$(dirname "$0")/backend"
node server.js &
BACKEND_PID=$!
cd ..

# Esperar a que backend arranque
sleep 2

# Iniciar frontend (puerto 8080)
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  ✅ Backend  corriendo en http://$(hostname -I | awk '{print $1}'):4000"
echo "  ✅ Frontend corriendo en http://$(hostname -I | awk '{print $1}'):8080"
echo ""
echo "  📋 Panel admin:"
echo "     http://$(hostname -I | awk '{print $1}'):4000/api/admin/stats"
echo "     http://$(hostname -I | awk '{print $1}'):4000/api/admin/conversions"
echo "     http://$(hostname -I | awk '{print $1}'):4000/api/admin/uploads"
echo "     http://$(hostname -I | awk '{print $1}'):4000/api/admin/activity"
echo ""
echo "  Presiona CTRL+C para detener ambos servicios"
echo "============================================"

trap "echo ''; echo 'Deteniendo servicios...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; wait; echo '✅ Servicios detenidos.'; exit 0" SIGINT SIGTERM

wait
STARTEOF

chmod +x start-filefox.sh

echo ""
echo "============================================"
echo "  ✅ Instalación completa!"
echo ""
echo "  Para iniciar Filefox ejecuta:"
echo "    ./start-filefox.sh"
echo ""
echo "  O manualmente:"
echo "    Backend:  cd backend && node server.js"
echo "    Frontend: npm run dev"
echo ""
echo "  Para ver archivos subidos:"
echo "    ./view-uploads.sh"
echo "============================================"
