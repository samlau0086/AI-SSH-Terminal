import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import multer from 'multer';
import fs from 'fs';

import { Client } from "ssh2";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-please-change-it-in-production";
const upload = multer({ dest: '/tmp/uploads/' });

export async function initDb() {
  const dbPath = process.env.DB_PATH || './database.sqlite';
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_approved INTEGER NOT NULL DEFAULT 0
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
      expirationDate TEXT,
      renewalCycle TEXT,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quick_commands (
      id TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      name TEXT NOT NULL,
      command TEXT NOT NULL,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  try {
    await db.get('SELECT is_approved FROM users LIMIT 1');
  } catch (e) {
    // Add column if it doesn't exist for older databases
    await db.exec('ALTER TABLE users ADD COLUMN is_approved INTEGER NOT NULL DEFAULT 0;');
    // Set existing admins to approved by default
    await db.exec('UPDATE users SET is_approved = 1 WHERE role = "admin";');
    // Set old users to approved? Or maybe they stay unapproved? Let's approve old users to not break existing instances, or leave them as 0 if they want to approve manually. Let's approve all existing for backward compatibility.
    await db.exec('UPDATE users SET is_approved = 1;');
  }

  try {
    await db.get('SELECT expirationDate FROM sessions LIMIT 1');
  } catch(e) {
    await db.exec('ALTER TABLE sessions ADD COLUMN expirationDate TEXT;');
    await db.exec('ALTER TABLE sessions ADD COLUMN renewalCycle TEXT;');
  }

  return db;
}

export function createApiRouter(db: any) {
  const router = Router();

  // Middleware to authenticate JWT
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    
    if (!token && req.query.token) {
      token = req.query.token;
    }
    
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
      const isFirstUser = usersCount.count === 0;
      const assignedRole = (role && isFirstUser) ? 'admin' : (isFirstUser ? 'admin' : 'user');
      const isApproved = isFirstUser ? 1 : 0; // First user is always approved

      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await db.run(
        'INSERT INTO users (username, passwordHash, role, is_approved) VALUES (?, ?, ?, ?)',
        [username, hashedPassword, assignedRole, isApproved]
      );
      
      if (!isApproved) {
        return res.status(201).json({ message: "Registration successful. Please wait for an administrator to approve your account." });
      }

      const token = jwt.sign({ id: result.lastID, username, role: assignedRole }, JWT_SECRET);
      res.json({ token, user: { id: result.lastID, username, role: assignedRole, is_approved: isApproved } });
    } catch (err: any) {
      if (err.message.includes('UNIQUE')) {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: err?.message || String(err) });
      }
    }
  });

  router.post("/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
      if (!user) return res.status(400).json({ error: "User not found" });

      if (!user.is_approved) {
        return res.status(403).json({ error: "Account pending approval. Please wait for an administrator to approve." });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) return res.status(400).json({ error: "Invalid password" });

      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
      res.json({ token, user: { id: user.id, username: user.username, role: user.role, is_approved: user.is_approved } });
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

  const normalizePrivateKey = (key: string | null | undefined): string | null | undefined => {
    if (!key) return key;
    let pk = key.replace(/\r\n/g, '\n').trim() + '\n';
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
    return pk;
  };

  router.post("/sessions", authenticateToken, async (req: any, res: any) => {
    try {
      const { id, name, host, port, username, authType, password, privateKey, passphrase, tags, notes, expirationDate, renewalCycle } = req.body;
      const formattedPrivateKey = normalizePrivateKey(privateKey);
      await db.run(
        `INSERT INTO sessions (id, userId, name, host, port, username, authType, password, privateKey, passphrase, tags, notes, expirationDate, renewalCycle) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, req.user.id, name, host, port, username, authType, password, formattedPrivateKey, passphrase, JSON.stringify(tags || []), notes, expirationDate, renewalCycle]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/sessions/execute", authenticateToken, async (req: any, res: any) => {
    try {
      const { sessionIds, command } = req.body;
      if (!sessionIds || !sessionIds.length || !command) {
        return res.status(400).json({ error: "Missing sessionIds or command" });
      }

      const placeholders = sessionIds.map(() => '?').join(',');
      const sessions = await db.all(`SELECT * FROM sessions WHERE id IN (${placeholders}) AND userId = ?`, [...sessionIds, req.user.id]);
      
      const results = await Promise.all(sessions.map((session: any) => {
        return new Promise((resolve) => {
          const sshClient = new Client();
          let output = '';
          let executionTimeout = setTimeout(() => {
            sshClient.end();
            resolve({ sessionId: session.id, error: 'Command execution timed out' });
          }, 30000); // 30 second timeout
          
          sshClient.on('ready', () => {
            sshClient.exec(command, (err, stream) => {
              if (err) {
                 clearTimeout(executionTimeout);
                 sshClient.end();
                 return resolve({ sessionId: session.id, error: err.message });
              }
              stream.on('close', (code: any, signal: any) => {
                clearTimeout(executionTimeout);
                sshClient.end();
                resolve({ sessionId: session.id, output, code });
              }).on('data', (data: any) => {
                output += data.toString('utf-8');
              }).stderr.on('data', (data: any) => {
                output += data.toString('utf-8');
              });
            });
          }).on('error', (err) => {
            clearTimeout(executionTimeout);
            resolve({ sessionId: session.id, error: err.message });
          });

          try {
            const config: any = { host: session.host, port: session.port, username: session.username, readyTimeout: 10000 };
            if (session.password) config.password = session.password;
            if (session.privateKey) {
              config.privateKey = normalizePrivateKey(session.privateKey);
              if (session.passphrase) config.passphrase = session.passphrase;
            }
            sshClient.connect(config);
          } catch(err: any) {
            clearTimeout(executionTimeout);
            resolve({ sessionId: session.id, error: err.message });
          }
        });
      }));

      res.json({ results });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put("/sessions/:id", authenticateToken, async (req: any, res: any) => {
    try {
        const { name, host, port, username, authType, password, privateKey, passphrase, tags, notes, expirationDate, renewalCycle } = req.body;
        const formattedPrivateKey = normalizePrivateKey(privateKey);
        await db.run(
          `UPDATE sessions SET name=?, host=?, port=?, username=?, authType=?, password=?, privateKey=?, passphrase=?, tags=?, notes=?, expirationDate=?, renewalCycle=? 
           WHERE id=? AND userId=?`,
          [name, host, port, username, authType, password, formattedPrivateKey, passphrase, JSON.stringify(tags || []), notes, expirationDate, renewalCycle, req.params.id, req.user.id]
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

  router.post("/sessions/:id/upload", authenticateToken, upload.single('file'), async (req: any, res: any) => {
    try {
       const session = await db.get(`SELECT * FROM sessions WHERE id = ? AND userId = ?`, [req.params.id, req.user.id]);
       if (!session) return res.status(404).json({ error: "Session not found" });
       
       const file = req.file;
       if (!file) return res.status(400).json({ error: "No file uploaded" });

       const targetPath = req.body.path || `./${file.originalname}`;

       const sshClient = new Client();
       sshClient.on('ready', () => {
           sshClient.sftp((err, sftp) => {
               if (err) {
                   sshClient.end();
                   fs.unlink(file.path, () => {});
                   return res.status(500).json({ error: err.message });
               }
               
               const resolvePath = (p: string, cb: (resolved: string) => void) => {
                   if (p.startsWith('~/') || p === '~') {
                       sftp.realpath('.', (rErr, homePath) => {
                           if (rErr) cb(p);
                           else cb(p.replace(/^~/, homePath));
                       });
                   } else {
                       cb(p);
                   }
               };

               resolvePath(targetPath, (actualPath) => {
                   // transfer file
                   sftp.fastPut(file.path, actualPath, (putErr) => {
                       sshClient.end();
                       fs.unlink(file.path, () => {}); // clean up local temp file
                       if (putErr) {
                           return res.status(500).json({ error: putErr.message });
                       }
                       res.json({ success: true, message: `File uploaded to ${actualPath}` });
                   });
               });
           });
       }).on('error', (err: any) => {
           fs.unlink(file.path, () => {});
           res.status(500).json({ error: err?.message || String(err) });
       });

       try {
         const config: any = { host: session.host, port: session.port, username: session.username, readyTimeout: 10000 };
         if (session.password) config.password = session.password;
         if (session.privateKey) {
           config.privateKey = session.privateKey;
           if (session.passphrase) config.passphrase = session.passphrase;
         }
         sshClient.connect(config);
       } catch(err: any) {
          fs.unlink(file.path, () => {});
          res.status(500).json({ error: err?.message || String(err) });
       }
    } catch (err: any) {
       res.status(500).json({ error: err?.message || String(err) });
    }
  });

  router.get("/sessions/:id/stats", authenticateToken, async (req: any, res: any) => {
    try {
       const session = await db.get(`SELECT * FROM sessions WHERE id = ? AND userId = ?`, [req.params.id, req.user.id]);
       if (!session) return res.status(404).json({ error: "Session not found" });

       const sshClient = new Client();
       sshClient.on('ready', () => {
           sshClient.exec("top -b -n 1 | head -n 5 && free -m && df -m /", (err, stream) => {
               if (err) {
                   sshClient.end();
                   return res.status(500).json({ error: err.message });
               }
               let output = '';
               let executionTimeout = setTimeout(() => {
                   sshClient.end();
                   if (!res.headersSent) res.status(500).json({ error: 'Command execution timed out' });
               }, 10000); // 10 second timeout

               stream.on('close', () => {
                   clearTimeout(executionTimeout);
                   sshClient.end();
                   if (!res.headersSent) res.json({ output });
               }).on('data', (data: any) => {
                   output += data.toString('utf-8');
               }).stderr.on('data', (data: any) => {
                   output += data.toString('utf-8');
               });
           });
       }).on('error', (err: any) => {
           if (!res.headersSent) res.status(500).json({ error: err?.message || String(err) });
       });

       try {
         const config: any = { host: session.host, port: session.port, username: session.username, readyTimeout: 10000 };
         if (session.password) config.password = session.password;
         if (session.privateKey) {
           config.privateKey = session.privateKey;
           if (session.passphrase) config.passphrase = session.passphrase;
         }
         sshClient.connect(config);
       } catch(err: any) {
          if (!res.headersSent) res.status(500).json({ error: err?.message || String(err) });
       }
    } catch (err: any) {
       if (!res.headersSent) res.status(500).json({ error: err?.message || String(err) });
    }
  });

  router.get("/sessions/:id/files", authenticateToken, async (req: any, res: any) => {
    try {
       const session = await db.get(`SELECT * FROM sessions WHERE id = ? AND userId = ?`, [req.params.id, req.user.id]);
       if (!session) return res.status(404).json({ error: "Session not found" });

       const dirPath = req.query.path || '~/';

       const sshClient = new Client();
       sshClient.on('ready', () => {
           sshClient.sftp((err, sftp) => {
               if (err) {
                   sshClient.end();
                   return res.status(500).json({ error: err.message });
               }
               
               const resolvePath = (p: string, cb: (resolved: string) => void) => {
                   if (p.startsWith('~/') || p === '~') {
                       sftp.realpath('.', (rErr, homePath) => {
                           if (rErr) cb(p);
                           else cb(p.replace(/^~/, homePath));
                       });
                   } else {
                       cb(p);
                   }
               };

               resolvePath(dirPath, (actualPath) => {
                   sftp.readdir(actualPath, (readErr, list) => {
                       sshClient.end();
                       if (readErr) {
                           return res.status(500).json({ error: readErr.message });
                       }
                       res.json({ files: list, currentPath: actualPath });
                   });
               });
           });
       }).on('error', (err: any) => {
           res.status(500).json({ error: err?.message || String(err) });
       });

       try {
         const config: any = { host: session.host, port: session.port, username: session.username, readyTimeout: 10000 };
         if (session.password) config.password = session.password;
         if (session.privateKey) {
           config.privateKey = session.privateKey;
           if (session.passphrase) config.passphrase = session.passphrase;
         }
         sshClient.connect(config);
       } catch(err: any) {
          res.status(500).json({ error: err?.message || String(err) });
       }
    } catch (err: any) {
       res.status(500).json({ error: err?.message || String(err) });
    }
  });

  router.get("/sessions/:id/download", authenticateToken, async (req: any, res: any) => {
    try {
       const session = await db.get(`SELECT * FROM sessions WHERE id = ? AND userId = ?`, [req.params.id, req.user.id]);
       if (!session) return res.status(404).json({ error: "Session not found" });

       const filePath = req.query.path;
       if (!filePath) return res.status(400).json({ error: "Missing path" });

       const sshClient = new Client();
       sshClient.on('ready', () => {
           sshClient.sftp((err, sftp) => {
               if (err) {
                   sshClient.end();
                   return res.status(500).json({ error: err.message });
               }
               
               const resolvePath = (p: string, cb: (resolved: string) => void) => {
                   if (p.startsWith('~/') || p === '~') {
                       sftp.realpath('.', (rErr, homePath) => {
                           if (rErr) cb(p);
                           else cb(p.replace(/^~/, homePath));
                       });
                   } else {
                       cb(p);
                   }
               };

               resolvePath(filePath, (actualPath) => {
                   const readStream = sftp.createReadStream(actualPath);
                   readStream.on('error', (readErr) => {
                       sshClient.end();
                       if (!res.headersSent) res.status(500).json({ error: readErr.message });
                   });

                   res.setHeader('Content-Type', 'application/octet-stream');
                   res.setHeader('Content-Disposition', `attachment; filename="${actualPath.split('/').pop()}"`);
                   readStream.pipe(res);
                   res.on('finish', () => {
                       sshClient.end();
                   });
                   res.on('close', () => {
                       sshClient.end();
                   });
               });
           });
       }).on('error', (err: any) => {
           if (!res.headersSent) res.status(500).json({ error: err?.message || String(err) });
       });

       try {
         const config: any = { host: session.host, port: session.port, username: session.username, readyTimeout: 10000 };
         if (session.password) config.password = session.password;
         if (session.privateKey) {
           config.privateKey = session.privateKey;
           if (session.passphrase) config.passphrase = session.passphrase;
         }
         sshClient.connect(config);
       } catch(err: any) {
          if (!res.headersSent) res.status(500).json({ error: err?.message || String(err) });
       }
    } catch (err: any) {
       if (!res.headersSent) res.status(500).json({ error: err?.message || String(err) });
    }
  });

  router.delete("/sessions/:id/files", authenticateToken, async (req: any, res: any) => {
    try {
       const session = await db.get(`SELECT * FROM sessions WHERE id = ? AND userId = ?`, [req.params.id, req.user.id]);
       if (!session) return res.status(404).json({ error: "Session not found" });

       const filePath = req.query.path;
       const isDir = req.query.isDir === 'true';
       
       if (!filePath) return res.status(400).json({ error: "Missing path" });

       const sshClient = new Client();
       sshClient.on('ready', () => {
           sshClient.sftp((err, sftp) => {
               if (err) {
                   sshClient.end();
                   return res.status(500).json({ error: err.message });
               }
               
               const resolvePath = (p: string, cb: (resolved: string) => void) => {
                   if (p.startsWith('~/') || p === '~') {
                       sftp.realpath('.', (rErr, homePath) => {
                           if (rErr) cb(p);
                           else cb(p.replace(/^~/, homePath));
                       });
                   } else {
                       cb(p);
                   }
               };

               resolvePath(filePath, (actualPath) => {
                   const cb = (delErr: any) => {
                       sshClient.end();
                       if (delErr) return res.status(500).json({ error: delErr.message });
                       res.json({ success: true, message: "Deleted successfully" });
                   };
                   
                   if (isDir) {
                       sftp.rmdir(actualPath, cb);
                   } else {
                       sftp.unlink(actualPath, cb);
                   }
               });
           });
       }).on('error', (err: any) => {
           if (!res.headersSent) res.status(500).json({ error: err?.message || String(err) });
       });

       try {
         const config: any = { host: session.host, port: session.port, username: session.username, readyTimeout: 10000 };
         if (session.password) config.password = session.password;
         if (session.privateKey) {
           config.privateKey = session.privateKey;
           if (session.passphrase) config.passphrase = session.passphrase;
         }
         sshClient.connect(config);
       } catch(err: any) {
          if (!res.headersSent) res.status(500).json({ error: err?.message || String(err) });
       }
    } catch (err: any) {
       if (!res.headersSent) res.status(500).json({ error: err?.message || String(err) });
    }
  });

  router.get("/quick-commands", authenticateToken, async (req: any, res: any) => {
    try {
      const commands = await db.all('SELECT * FROM quick_commands WHERE userId = ?', [req.user.id]);
      res.json(commands);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/quick-commands", authenticateToken, async (req: any, res: any) => {
    try {
      const { id, name, command } = req.body;
      await db.run(
        `INSERT INTO quick_commands (id, userId, name, command) VALUES (?, ?, ?, ?)`,
        [id, req.user.id, name, command]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put("/quick-commands/:id", authenticateToken, async (req: any, res: any) => {
    try {
      const { name, command } = req.body;
      await db.run(
        `UPDATE quick_commands SET name=?, command=? WHERE id=? AND userId=?`,
        [name, command, req.params.id, req.user.id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete("/quick-commands/:id", authenticateToken, async (req: any, res: any) => {
    try {
      await db.run('DELETE FROM quick_commands WHERE id=? AND userId=?', [req.params.id, req.user.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin routes
  router.get("/admin/users", authenticateToken, verifyAdmin, async (req: any, res: any) => {
    try {
      const users = await db.all('SELECT id, username, role, is_approved FROM users');
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put("/admin/users/:id/approve", authenticateToken, verifyAdmin, async (req: any, res: any) => {
    try {
      await db.run('UPDATE users SET is_approved = 1 WHERE id=?', [req.params.id]);
      res.json({ success: true });
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
