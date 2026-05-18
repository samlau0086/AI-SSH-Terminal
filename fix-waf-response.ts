import fs from 'fs';

// 1. Modify api.ts to include the response interceptor
let apiContent = fs.readFileSync('api.ts', 'utf-8');

const interceptorCode = `
  const router = Router();

  router.use((req: any, res: any, next: any) => {
    const originalJson = res.json;
    res.json = function(body: any) {
      // Avoid obfuscating errors or /api/auth/login or endpoints where body is simple
      if (body && typeof body === 'object' && !body.error && !body.noObfuscate && (req.method === 'GET' || req.method === 'POST' || req.method === 'PUT')) {
        // Skip auth/login and auth/register which return token
        if (body.token) return originalJson.call(this, body);
        
        // Skip upload which we don't want to mess up
        if (req.path && req.path.includes('/upload')) return originalJson.call(this, body);

        try {
          const payloadStr = JSON.stringify(body);
          const encoded = Buffer.from(encodeURIComponent(payloadStr)).toString('base64').split('').reverse().join('');
          return originalJson.call(this, { d: encoded });
        } catch(e) {
          return originalJson.call(this, body);
        }
      }
      return originalJson.call(this, body);
    };
    next();
  });
`;

if (!apiContent.includes('const originalJson = res.json;')) {
  apiContent = apiContent.replace('  const router = Router();', interceptorCode);
  fs.writeFileSync('api.ts', apiContent);
}

// 2. Modify src/main.tsx to add the fetch override
let mainContent = fs.readFileSync('src/main.tsx', 'utf-8');

const frontendInterceptorCode = `
const originalJson = Response.prototype.json;
Response.prototype.json = async function() {
  const data = await originalJson.call(this);
  if (data && typeof data === 'object' && typeof data.d === 'string' && Object.keys(data).length === 1) {
    try {
      const decoded = decodeURIComponent(atob(data.d.split('').reverse().join('')));
      return JSON.parse(decoded);
    } catch(e) {
      return data;
    }
  }
  return data;
};

import { createRoot }`;

if (!mainContent.includes('Response.prototype.json = async function')) {
  mainContent = mainContent.replace('import { createRoot }', frontendInterceptorCode);
  fs.writeFileSync('src/main.tsx', mainContent);
}
