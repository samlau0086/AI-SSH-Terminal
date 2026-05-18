import fs from 'fs';
import path from 'path';

function replaceInFile(filename: string) {
  let content = fs.readFileSync(filename, 'utf-8');
  const originalContent = content;
  
  content = content.replace(/localStorage\.getItem\('token'\)/g, "localStorage.getItem('ai-ssh-token')");
  
  if (originalContent !== content) {
    fs.writeFileSync(filename, content);
    console.log('Fixed', filename);
  }
}

['src/components/SessionForm.tsx', 'src/components/SettingsModal.tsx', 'src/components/CredentialsManager.tsx'].forEach(replaceInFile);
