import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-please-change-it-in-production";

export async function initDb() {
  const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      name TEXT,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 22,
      username TEXT NOT NULL,
      authType TEXT NOT NULL,
      password TEXT,
      privateKey TEXT,
      passphrase TEXT,
      tags TEXT,
      notes TEXT,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  return db;
}

export function createApiRouter(db: any) {
  const router = Router();

  // Middleware to authenticate JWT
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  const verifyAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: "Require admin role" });
    }
    next();
  };

  router.post("/auth/register", async (req, res) => {
    try {
      const { username, password, role } = req.body;
      const usersCount = await db.get('SELECT COUNT(*) as count FROM users');
      const assignedRole = (role && usersCount.count === 0) ? 'admin' : (usersCount.count === 0 ? 'admin' : 'user');

      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await db.run(
        'INSERT INTO users (username, passwordHash, role) VALUES (?, ?, ?)',
        [username, hashedPassword, assignedRole]
      );
      
      const token = jwt.sign({ id: result.lastID, username, role: assignedRole }, JWT_SECRET);
      res.json({ token, user: { id: result.lastID, username, role: assignedRole } });
    } catch (err: any) {
      if (err.message.includes('UNIQUE')) {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  router.post("/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
      if (!user) return res.status(400).json({ error: "User not found" });

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) return res.status(400).json({ error: "Invalid password" });

      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
      res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/auth/me", authenticateToken, (req: any, res: any) => {
    res.json({ user: req.user });
  });

  router.get("/sessions", authenticateToken, async (req: any, res: any) => {
    try {
      const sessions = await db.all('SELECT * FROM sessions WHERE userId = ?', [req.user.id]);
      // Parse tags
      const formatted = sessions.map((s: any) => ({
        ...s,
        tags: s.tags ? JSON.parse(s.tags) : []
      }));
      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/sessions", authenticateToken, async (req: any, res: any) => {
    try {
      const { id, name, host, port, username, authType, password, privateKey, passphrase, tags, notes } = req.body;
      await db.run(
        `INSERT INTO sessions (id, userId, name, host, port, username, authType, password, privateKey, passphrase, tags, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, req.user.id, name, host, port, username, authType, password, privateKey, passphrase, JSON.stringify(tags || []), notes]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put("/sessions/:id", authenticateToken, async (req: any, res: any) => {
    try {
        const { name, host, port, username, authType, password, privateKey, passphrase, tags, notes } = req.body;
        await db.run(
          `UPDATE sessions SET name=?, host=?, port=?, username=?, authType=?, password=?, privateKey=?, passphrase=?, tags=?, notes=? 
           WHERE id=? AND userId=?`,
          [name, host, port, username, authType, password, privateKey, passphrase, JSON.stringify(tags || []), notes, req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete("/sessions/:id", authenticateToken, async (req: any, res: any) => {
    try {
        await db.run('DELETE FROM sessions WHERE id=? AND userId=?', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin routes
  router.get("/admin/users", authenticateToken, verifyAdmin, async (req: any, res: any) => {
    try {
      const users = await db.all('SELECT id, username, role FROM users');
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete("/admin/users/:id", authenticateToken, verifyAdmin, async (req: any, res: any) => {
    try {
      if (parseInt(req.params.id) === req.user.id) {
          return res.status(400).json({ error: "Cannot delete yourself" });
      }
      await db.run('DELETE FROM users WHERE id=?', [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
