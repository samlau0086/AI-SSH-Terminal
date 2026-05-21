import fs from 'fs';

let c = fs.readFileSync('monitor.ts', 'utf-8');

const t = `    if (settings.ntfyEnabled && settings.ntfyUrl) {
      fetch(settings.{
        method: 'POST',
        body: message,
        headers: {
            'Title': 'VPS Offline Alert',
            'Tags': 'warning'
        }
      })
      .then(res => res.text())
      .catch(err => console.error("[Uptime Monitor] Ntfy failed:", err));
    }`;

c = c.replace(t, '');

fs.writeFileSync('monitor.ts', c);
