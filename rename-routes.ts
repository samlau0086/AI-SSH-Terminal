import fs from 'fs';

function replaceInFile(filename: string, find: RegExp, replace: string) {
  let content = fs.readFileSync(filename, 'utf-8');
  content = content.replace(find, replace);
  fs.writeFileSync(filename, content);
}

replaceInFile('api.ts', /\/users\/me\/preferences/g, '/settings/me');
replaceInFile('api.ts', /\/user-items/g, '/creds');

replaceInFile('src/components/SettingsModal.tsx', /\/api\/users\/me\/preferences/g, '/api/settings/me');
replaceInFile('src/components/SessionForm.tsx', /\/api\/user-items/g, '/api/creds');
replaceInFile('src/components/CredentialsManager.tsx', /\/api\/user-items/g, '/api/creds');
