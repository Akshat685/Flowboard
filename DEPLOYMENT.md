# Flowboard — Production Deployment Guide

## Prerequisites

- **Node.js** ≥ 22.12.0
- **MongoDB** 7.0+ (or MongoDB Atlas)
- A reverse proxy (nginx, Caddy, etc.) for TLS termination

---

## Quick Start / Bare Metal

```bash
# 1. Clone and install
git clone <repo-url> && cd flowboard
npm ci --ignore-scripts

# 2. Configure
cp server/.env.example server/.env
npm run setup   # Generates JWT_SECRET

# 3. Edit server/.env
#    - Set MONGODB_URI to your database
#    - Set CLIENT_ORIGIN to your production HTTPS URL
#    - Set TRUST_PROXY if behind a reverse proxy
#    - Set NODE_ENV=production

# 4. Build and start
npm run build
NODE_ENV=production npm start
```

### Process Manager (systemd)

```ini
# /etc/systemd/system/flowboard.service
[Unit]
Description=Flowboard API
After=network.target mongod.service

[Service]
Type=simple
User=flowboard
WorkingDirectory=/opt/flowboard
ExecStart=/usr/bin/node server/src/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | ✓ | `development` | `production` for deployed environments |
| `PORT` | | `4001` | HTTP port |
| `HOST` | | `127.0.0.1` | Bind address |
| `MONGODB_URI` | ✓ | — | MongoDB connection string |
| `CLIENT_ORIGIN` | ✓ | — | Frontend URL (**must be HTTPS in production**) |
| `JWT_SECRET` | ✓ | — | ≥48 character signing secret |
| `TRUST_PROXY` | | `""` | Proxy trust setting (e.g., `loopback`) |
| `SERVE_CLIENT` | | auto | `true` to serve client build from Express |

---

## Reverse Proxy (nginx)

```nginx
upstream flowboard {
    server 127.0.0.1:4001;
    keepalive 64;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers (Flowboard also sets these via Helmet)
    add_header Strict-Transport-Security "max-age=63072000" always;

    location / {
        proxy_pass http://flowboard;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-Id $request_id;
    }
}
```

Set `TRUST_PROXY=loopback` in your `.env` when using this setup.

---

## Monitoring

### Health Endpoints

| Endpoint | Purpose | Use For |
|----------|---------|---------|
| `GET /api/health` | Liveness probe | Kubernetes liveness, uptime monitors |
| `GET /api/ready` | Readiness probe | Kubernetes readiness, load balancer |

### Structured Logging

In production (`NODE_ENV=production`), all logs are JSON-formatted:

```json
{"timestamp":"2026-09-30T12:00:00.000Z","level":"info","message":"Flowboard API running","url":"http://localhost:4001","env":"production","pid":12345}
```

Each HTTP request is logged with a unique `X-Request-Id` for traceability.

---

## Security Checklist

- [ ] `NODE_ENV=production`
- [ ] `CLIENT_ORIGIN` uses HTTPS
- [ ] `JWT_SECRET` is ≥48 random characters (use `npm run setup`)
- [ ] `TRUST_PROXY` is set correctly (never `true`)
- [ ] MongoDB uses authentication
- [ ] TLS termination at reverse proxy
- [ ] `.env` is NOT committed to git
- [ ] Rate limiting is active (200 req/15min API, 30 req/15min auth)
- [ ] Database backups configured
- [ ] Monitoring alerts on `/api/ready` failures
