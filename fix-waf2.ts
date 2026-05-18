import fs from 'fs';

function replaceInFile(filename: string) {
  let content = fs.readFileSync(filename, 'utf-8');

  // Replace the hex generation block
  let targetBlock = `const bytes = new TextEncoder().encode(payloadStr);
      let hex = '';
      for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
      }
      const d = hex.split('').reverse().join('');`;
      
  let newBlock = `const d = btoa(encodeURIComponent(payloadStr)).split('').reverse().join('');`;
  
  content = content.replace(targetBlock, newBlock);
  
  // also handle the one in SettingsModal.tsx which uses settingsStr instead of payloadStr
  let targetBlock2 = `const bytes = new TextEncoder().encode(settingsStr);
      let hex = '';
      for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
      }
      const d = hex.split('').reverse().join('');`;
  let newBlock2 = `const d = btoa(encodeURIComponent(settingsStr)).split('').reverse().join('');`;
  content = content.replace(targetBlock2, newBlock2);
  
  // QuickCommands uses payloadStr but the variables were inline
  let targetBlock3 = `const bytes = new TextEncoder().encode(payloadStr);
      let hex = '';
      for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
      }
      const d = hex.split('').reverse().join('');`;
  content = content.replace(targetBlock3, newBlock); // In case it has multiple spaces
  
  fs.writeFileSync(filename, content);
}

replaceInFile('src/App.tsx');
replaceInFile('src/components/SettingsModal.tsx');
replaceInFile('src/components/QuickCommands.tsx');
replaceInFile('src/components/CredentialsManager.tsx');

let apiContent = fs.readFileSync('api.ts', 'utf-8');

apiContent = apiContent.replace(/let hex = req\.body\.d\.split\(''\)\.reverse\(\)\.join\(''\);\n\s*data = JSON\.parse\(Buffer\.from\(hex, 'hex'\)\.toString\('utf-8'\)\);/g, 
`let unreversed = req.body.d.split('').reverse().join('');
        data = JSON.parse(decodeURIComponent(Buffer.from(unreversed, 'base64').toString('utf-8')));`);
        
fs.writeFileSync('api.ts', apiContent);
