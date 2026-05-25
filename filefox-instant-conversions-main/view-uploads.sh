#!/bin/bash
# ============================================
# Script para ver archivos subidos por usuarios
# ============================================

echo ""
echo "============================================"
echo "  ARCHIVOS ORIGINALES SUBIDOS"
echo "============================================"
echo ""

if [ -d "/var/filefox/uploads" ]; then
  TOTAL=$(ls -1 /var/filefox/uploads/ 2>/dev/null | wc -l)
  if [ "$TOTAL" -eq 0 ]; then
    echo "  📂 No hay archivos subidos todavía."
  else
    echo "  Total de archivos: $TOTAL"
    echo ""
    echo "  NOMBRE                                         TAMAÑO       FECHA"
    echo "  ---------------------------------------------  -----------  --------------------"
    ls -lh /var/filefox/uploads/ | tail -n +2 | awk '{printf "  %-45s %-11s %s %s %s\n", $9, $5, $6, $7, $8}'
  fi
else
  echo "  ❌ La carpeta /var/filefox/uploads/ no existe."
  echo "     Asegúrate de que el backend se haya ejecutado al menos una vez."
fi

echo ""
echo "============================================"
echo "  HISTORIAL DE CONVERSIONES (BD)"
echo "============================================"
echo ""

if [ -f "/tmp/filefox-data/filefox.db" ]; then
  echo "  ID  USUARIO            ARCHIVO ORIGINAL             FORMATOS          FECHA"
  echo "  --- ------------------ ---------------------------- ----------------- --------------------"
  sqlite3 -separator " | " /tmp/filefox-data/filefox.db \
    "SELECT id, user_email, original_name, source_format || ' → ' || target_format, created_at FROM conversions ORDER BY created_at DESC LIMIT 20;" 2>/dev/null | \
    while IFS='|' read -r id email name formats date; do
      printf "  %-3s %-18s %-28s %-17s %s\n" "$id" "$email" "$name" "$formats" "$date"
    done
else
  echo "  ❌ Base de datos no encontrada en /tmp/filefox-data/filefox.db"
fi

echo ""
echo "============================================"
echo "  ESTADÍSTICAS RÁPIDAS"
echo "============================================"
echo ""

if [ -f "/tmp/filefox-data/filefox.db" ]; then
  TOTAL_CONV=$(sqlite3 /tmp/filefox-data/filefox.db "SELECT COUNT(*) FROM conversions;")
  TOTAL_USERS=$(sqlite3 /tmp/filefox-data/filefox.db "SELECT COUNT(*) FROM users;")
  echo "  👥 Usuarios registrados: $TOTAL_USERS"
  echo "  🔄 Conversiones totales: $TOTAL_CONV"
fi

TOTAL_FILES=$(ls -1 /var/filefox/uploads/ 2>/dev/null | wc -l)
echo "  📁 Archivos en servidor: $TOTAL_FILES"

echo ""
echo "============================================"
echo "  Para ver un archivo específico:"
echo "    ls -la /var/filefox/uploads/"
echo ""
echo "  Para ver la BD completa de usuarios:"
echo "    sqlite3 /tmp/filefox-data/filefox.db 'SELECT * FROM users;'"
echo ""
echo "  Para ver todas las conversiones:"
echo "    sqlite3 /tmp/filefox-data/filefox.db 'SELECT * FROM conversions;'"
echo "============================================"
echo ""
