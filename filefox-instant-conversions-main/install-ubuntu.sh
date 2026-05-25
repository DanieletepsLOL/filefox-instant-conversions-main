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
echo "[1/6] Actualizando paquetes del sistema..."
sudo apt update

# 2. Instalar herramientas de conversión y compilación
echo "[2/6] Instalando herramientas de conversión..."
sudo apt install -y \
  p7zip-full p7zip-rar \
  ffmpeg \
  imagemagick \
  libreoffice-impressive \
  libreoffice-writer \
  libreoffice-calc \
  libreoffice-draw \
  build-essential python3

# 3. Instalar Node.js (si no está instalado)
echo "[3/6] Instalando Node.js..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
else
  echo "  Node.js ya está instalado: $(node --version)"
fi

# 4. Instalar dependencias del backend
echo "[4/6] Instalando dependencias del backend..."
cd backend
npm install
cd ..

# 5. Instalar dependencias del frontend
echo "[5/6] Instalando dependencias del frontend..."
npm install

# 6. Crear script de inicio
echo "[6/6] Creando script de inicio..."
cat > start-filefox.sh << 'STARTEOF'
#!/bin/bash
echo "============================================"
echo "  Iniciando Filefox..."
echo "============================================"

# Matar procesos anteriores si existen
pkill -f "node server.js" 2>/dev/null || true
pkill -f "vite dev" 2>/dev/null || true

sleep 1

# Iniciar backend (puerto 4000)
cd backend
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
echo "  Presiona CTRL+C para detener ambos servicios"
echo "============================================"

# Capturar CTRL+C y matar procesos
trap "echo 'Deteniendo servicios...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM

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
echo "============================================"
