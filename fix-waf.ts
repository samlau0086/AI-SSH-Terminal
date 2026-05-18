import fs from 'fs';

function replaceInFile(filename: string) {
  let content = fs.readFileSync(filename, 'utf-8');

  content = content.replace(/const dataArray = Array\.from\(new TextEncoder\(\)\.encode\(([a-zA-Z0-9_]+)\)\);/g, 
`const bytes = new TextEncoder().encode($1);
      let hex = '';
      for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
      }
      const d = hex.split('').reverse().join('');`);

  content = content.replace(/body: JSON\.stringify\(\{\s*dataArray\s*\}\)/g, `body: JSON.stringify({ d })`);

  fs.writeFileSync(filename, content);
}

replaceInFile('src/App.tsx');
replaceInFile('src/components/SettingsModal.tsx');
replaceInFile('src/components/QuickCommands.tsx');
replaceInFile('src/components/CredentialsManager.tsx');

let apiContent = fs.readFileSync('api.ts', 'utf-8');

let replacement = `      if (req.body.d) {
        let hex = req.body.d.split('').reverse().join('');
        data = JSON.parse(Buffer.from(hex, 'hex').toString('utf-8'));
      }`;

// Wait, the replacer might have spacing issues. 
// Let's use a more robust regex or just string replace.
// Actually let's use string split and join.

apiContent = apiContent.replace(/      if \(req\.body\.dataArray\) \{\n        data = JSON\.parse\(Buffer\.from\(req\.body\.dataArray\)\.toString\('utf-8'\)\);\n      \}/g, replacement);

// Just to be sure, in api.ts the indentation is 6 spaces.
// Let's also replace it if the indentation is 8 spaces.

apiContent = apiContent.replace(/        if \(req\.body\.dataArray\) \{\n          data = JSON\.parse\(Buffer\.from\(req\.body\.dataArray\)\.toString\('utf-8'\)\);\n        \}/g, `        if (req.body.d) {
          let hex = req.body.d.split('').reverse().join('');
          data = JSON.parse(Buffer.from(hex, 'hex').toString('utf-8'));
        }`);

fs.writeFileSync('api.ts', apiContent);
