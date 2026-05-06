import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { Client } from "ssh2";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { initDb, createApiRouter } from "./api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.APP_PORT ? parseInt(process.env.APP_PORT, 10) : 3000;
  const httpServer = createServer(app);
  
  const db = await initDb();
  
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  
  app.use("/api", createApiRouter(db));

  io.on("connection", (socket) => {
    let sshClient: Client | null = null;
    let sshStream: any = null;

    socket.on("ssh-connect", (config) => {
      if (sshClient) {
        sshClient.end();
      }
      
      sshClient = new Client();

      sshClient.on("ready", () => {
        socket.emit("ssh-status", { status: "connected", message: "SSH connection established." });
        
        sshClient?.shell({ term: 'xterm-256color' }, (err, stream) => {
          if (err) {
            socket.emit("ssh-status", { status: "error", message: "Failed to open shell: " + err.message });
            return;
          }
          
          sshStream = stream;
          socket.emit("ssh-status", { status: "shell-ready" });

          stream.on("close", () => {
             socket.emit("ssh-status", { status: "disconnected", message: "Shell closed." });
             sshClient?.end();
          }).on("data", (data: any) => {
             socket.emit("ssh-data", data.toString("utf-8"));
          });
        });
      }).on("error", (err: any) => {
         socket.emit("ssh-status", { status: "error", message: err?.message || err?.level || String(err) });
      }).on("end", () => {
         socket.emit("ssh-status", { status: "disconnected", message: "SSH connection ended." });
      });

      try {
        const connectConfig: any = {
          host: config.host,
          port: config.port || 22,
          username: config.username,
          readyTimeout: 10000 // Add a timeout so it doesn't hang forever
        };
        if (config.password) {
          connectConfig.password = config.password;
        } else if (config.privateKey) {
          let pk: string = config.privateKey;
          pk = pk.replace(/\r\n/g, '\n').trim() + '\n';
          if (pk.split('\n').length <= 3) {
            const match = pk.match(/(-----BEGIN [^-]+-----)\s*(.*?)\s*(-----END [^-]+-----)/s);
            if (match) {
               const header = match[1];
               const body = match[2].replace(/\s+/g, '');
               const footer = match[3];
               const bodyLines = body.match(/.{1,70}/g)?.join('\n') || body;
               pk = `${header}\n${bodyLines}\n${footer}\n`;
            }
          }
          connectConfig.privateKey = pk;
          if (config.passphrase) {
            connectConfig.passphrase = config.passphrase;
          }
        }
        sshClient.connect(connectConfig);
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
      if (sshClient) {
        sshClient.end();
      }
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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (Environment: ${process.env.NODE_ENV})`);
  });
}

startServer();
