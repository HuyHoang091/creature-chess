import express from "express";
import { createServer } from "http";
import * as WebSocket from "ws";
import path from "path";

/**
 * Simple monitoring dashboard for RL Bot training
 * Provides real-time metrics via WebSocket and REST API
 */
export class DashboardServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocket.Server;
  private port: number;
  private metrics: any[] = [];

  constructor(port: number = 3002) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });

    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupRoutes(): void {
    // Static files for dashboard UI
    this.app.use(express.static(path.join(__dirname, "../../dashboard")));

    // API endpoints
    this.app.get("/api/metrics", (req, res) => {
      res.json(this.metrics.slice(-100)); // Last 100 metrics
    });

    this.app.get("/api/latest", (req, res) => {
      res.json(this.metrics[this.metrics.length - 1] || null);
    });

    this.app.get("/api/stats", (req, res) => {
      if (this.metrics.length === 0) {
        res.json({});
        return;
      }

      const rewards = this.metrics.map(m => m.avgReward || 0);
      const winRates = this.metrics.map(m => m.winRate || 0);

      res.json({
        episodes: this.metrics.length,
        avgReward: rewards.reduce((a, b) => a + b, 0) / rewards.length,
        bestReward: Math.max(...rewards),
        avgWinRate: winRates.reduce((a, b) => a + b, 0) / winRates.length,
        latest: this.metrics[this.metrics.length - 1]
      });
    });

    // Health check
    this.app.get("/health", (req, res) => {
      res.json({ status: "ok", metrics: this.metrics.length });
    });
  }

  private setupWebSocket(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      console.log("Dashboard client connected");

      // Send current metrics to new client
      if (this.metrics.length > 0) {
        ws.send(JSON.stringify({
          type: "history",
          data: this.metrics.slice(-50)
        }));
      }

      ws.on("close", () => {
        console.log("Dashboard client disconnected");
      });
    });
  }

  /**
   * Log training metrics and broadcast to connected clients
   */
  logMetrics(metrics: any): void {
    const entry = {
      timestamp: new Date().toISOString(),
      ...metrics
    };

    this.metrics.push(entry);

    // Broadcast to all connected WebSocket clients
    this.wss.clients.forEach((client: any) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify({
          type: "metrics",
          data: entry
        }));
      }
    });

    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  /**
   * Start the dashboard server
   */
  start(): void {
    this.server.listen(this.port, () => {
      console.log(`RL Bot Dashboard running on http://localhost:${this.port}`);
      console.log(`WebSocket available on ws://localhost:${this.port}`);
      console.log(`API endpoints:`);
      console.log(`  - GET /api/metrics (last 100 metrics)`);
      console.log(`  - GET /api/latest (latest metric)`);
      console.log(`  - GET /api/stats (training statistics)`);
    });
  }

  /**
   * Stop the dashboard server
   */
  stop(): void {
    this.wss.close();
    this.server.close();
  }
}

// CLI usage
if (require.main === module) {
  const port = parseInt(process.env.MONITORING_PORT || "3002");
  const dashboard = new DashboardServer(port);
  dashboard.start();

  // Example: Simulate logging metrics
  setInterval(() => {
    dashboard.logMetrics({
      episode: Math.floor(Math.random() * 100),
      avgReward: Math.random() * 2 - 1,
      winRate: Math.random(),
      loss: Math.random() * 0.1
    });
  }, 5000);
}
