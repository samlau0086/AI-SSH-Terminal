import { initDb } from './api.js';
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-please-change-it-in-production";

async function test() {
  const db = await initDb();
  const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, JWT_SECRET);

  // create a cred
  await fetch('http://localhost:3000/api/creds', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ d: Buffer.from(encodeURIComponent(JSON.stringify({ id: 'testdel1', name: 'delme', username: 'root', authType: 'password', password: '123' }))).toString('base64').split('').reverse().join('') })
  });

  // fetch creds
  let res = await fetch('http://localhost:3000/api/creds', {
      headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('List before:', await res.json());

  // delete it
  const delRes = await fetch('http://localhost:3000/api/creds/testdel1', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Delete status:', delRes.status, await delRes.text());

  // fetch creds again
  res = await fetch('http://localhost:3000/api/creds', {
      headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('List after:', await res.json());
}

test().catch(console.error);
