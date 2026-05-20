import fs from 'fs';

let content = fs.readFileSync('src/components/SessionInfoPanel.tsx', 'utf-8');

// The line is: if (!window.confirm(`Are you sure you want to delete \${filename}?`)) return;
content = content.replace(
  "if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;",
  ""
);

fs.writeFileSync('src/components/SessionInfoPanel.tsx', content);
