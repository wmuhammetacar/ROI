import { Controller, Get, Header, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './database/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @SkipThrottle()
  getApiRoot() {
    return {
      name: 'ROI Backend API',
      subtitle: 'CROISSANT - DESSERT - COFFEE',
      version: 'v1',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  @SkipThrottle()
  getHealth() {
    return {
      status: 'up',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @SkipThrottle()
  async getReadiness() {
    const timeoutMs = this.configService.get<number>('READINESS_DB_TIMEOUT_MS', 2500);
    const startedAt = Date.now();

    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database readiness timeout')), timeoutMs)),
      ]);

      return {
        status: 'ready',
        dependencies: {
          database: 'up',
        },
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        message: 'Service is not ready',
        details: {
          database: 'down',
        },
      });
    }
  }

  @Get('ui')
  @SkipThrottle()
  @Header('Content-Type', 'text/html; charset=utf-8')
  getUi(): string {
    if (this.configService.get<string>('NODE_ENV', 'development') === 'production') {
      throw new NotFoundException('Not found');
    }

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>ROI Live API Panel</title>
  <style>
    :root {
      --bg: #0f172a;
      --card: #111827;
      --muted: #94a3b8;
      --text: #e5e7eb;
      --accent: #f59e0b;
      --ok: #22c55e;
      --border: #1f2937;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, sans-serif;
      background: radial-gradient(circle at 10% 10%, #1f2937 0, var(--bg) 45%);
      color: var(--text);
      min-height: 100vh;
    }
    .wrap {
      max-width: 980px;
      margin: 24px auto;
      padding: 0 16px 24px;
    }
    .title {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 6px;
    }
    .subtitle {
      color: var(--muted);
      margin: 0 0 20px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
      gap: 14px;
    }
    .card {
      background: rgba(17, 24, 39, 0.92);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 14px;
    }
    .card h3 {
      margin: 0 0 10px;
      font-size: 16px;
    }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    button, input {
      border-radius: 10px;
      border: 1px solid #334155;
      background: #0b1220;
      color: var(--text);
      padding: 9px 10px;
      font-size: 14px;
    }
    input { width: 100%; margin-bottom: 8px; }
    button {
      cursor: pointer;
      background: linear-gradient(90deg, #d97706, var(--accent));
      border: none;
      color: #111827;
      font-weight: 700;
    }
    .muted { color: var(--muted); font-size: 13px; }
    pre {
      margin: 10px 0 0;
      padding: 10px;
      border-radius: 10px;
      background: #020617;
      border: 1px solid #1e293b;
      overflow: auto;
      font-size: 12px;
      max-height: 250px;
    }
    a { color: #fbbf24; text-decoration: none; }
    .badge {
      display: inline-block;
      background: #064e3b;
      color: #d1fae5;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 12px;
      margin-left: 8px;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1 class="title">ROI Live API Panel <span class="badge">online</span></h1>
    <p class="subtitle">CROISSANT - DESSERT - COFFEE</p>

    <div class="grid">
      <section class="card">
        <h3>Service Health</h3>
        <p class="muted">Checks backend runtime status.</p>
        <div class="row">
          <button id="healthBtn">Run Health Check</button>
        </div>
        <pre id="healthOut">No request yet.</pre>
      </section>

      <section class="card">
        <h3>Auth Login Test</h3>
        <p class="muted">Use a seeded or created account.</p>
        <input id="email" type="email" placeholder="email" />
        <input id="password" type="password" placeholder="password" />
        <div class="row">
          <button id="loginBtn">Login</button>
        </div>
        <pre id="loginOut">No request yet.</pre>
      </section>

      <section class="card">
        <h3>Quick Links</h3>
        <p class="muted">Open endpoints directly.</p>
        <div class="row">
          <a href="/api/v1" target="_blank">GET /api/v1</a>
        </div>
        <div class="row">
          <a href="/api/v1/health" target="_blank">GET /api/v1/health</a>
        </div>
        <div class="row">
          <a href="/api/v1/ready" target="_blank">GET /api/v1/ready</a>
        </div>
        <div class="row">
          <a href="/api/v1/catalog/pos-products" target="_blank">GET /api/v1/catalog/pos-products</a>
        </div>
      </section>
    </div>
  </div>

  <script>
    const out = (id, data) => {
      const el = document.getElementById(id);
      el.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    };

    document.getElementById("healthBtn").addEventListener("click", async () => {
      try {
        const res = await fetch("/api/v1/health");
        const data = await res.json();
        out("healthOut", { statusCode: res.status, data });
      } catch (error) {
        out("healthOut", String(error));
      }
    });

    document.getElementById("loginBtn").addEventListener("click", async () => {
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      try {
        const res = await fetch("/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        out("loginOut", { statusCode: res.status, data });
      } catch (error) {
        out("loginOut", String(error));
      }
    });
  </script>
</body>
</html>`;
  }
}
