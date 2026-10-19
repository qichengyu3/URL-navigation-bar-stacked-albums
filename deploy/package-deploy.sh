#!/usr/bin/env bash
# ============================================================
# 一键打部署包：前端 dist + 后端源码 + 数据库 + uploads + COS 密钥
# 用法：
#   bash deploy/package-deploy.sh            # 先构建前端再打包
#   bash deploy/package-deploy.sh --no-build # 跳过构建（dist 已是最新时）
# 产物：
#   deploy/tab-deploy-YYYYMMDD-HHMM.tar.gz
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY="$ROOT/deploy"
STAMP="$(date +%Y%m%d-%H%M)"
OUT="$DEPLOY/tab-deploy-$STAMP.tar.gz"
STAGE="$DEPLOY/.stage"

echo "==> 项目根目录: $ROOT"

# ---------- 1. 构建前端 ----------
if [[ "${1:-}" != "--no-build" ]]; then
  echo "==> 构建前端 (vite build)"
  ( cd "$ROOT/client" && npm run build )
else
  echo "==> 跳过前端构建"
fi

if [[ ! -f "$ROOT/client/dist/index.html" ]]; then
  echo "!! client/dist/index.html 不存在，请先构建前端" >&2
  exit 1
fi

# ---------- 2. 准备临时目录 ----------
rm -rf "$STAGE"
mkdir -p "$STAGE/client-dist" "$STAGE/server"

# ---------- 3. 前端产物 ----------
cp -r "$ROOT/client/dist/." "$STAGE/client-dist/"

# ---------- 4. 后端源码 ----------
# 排除：依赖（Linux 上重装）、.env（含本地密钥，不要带到服务器）、
#       历史备份库、日志、临时文件
tar -C "$ROOT/server" -cf - \
  --exclude='./node_modules' \
  --exclude='./.env' \
  --exclude='./*.log' \
  --exclude='./logs' \
  --exclude='./prisma/*.db.bak-*' \
  --exclude='./prisma/dev.db-journal' \
  --exclude='./prisma/*.rar' \
  --exclude='./scripts/_*' \
  . | tar -C "$STAGE/server" -xf -

# ---------- 5. 附带配置文件与文档 ----------
cp "$DEPLOY/env.production.example" "$STAGE/server/.env.production.example"
cp "$DEPLOY/nginx.conf.example"     "$STAGE/nginx.conf.example"
[[ -f "$ROOT/docs/DEPLOY.md" ]] && cp "$ROOT/docs/DEPLOY.md" "$STAGE/DEPLOY.md"

# ---------- 6. 自检 ----------
fail=0
[[ -f "$STAGE/server/data/.cos-secret" ]] || { echo "!! 缺少 server/data/.cos-secret（COS 密钥将无法解密）" >&2; fail=1; }
[[ -f "$STAGE/server/prisma/dev.db"    ]] || { echo "!! 缺少 server/prisma/dev.db（数据库未打包）"     >&2; fail=1; }
[[ -d "$STAGE/server/uploads"          ]] || { echo "!! 缺少 server/uploads（图标目录）"               >&2; fail=1; }
[[ -d "$STAGE/server/node_modules"     ]] && { echo "!! node_modules 被打进包里了（不应包含）"         >&2; fail=1; }
[[ $fail -eq 0 ]] || { echo "打包中止" >&2; exit 1; }

# ---------- 7. 压缩 ----------
tar -C "$STAGE" -czf "$OUT" .
SIZE="$(du -h "$OUT" | cut -f1)"
rm -rf "$STAGE"

echo ""
echo "==> 打包完成: $OUT  ($SIZE)"
echo "--- 包内顶层结构 ---"
tar -tzf "$OUT" | awk -F/ 'NF<=2 && $0!="./"' | sort -u | head -30
echo ""
echo "上传到宝塔 /www/wwwroot/ 解压即可，后续步骤见「docs/DEPLOY.md」"
