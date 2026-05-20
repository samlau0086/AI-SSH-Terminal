import fs from 'fs';

let content = fs.readFileSync('src/components/SettingsModal.tsx', 'utf-8');

// Update Props
content = content.replace(
  'onSave: (settings: AISettings) => void;',
  'onSave: (settings: AISettings, fullDataToSave?: any) => void;'
);

// Update handleSubmit
let findSubmit = `
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    
    // encode as bytes array to bypass WAF
    const settingsStr = JSON.stringify({
      ntfyEnabled: notificationSettings.ntfyEnabled,
      ntfyUrl: notificationSettings.ntfyUrl,
      barkEnabled: notificationSettings.barkEnabled,
      barkUrl: notificationSettings.barkUrl,
      uptimeCheckInterval: notificationSettings.uptimeCheckInterval
    });
    const d = btoa(encodeURIComponent(settingsStr)).split('').reverse().join('');

    fetch('/api/settings/me', {
      method: 'POST',
      headers: { 
        'Authorization': \`Bearer \${localStorage.getItem('ai-ssh-token')}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ d })
    })
    .then(async r => {
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    })
    .catch(console.error);
  };`;

let replaceSubmit = `
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData, {
      ntfyEnabled: notificationSettings.ntfyEnabled,
      ntfyUrl: notificationSettings.ntfyUrl,
      barkEnabled: notificationSettings.barkEnabled,
      barkUrl: notificationSettings.barkUrl,
      uptimeCheckInterval: notificationSettings.uptimeCheckInterval
    });
  };`;

content = content.replace(findSubmit, replaceSubmit);

fs.writeFileSync('src/components/SettingsModal.tsx', content);
