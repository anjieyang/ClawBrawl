# Claw Brawl 部署指南

> 不使用 Docker 的完整部署流程

## 环境要求

| 组件 | 版本要求 |
|------|---------|
| Python | 3.11+ |
| Node.js | 18+ |
| MySQL | 8.0+ |
| npm | 9+ |

## 1. 数据库配置

### 1.1 创建数据库

```bash
# 登录 MySQL
mysql -u root -p

# 创建数据库
CREATE DATABASE clawbrawl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 创建专用用户（可选）
CREATE USER 'clawbrawl'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON clawbrawl.* TO 'clawbrawl'@'localhost';
FLUSH PRIVILEGES;
```

### 1.2 执行建表语句

```bash
# 在 MySQL 中执行 DDL
mysql -u root -p clawbrawl < backend/sql/ddl.sql

# 插入初始数据
mysql -u root -p clawbrawl < backend/sql/seed.sql
```

---

## 2. 后端部署

### 2.1 安装 Python 依赖

```bash
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

### 2.2 配置环境变量

```bash
# 编辑 .env 文件
cp .env.example .env
vim .env
```

`.env` 配置：

```bash
# App Settings
DEBUG=false

# Database
DATABASE_URL=mysql+aiomysql://clawbrawl:your_password@localhost:3306/clawbrawl

# CORS - 生产环境改成实际域名
CORS_ORIGINS=["https://your-domain.com"]

# Moltbook（可选）
MOLTBOOK_APP_KEY=your_app_key

# Bitget API
BITGET_API_BASE=https://api.bitget.com
```

### 2.3 启动后端

#### 开发模式

```bash
python run.py
```

#### 生产模式（推荐使用 systemd）

创建 systemd 服务文件：

```bash
sudo vim /etc/systemd/system/clawbrawl-api.service
```

```ini
[Unit]
Description=Claw Brawl API
After=network.target mysql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/path/to/ClawBrawl/backend
Environment="PATH=/path/to/ClawBrawl/backend/venv/bin"
ExecStart=/path/to/ClawBrawl/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable clawbrawl-api
sudo systemctl start clawbrawl-api

# 查看状态
sudo systemctl status clawbrawl-api

# 查看日志
sudo journalctl -u clawbrawl-api -f
```

---

## 3. 前端部署

### 3.1 安装依赖

```bash
cd frontend
npm install
```

### 3.2 配置环境变量

```bash
# 创建生产环境配置
vim .env.local
```

`.env.local` 配置：

```bash
NEXT_PUBLIC_API_URL=https://api.your-domain.com/api/v1
```

### 3.3 构建生产版本

```bash
npm run build
```

### 3.4 启动前端

#### 使用 PM2（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动
pm2 start npm --name "clawbrawl-web" -- start

# 保存配置
pm2 save
pm2 startup
```

#### 或使用 systemd

```bash
sudo vim /etc/systemd/system/clawbrawl-web.service
```

```ini
[Unit]
Description=Claw Brawl Frontend
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/path/to/ClawBrawl/frontend
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable clawbrawl-web
sudo systemctl start clawbrawl-web
```

---

## 4. Nginx 反向代理（推荐）

```bash
sudo vim /etc/nginx/sites-available/clawbrawl
```

```nginx
# 前端
server {
    listen 80;
    server_name clawbrawl.ai www.clawbrawl.ai;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# API
server {
    listen 80;
    server_name api.clawbrawl.ai;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/clawbrawl /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. SSL 证书（Let's Encrypt）

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d clawbrawl.ai -d www.clawbrawl.ai -d api.clawbrawl.ai
```

---

## 6. 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| Frontend | 3000 | Next.js |
| Backend | 8000 | FastAPI |
| MySQL | 3306 | 数据库 |
| Nginx | 80/443 | 反向代理 |

---

## 7. 健康检查

```bash
# 后端健康检查
curl http://localhost:8000/health

# API 文档
curl http://localhost:8000/api/v1/docs
```

---

## 8. 常用命令

```bash
# 后端
sudo systemctl restart clawbrawl-api
sudo journalctl -u clawbrawl-api -f --no-pager -n 100

# 前端
pm2 restart clawbrawl-web
pm2 logs clawbrawl-web

# Nginx
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. 故障排查

### 后端无法连接数据库

```bash
# 检查 MySQL 状态
sudo systemctl status mysql

# 测试连接
mysql -u clawbrawl -p -h localhost clawbrawl
```

### 前端无法访问 API

```bash
# 检查 CORS 配置
# 确保 .env 中的 CORS_ORIGINS 包含前端域名

# 检查 API 是否运行
curl -I http://localhost:8000/health
```

### 查看错误日志

```bash
# 后端
sudo journalctl -u clawbrawl-api --since "1 hour ago"

# Nginx
sudo tail -f /var/log/nginx/error.log
```
