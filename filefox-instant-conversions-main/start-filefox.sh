#!/bin/bash
echo "============================================"
echo "  Iniciando Filefox..."
echo "============================================"

# Crear carpeta permanente para archivos subidos
sudo mkdir -p /var/filefox/uploads
sudo chmod 777 /var/filefox/uploads

# Establecer variable de entorno para CORS (cambia la IP por la de tu servidor)
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:8080}"

# Matar procesos anteriores si existen
pkill -f "node server.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

sleep 1

# Iniciar backend (puerto 4000)
cd "$(dirname "$0")/backend"
echo "  📦 Instalando dependencias del backend..."
npm install --silent 2>/dev/null
node server.js &
BACKEND_PID=$!
cd ..

# Esperar a que backend arranque
sleep 2

# Iniciar frontend (puerto 8080)
echo "  📦 Iniciando frontend..."
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

# Capturar CTRL+C y matar procesos
trap "echo ''; echo 'Deteniendo servicios...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; wait; echo '✅ Servicios detenidos.'; exit 0" SIGINT SIGTERM

wait
