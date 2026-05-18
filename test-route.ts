import { createApiRouter, initDb } from './api.js';
import express from 'express';
import request from 'supertest';
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-please-change-it-in-production";

async function test() {
  const db = await initDb();
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(db));

  const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, JWT_SECRET);

  const res = await request(app)
    .get('/api/user-items')
    .set('Authorization', `Bearer ${token}`);
    
  console.log('Status:', res.status);
  console.log('Body:', res.body);
}

test().catch(console.error);
