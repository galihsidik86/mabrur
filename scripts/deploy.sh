#!/usr/bin/env bash
#
# Deploy Mabrur ke server produksi (SSH). Jalankan DI SERVER dari root repo:
#
#   cd /srv/mabrur && bash scripts/deploy.sh
#
# Yang dilakukan: pull kode -> build panel admin -> rebuild server (dist bersih)
# -> migrasi DB -> restart HANYA mabrur-api (tidak menyentuh app lain di PM2).
# Opsi:
#   --no-pull     lewati git pull (deploy dari kode yang sudah ada)
#   --seed        buat/pui akun uji muthawwif+jamaah (minta password interaktif)
#   --pm2 NAMA    nama proses PM2 (default: mabrur-api)
#
set -euo pipefail

PM2_NAME="mabrur-api"
DO_PULL=1
DO_SEED=0
while [ $# -gt 0 ]; do
  case "$1" in
    --no-pull) DO_PULL=0 ;;
    --seed) DO_SEED=1 ;;
    --pm2) shift; PM2_NAME="${1:?--pm2 butuh nama}" ;;
    *) echo "Opsi tak dikenal: $1" >&2; exit 2 ;;
  esac
  shift
done

# root repo = folder induk dari scripts/ (berjalan apa pun cwd-nya)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
echo "== Deploy Mabrur dari: $ROOT =="

step() { echo; echo "-- $* --"; }

if [ "$DO_PULL" -eq 1 ]; then
  step "git pull origin master"
  if [ -n "$(git status --porcelain)" ]; then
    echo "PERINGATAN: ada perubahan lokal belum di-commit di server:" >&2
    git status --short >&2
    echo "Batalkan (Ctrl-C) lalu bereskan, atau jalankan ulang dengan --no-pull." >&2
    exit 1
  fi
  git pull origin master
fi
echo "HEAD: $(git log --oneline -1)"

step "Build panel admin (apps/admin)"
# --include=dev: tsc/vite adalah devDependencies; wajib meski NODE_ENV=production
( cd apps/admin && npm install --include=dev && npm run build )
test -f apps/admin/dist/index.html || { echo "GAGAL: apps/admin/dist/index.html tidak terbentuk" >&2; exit 1; }

step "Rebuild server (dist bersih)"
( cd server && npm install --include=dev && rm -rf dist && npx tsc )
# app.ts harus memuat penyajian /admin (mount sebelum route API)
if ! grep -q "'/admin'" server/dist/app.js; then
  echo "GAGAL: server/dist/app.js tidak memuat rute /admin — cek error tsc di atas." >&2
  exit 1
fi

step "Migrasi database"
( cd server && npm run db:migrate )

if [ "$DO_SEED" -eq 1 ]; then
  step "Akun uji muthawwif + jamaah"
  read -rs -p "Password muthawwif uji: " MUTHAWWIF_PASSWORD; echo
  read -rs -p "Password jamaah uji: " JAMAAH_PASSWORD; echo
  export MUTHAWWIF_PASSWORD JAMAAH_PASSWORD
  ( cd server && npm run seed-test-accounts )
  unset MUTHAWWIF_PASSWORD JAMAAH_PASSWORD
fi

step "Restart PM2: $PM2_NAME"
pm2 restart "$PM2_NAME" --update-env

echo
echo "== Selesai. Verifikasi: =="
echo "   curl -s -o /dev/null -w '%{http_code}\\n' https://mabrur.sosmartpro.com/admin/     # 200"
echo "   curl -s -o /dev/null -w '%{http_code}\\n' https://mabrur.sosmartpro.com/gps-traces  # 401"
echo "   pm2 logs $PM2_NAME --lines 20"
