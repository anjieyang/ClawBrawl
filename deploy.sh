#!/bin/bash

# ===========================================
# Claw Brawl 部署脚本
# ===========================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="/root/logs"

# 确保日志目录存在
mkdir -p "$LOG_DIR"

# 打印带颜色的消息
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 分隔线
print_separator() {
    echo "==========================================="
}

# ===========================================
# 1. Git Pull
# ===========================================
print_separator
print_status "Step 1/4: Pulling latest code..."

cd "$PROJECT_ROOT"
git pull

print_success "Code updated successfully"

# ===========================================
# 2. 停止现有服务
# ===========================================
print_separator
print_status "Step 2/4: Stopping existing services..."

# 停止后端
if pkill -f "uvicorn app.main:app" 2>/dev/null; then
    print_success "Backend stopped"
else
    print_warning "No backend process found"
fi

# 停止前端
if pkill -f "next-server" 2>/dev/null; then
    print_success "Frontend stopped"
else
    print_warning "No frontend process found"
fi

sleep 2

# ===========================================
# 3. 启动后端
# ===========================================
print_separator
print_status "Step 3/4: Starting backend..."

cd "$PROJECT_ROOT/backend"

# 激活 conda 环境并启动后端
source /root/miniconda3/etc/profile.d/conda.sh
conda activate claw

nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

sleep 2

# 验证后端启动
if ps -p $BACKEND_PID > /dev/null 2>&1; then
    print_success "Backend started (PID: $BACKEND_PID)"
    print_status "Backend log: $LOG_DIR/backend.log"
else
    print_error "Backend failed to start! Check $LOG_DIR/backend.log"
    exit 1
fi

# ===========================================
# 4. 检查 Skill 文件软链接
# ===========================================
print_separator
print_status "Step 4/5: Checking skill file symlinks..."

cd "$PROJECT_ROOT/frontend/public"

# 确保 symlink 存在（如果不存在则创建）
if [ ! -L skill.md ]; then
    ln -sf ../../skill/SKILL.md skill.md
    print_status "Created symlink: skill.md -> ../../skill/SKILL.md"
fi
if [ ! -L heartbeat.md ]; then
    ln -sf ../../skill/HEARTBEAT.md heartbeat.md
    print_status "Created symlink: heartbeat.md -> ../../skill/HEARTBEAT.md"
fi
if [ ! -L skill.json ]; then
    ln -sf ../../skill/package.json skill.json
    print_status "Created symlink: skill.json -> ../../skill/package.json"
fi
if [ ! -L strategies.md ]; then
    ln -sf ../../skill/STRATEGIES.md strategies.md
    print_status "Created symlink: strategies.md -> ../../skill/STRATEGIES.md"
fi

print_success "Skill symlinks verified"

# ===========================================
# 5. 构建并启动前端
# ===========================================
print_separator
print_status "Step 5/5: Building and starting frontend..."

cd "$PROJECT_ROOT/frontend"

print_status "Running npm run build..."
npm run build

print_status "Starting frontend server..."
nohup npm run start > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

sleep 3

# 验证前端启动
if pgrep -f "next-server" > /dev/null 2>&1; then
    ACTUAL_PID=$(pgrep -f "next-server")
    print_success "Frontend started (PID: $ACTUAL_PID)"
    print_status "Frontend log: $LOG_DIR/frontend.log"
else
    print_error "Frontend failed to start! Check $LOG_DIR/frontend.log"
    exit 1
fi

# ===========================================
# 部署完成
# ===========================================
print_separator
echo ""
print_success "🦀 Deployment completed successfully!"
echo ""
echo "Services running:"
echo "  - Backend:  http://0.0.0.0:8000"
echo "  - Frontend: http://0.0.0.0:3000"
echo ""
echo "Logs:"
echo "  - Backend:  $LOG_DIR/backend.log"
echo "  - Frontend: $LOG_DIR/frontend.log"
echo ""
echo "Monitor logs:"
echo "  tail -f $LOG_DIR/backend.log"
echo "  tail -f $LOG_DIR/frontend.log"
print_separator
