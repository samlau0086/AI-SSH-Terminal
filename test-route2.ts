import { initDb } from './api.js';
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-please-change-it-in-production";

async function test() {
  const db = await initDb();

  const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, JWT_SECRET);

  const res = await fetch('http://localhost:3000/api/user-items', {
      headers: {
          'Authorization': `Bearer ${token}`
      }
  });
    
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
}

test().catch(console.error);
