#!/bin/bash
# ============================================
# Listar Tokens de Administrador
# ============================================
# Uso: sudo bash list-admin-tokens.sh
# ============================================

DB_PATH="/tmp/filefox-data/filefox.db"

if [ ! -f "$DB_PATH" ]; then
  echo "❌ No se encontró la base de datos en $DB_PATH"
  exit 1
fi

if ! command -v sqlite3 &> /dev/null; then
  echo "❌ sqlite3 no está instalado."
  exit 1
fi

echo ""
echo "============================================"
echo "  Tokens de Administrador"
echo "============================================"
echo ""

sqlite3 -header -column "$DB_PATH" "
SELECT id, substr(token, 1, 20) || '...' as token_preview,
       description, CASE WHEN active THEN '✅ Activo' ELSE '❌ Inactivo' END as estado,
       created_at
FROM admin_tokens
ORDER BY created_at DESC;
"

echo ""
echo "============================================"
echo "  Para desactivar un token:"
echo "  sqlite3 $DB_PATH \"UPDATE admin_tokens SET active = 0 WHERE id = X;\""
echo ""
echo "  Para generar un nuevo token:"
echo "  sudo bash backend/generate-admin-token.sh"
echo "============================================"
