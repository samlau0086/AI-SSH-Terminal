import fs from 'fs';

let content = fs.readFileSync('src/components/SettingsModal.tsx', 'utf-8');

if (!content.includes('RefreshCw')) {
  content = content.replace("import { X, Server, Activity, CheckCircle2, AlertCircle, Settings as SettingsIcon, Bell, Key } from 'lucide-react';", "import { X, Server, Activity, CheckCircle2, AlertCircle, Settings as SettingsIcon, Bell, Key, RefreshCw } from 'lucide-react';");
}

fs.writeFileSync('src/components/SettingsModal.tsx', content);
