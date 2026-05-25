#!/bin/bash
echo "============================================"
echo "  Iniciando Filefox..."
echo "============================================"

# Crear carpeta permanente para archivos subidos
sudo mkdir -p /var/filefox/uploads
sudo chmod 777 /var/filefox/uploads

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
