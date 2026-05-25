#!/bin/bash
# ============================================
# Generador de Token de Administrador para Filefox
# ============================================
# Uso: sudo bash generate-admin-token.sh [descripción]
# Ejemplo: sudo bash generate-admin-token.sh "Token para desarrollo"
# ============================================

DB_PATH="/tmp/filefox-data/filefox.db"
DESCRIPTION="${1:-Token generado el $(date '+%Y-%m-%d %H:%M:%S')}"

# Verificar que la base de datos existe
if [ ! -f "$DB_PATH" ]; then
  echo "❌ No se encontró la base de datos en $DB_PATH"
  echo "   Asegúrate de que el backend de Filefox se haya ejecutado al menos una vez."
  exit 1
fi

# Verificar que sqlite3 está disponible
if ! command -v sqlite3 &> /dev/null; then
  echo "❌ sqlite3 no está instalado. Instálalo con: sudo apt install sqlite3 -y"
  exit 1
fi

# Generar token criptográficamente seguro (64 caracteres hex)
TOKEN=$(openssl rand -hex 32)

# Insertar en la base de datos
sqlite3 "$DB_PATH" <<EOF
INSERT INTO admin_tokens (token, description, active) VALUES ('$TOKEN', '$DESCRIPTION', 1);
EOF

if [ $? -eq 0 ]; then
  echo ""
  echo "============================================"
  echo "  ✅ Token de Administrador generado"
  echo "============================================"
  echo ""
  echo "  Token: $TOKEN"
  echo "  Descripción: $DESCRIPTION"
  echo ""
  echo "============================================"
  echo ""
  echo "  Para iniciar sesión como admin:"
  echo "  1. Ve a http://localhost:8080/admin/login"
  echo "  2. Correo: admin@filefoxadmins.com"
  echo "  3. Token: (pega el token de arriba)"
  echo ""
  echo "  Guarda este token en un lugar seguro."
  echo "  No se podrá recuperar si lo pierdes."
  echo "============================================"
else
  echo "❌ Error al insertar el token en la base de datos."
  exit 1
fi
