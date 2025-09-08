// Real-time Dashboard Server for Performance Monitoring
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { PerformanceMonitor } from './performance-monitor';

export class DashboardServer {
  private monitor: PerformanceMonitor;
  private wss?: WebSocketServer;
  private clients: Set<any> = new Set();

  constructor() {
    this.monitor = new PerformanceMonitor();
    
    // Listen for metrics and alerts
    this.monitor.on('metrics', (metrics) => {
      this.broadcast('metrics', metrics);
    });

    this.monitor.on('alert', (alert) => {
      this.broadcast('alert', alert);
    });
  }

  async start(port: number = 3001): Promise<void> {
    const server = createServer((req, res) => {
      if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(this.generateDashboardHTML());
      } else if (req.url === '/api/metrics') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(this.monitor.exportMetrics('json'));
      } else if (req.url === '/api/dashboard') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(this.monitor.generateDashboard());
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    this.wss = new WebSocketServer({ server });
    
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      
      // Send initial dashboard data
      ws.send(JSON.stringify({
        type: 'dashboard',
        data: this.monitor.generateDashboard()
      }));

      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });

    // Update dashboard every 5 seconds
    setInterval(() => {
      this.broadcast('dashboard', this.monitor.generateDashboard());
    }, 5000);

    server.listen(port, () => {
      console.log(`🚀 Dashboard server running on http://localhost:${port}`);
      console.log(`📊 Real-time updates via WebSocket`);
    });
  }

  private broadcast(type: string, data: any): void {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });
    
    this.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  recordMetrics(agentId: string, metrics: any): void {
    this.monitor.recordMetrics(agentId, metrics);
  }

  private generateDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>AI Swarm Performance Dashboard</title>
    <style>
        body { 
            font-family: 'Courier New', monospace; 
            background: #1a1a1a; 
            color: #00ff00; 
            padding: 20px; 
            margin: 0;
        }
        .dashboard { 
            white-space: pre-wrap; 
            background: #000; 
            padding: 20px; 
            border-radius: 8px;
            border: 1px solid #333;
            margin-bottom: 20px;
        }
        .metrics { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 20px; 
        }
        .metric-card { 
            background: #1e1e1e; 
            padding: 15px; 
            border-radius: 8px; 
            border: 1px solid #333;
        }
        .metric-title { 
            color: #00ccff; 
            font-weight: bold; 
            margin-bottom: 10px; 
        }
        .alert { 
            background: #330000; 
            border: 1px solid #ff0000; 
            color: #ff6666; 
            padding: 10px; 
            margin: 5px 0; 
            border-radius: 4px; 
        }
        .status-online { color: #00ff00; }
        .status-warning { color: #ffaa00; }
        .status-error { color: #ff0000; }
        button { 
            background: #333; 
            border: 1px solid #666; 
            color: #fff; 
            padding: 8px 16px; 
            cursor: pointer; 
            margin: 5px; 
        }
        button:hover { background: #555; }
    </style>
</head>
<body>
    <h1>🤖 AI Swarm Performance Dashboard</h1>
    
    <div class="dashboard" id="dashboard">
        Loading dashboard...
    </div>

    <div class="metrics">
        <div class="metric-card">
            <div class="metric-title">📊 Real-time Metrics</div>
            <div id="live-metrics">Connecting...</div>
        </div>
        
        <div class="metric-card">
            <div class="metric-title">⚠️ Active Alerts</div>
            <div id="alerts">No alerts</div>
        </div>
    </div>

    <div>
        <button onclick="exportMetrics('json')">Export JSON</button>
        <button onclick="exportMetrics('csv')">Export CSV</button>
        <button onclick="clearAlerts()">Clear Alerts</button>
    </div>

    <script>
        const ws = new WebSocket(\`ws://\${window.location.host}\`);
        
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            
            if (message.type === 'dashboard') {
                document.getElementById('dashboard').textContent = message.data;
            } else if (message.type === 'metrics') {
                updateLiveMetrics(message.data);
            } else if (message.type === 'alert') {
                addAlert(message.data);
            }
        };
        
        function updateLiveMetrics(metrics) {
            const element = document.getElementById('live-metrics');
            element.innerHTML = \`
                <div>Agent: \${metrics.agentId}</div>
                <div>Context: \${(metrics.contextUsage * 100).toFixed(1)}%</div>
                <div>Response: \${(metrics.responseTime / 1000).toFixed(1)}s</div>
                <div>Efficiency: \${(metrics.tokenEfficiency * 100).toFixed(1)}%</div>
                <div>Time: \${new Date(metrics.timestamp).toLocaleTimeString()}</div>
            \`;
        }
        
        function addAlert(alert) {
            const alertsElement = document.getElementById('alerts');
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert';
            alertDiv.innerHTML = \`
                <strong>\${alert.severity.toUpperCase()}</strong>: \${alert.message}
                <br><small>\${new Date().toLocaleTimeString()}</small>
            \`;
            alertsElement.insertBefore(alertDiv, alertsElement.firstChild);
            
            // Keep only last 10 alerts
            while (alertsElement.children.length > 10) {
                alertsElement.removeChild(alertsElement.lastChild);
            }
        }
        
        function exportMetrics(format) {
            window.open(\`/api/metrics?format=\${format}\`);
        }
        
        function clearAlerts() {
            document.getElementById('alerts').innerHTML = 'No alerts';
        }
        
        ws.onopen = () => {
            console.log('Connected to dashboard');
        };
        
        ws.onclose = () => {
            console.log('Disconnected from dashboard');
            setTimeout(() => location.reload(), 5000);
        };
    </script>
</body>
</html>
    `;
  }
}

// CLI to start dashboard server
if (require.main === module) {
  const server = new DashboardServer();
  const port = parseInt(process.argv[2] || '3001');
  server.start(port);
}