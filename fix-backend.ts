import fs from 'fs';

// Fix api.ts
let apiContent = fs.readFileSync('api.ts', 'utf-8');

apiContent = apiContent.replace(
  'const { barkEnabled, barkUrl, ntfyEnabled, ntfyUrl } = req.body;',
  'const { barkEnabled, barkUrl } = req.body;'
);

const ntfyBlockApi = `      if (ntfyEnabled && ntfyUrl) {
        try {
          const r = await fetch(ntfyUrl, {
            method: 'POST',
            body: message,
            headers: {
                'Title': 'Test Notification',
                'Tags': 'tada'
            }
          });
          if (r.ok) successIds.push('ntfy');
          else errors.push('Ntfy failed with status ' + r.status);
        } catch(e: any) {
          errors.push('Ntfy error: ' + e.message);
        }
      }`;

apiContent = apiContent.replace(ntfyBlockApi, '');
fs.writeFileSync('api.ts', apiContent);


// Fix monitor.ts
let monitorContent = fs.readFileSync('monitor.ts', 'utf-8');

monitorContent = monitorContent.replace(/let ntfyEnabled = [^;]+;/g, '');
monitorContent = monitorContent.replace(/let ntfyUrl = [^;]+;/g, '');
monitorContent = monitorContent.replace(/ntfyEnabled, /g, '');
monitorContent = monitorContent.replace(/ntfyUrl, /g, '');
monitorContent = monitorContent.replace(/!settings.ntfyEnabled && /g, '');

const ntfyBlockMonitor = `    if (settings.ntfyEnabled && settings.ntfyUrl) {
      fetch(settings.ntfyUrl, {
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

monitorContent = monitorContent.replace(ntfyBlockMonitor, '');
fs.writeFileSync('monitor.ts', monitorContent);
