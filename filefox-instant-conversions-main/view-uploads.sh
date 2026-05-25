#!/bin/bash
# ============================================
# Script para ver archivos subidos por usuarios
# ============================================

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              FILEFOX - PANEL DE ADMINISTRACIÓN              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ============================================
# ESTADÍSTICAS
# ============================================
echo "📊 ESTADÍSTICAS"
echo "──────────────"

if [ -f "/tmp/filefox-data/filefox.db" ]; then
  TOTAL_USERS=$(sqlite3 /tmp/filefox-data/filefox.db "SELECT COUNT(*) FROM users;")
  TODAY_USERS=$(sqlite3 /tmp/filefox-data/filefox.db "SELECT COUNT(*) FROM users WHERE date(created_at) = date('now');")
  TOTAL_CONV=$(sqlite3 /tmp/filefox-data/filefox.db "SELECT COUNT(*) FROM conversions;")
  TODAY_CONV=$(sqlite3 /tmp/filefox-data/filefox.db "SELECT COUNT(*) FROM conversions WHERE date(created_at) = date('now');")
  ACTIVITY_TODAY=$(sqlite3 /tmp/filefox-data/filefox.db "SELECT COUNT(*) FROM activity_logs WHERE date(created_at) = date('now');")
  
  echo "  👥 Usuarios totales:     $TOTAL_USERS (hoy: $TODAY_USERS nuevos)"
  echo "  🔄 Conversiones totales: $TOTAL_CONV (hoy: $TODAY_CONV)"
  echo "  📋 Actividad hoy:        $ACTIVITY_TODAY eventos"
fi

TOTAL_FILES=$(ls -1 /var/filefox/uploads/ 2>/dev/null | wc -l)
echo "  📁 Archivos en servidor: $TOTAL_FILES"

# Calcular espacio usado
if [ -d "/var/filefox/uploads" ]; then
  TOTAL_SIZE=$(du -sh /var/filefox/uploads/ 2>/dev/null | awk '{print $1}')
  echo "  💾 Espacio usado:       $TOTAL_SIZE"
fi

echo ""

# ============================================
# ARCHIVOS SUBIDOS
# ============================================
echo "📁 ARCHIVOS ORIGINALES SUBIDOS"
echo "─────────────────────────────"

if [ -d "/var/filefox/uploads" ]; then
  if [ "$TOTAL_FILES" -eq 0 ]; then
    echo "  (vacío) No hay archivos subidos todavía."
  else
    echo ""
    printf "  %-50s %-10s %s\n" "NOMBRE" "TAMAÑO" "FECHA"
    printf "  %-50s %-10s %s\n" "──────────────────────────────────────────────────" "──────────" "──────────────────"
    ls -lh /var/filefox/uploads/ | tail -n +2 | awk '{printf "  %-50s %-10s %s %s %s\n", $9, $5, $6, $7, $8}'
  fi
else
  echo "  ❌ La carpeta /var/filefox/uploads/ no existe."
  echo "     Ejecuta: sudo mkdir -p /var/filefox/uploads && sudo chmod 777 /var/filefox/uploads"
fi

echo ""

# ============================================
# USUARIOS REGISTRADOS
# ============================================
echo "👥 USUARIOS REGISTRADOS"
echo "─────────────────────"

if [ -f "/tmp/filefox-data/filefox.db" ]; then
  USER_COUNT=$(sqlite3 /tmp/filefox-data/filefox.db "SELECT COUNT(*) FROM users;")
  if [ "$USER_COUNT" -eq 0 ]; then
    echo "  (vacío) No hay usuarios registrados."
  else
    echo ""
    printf "  %-4s %-20s %-30s %-15s %s\n" "ID" "NOMBRE" "EMAIL" "CONVERSIONES" "REGISTRO"
    printf "  %-4s %-20s %-30s %-15s %s\n" "────" "────────────────────" "──────────────────────────────" "───────────────" "──────────────────"
    sqlite3 -separator "|" /tmp/filefox-data/filefox.db \
      "SELECT id, name, email, total_conversions, created_at FROM users ORDER BY created_at DESC;" 2>/dev/null | \
      while IFS='|' read -r id name email conversions date; do
        printf "  %-4s %-20s %-30s %-15s %s\n" "$id" "$name" "$email" "$conversions" "$date"
      done
  fi
fi

echo ""

# ============================================
# HISTORIAL DE CONVERSIONES
# ============================================
echo "🔄 HISTORIAL DE CONVERSIONES (últimas 20)"
echo "─────────────────────────────────────────"

if [ -f "/tmp/filefox-data/filefox.db" ]; then
  CONV_COUNT=$(sqlite3 /tmp/filefox-data/filefox.db "SELECT COUNT(*) FROM conversions;")
  if [ "$CONV_COUNT" -eq 0 ]; then
    echo "  (vacío) No hay conversiones registradas."
  else
    echo ""
    printf "  %-4s %-22s %-30s %-15s %s\n" "ID" "USUARIO" "ARCHIVO" "FORMATO" "FECHA"
    printf "  %-4s %-22s %-30s %-15s %s\n" "────" "──────────────────────" "──────────────────────────────" "───────────────" "──────────────────"
    sqlite3 -separator "|" /tmp/filefox-data/filefox.db \
      "SELECT id, user_email, original_name, source_format || ' → ' || target_format, created_at FROM conversions ORDER BY created_at DESC LIMIT 20;" 2>/dev/null | \
      while IFS='|' read -r id email name formats date; do
        printf "  %-4s %-22s %-30s %-15s %s\n" "$id" "$email" "$name" "$formats" "$date"
      done
  fi
fi

echo ""

# ============================================
# ACTIVIDAD RECIENTE
# ============================================
echo "📋 ACTIVIDAD RECIENTE (últimas 10 acciones)"
echo "───────────────────────────────────────────"

if [ -f "/tmp/filefox-data/filefox.db" ]; then
  ACT_COUNT=$(sqlite3 /tmp/filefox-data/filefox.db "SELECT COUNT(*) FROM activity_logs;")
  if [ "$ACT_COUNT" -eq 0 ]; then
    echo "  (vacío) No hay actividad registrada todavía."
  else
    echo ""
    printf "  %-4s %-22s %-15s %-25s %s\n" "ID" "USUARIO" "ACCIÓN" "DETALLE" "FECHA"
    printf "  %-4s %-22s %-15s %-25s %s\n" "────" "──────────────────────" "───────────────" "─────────────────────────" "──────────────────"
    sqlite3 -separator "|" /tmp/filefox-data/filefox.db \
      "SELECT id, user_email, action, details, created_at FROM activity_logs ORDER BY created_at DESC LIMIT 10;" 2>/dev/null | \
      while IFS='|' read -r id email action details date; do
        printf "  %-4s %-22s %-15s %-25s %s\n" "$id" "$email" "$action" "$details" "$date"
      done
  fi
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Para más detalles:                                        ║"
echo "║  • Ver BD completa:  sqlite3 /tmp/filefox-data/filefox.db  ║"
echo "║  • Ver archivos:     ls -la /var/filefox/uploads/          ║"
echo "║  • API admin:        curl http://localhost:4000/api/admin/ ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
