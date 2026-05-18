import fs from 'fs';
let content=fs.readFileSync('api.ts', 'utf-8');
content = content.replace(/req\.body\.enc/g, 'req.body.dataArray').replace(/Buffer\.from\(req\.body\.dataArray, 'hex'\)/g, 'Buffer.from(req.body.dataArray)');
fs.writeFileSync('api.ts', content);
