import fs from 'fs';

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

`;

if (!mainContent.includes('Response.prototype.json = async function')) {
  fs.writeFileSync('src/main.tsx', frontendInterceptorCode + mainContent);
}
