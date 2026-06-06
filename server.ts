import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { initDb, createApiRouter } from "./api.js";
import { startUptimeMonitor, startExpirationMonitor } from "./monitor.js";
import { closeSshSession, connectSshSession, type ConnectedSshSession } from "./ssh.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const httpServer = createServer(app);
  
  console.log("Starting server initialization...");
  let db;
  try {
    console.log("Initializing database...");
    db = await initDb();
    console.log("Database initialized successfully.");
    
    // Start uptime monitor background process
    startUptimeMonitor(db);
    // Start expiration monitor background process
    startExpirationMonitor(db);
  } catch (err) {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  }
  
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.use(express.json({ limit: '500mb' }));
  app.use(express.urlencoded({ extended: true, limit: '500mb' }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  
  app.use("/api", createApiRouter(db));

  io.on("connection", (socket) => {
    let sshConnection: ConnectedSshSession | null = null;
    let sshStream: any = null;

    socket.on("ssh-connect", async (config) => {
      if (sshConnection) {
        closeSshSession(sshConnection);
      }
      sshConnection = null;

      try {
        sshConnection = await connectSshSession(config);
        const sshClient = sshConnection.client;
        socket.emit("ssh-status", { status: "connected", message: "SSH connection established." });
        
        const shellOptions: any = {
          term: 'xterm-256color',
          cols: config.terminalSize?.cols || 80,
          rows: config.terminalSize?.rows || 24
        };

        sshClient.shell(shellOptions, (err, stream) => {
          if (err) {
            socket.emit("ssh-status", { status: "error", message: "Failed to open shell: " + err.message });
            return;
          }
          
          sshStream = stream;
          socket.emit("ssh-status", { status: "shell-ready" });

          stream.on("close", () => {
             socket.emit("ssh-status", { status: "disconnected", message: "Shell closed." });
             closeSshSession(sshConnection);
          }).on("data", (data: any) => {
             socket.emit("ssh-data", data.toString("utf-8"));
          });
        });
      } catch (err: any) {
        socket.emit("ssh-status", { status: "error", message: err?.message || String(err) });
      }
    });

    socket.on("ssh-data", (data) => {
      if (sshStream) {
        sshStream.write(data);
      }
    });

    socket.on("ssh-resize", (size) => {
      if (sshStream) {
        sshStream.setWindow(size.rows, size.cols, size.height, size.width);
      }
    });

    socket.on("disconnect", () => {
      closeSshSession(sshConnection);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the dist folder
    const distPath = path.join(process.cwd(), 'dist');
    // Important: we can't assume __dirname is root because esbuild might place it elsewhere
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const startListen = (port: number) => {
    const server = httpServer.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${port} (Environment: ${process.env.NODE_ENV})`);
    });

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.log(`Port ${port} is in use, retrying in 2 seconds...`);
        setTimeout(() => {
          server.close();
          startListen(port);
        }, 2000);
      } else {
        console.error("Server failed to start:", err);
      }
    });
  };

  startListen(PORT);

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
  });

  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
  });
}

startServer();
