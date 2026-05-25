#!/bin/bash
set -e
git add .
git commit -m "Fix admin.tsx and stabilize agent behavior"
git push origin main
echo "✅ Push completado"
