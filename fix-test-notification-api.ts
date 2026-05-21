import fs from 'fs';

let content = fs.readFileSync('api.ts', 'utf-8');

let replaceTarget = `  router.post("/settings/me", authenticateToken, async (req: any, res: any) => {
    try {
      let data = req.body;
      if (req.body.d) {
        let unreversed = req.body.d.split('').reverse().join('');
        data = JSON.parse(decodeURIComponent(Buffer.from(unreversed, 'base64').toString('utf-8')));
      }
      await db.run('UPDATE users SET settings = ? WHERE id = ?', [JSON.stringify(data), req.user.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });`;

let testNotificationHandler = `  router.post("/settings/test-notification", authenticateToken, async (req: any, res: any) => {
    try {
      const { barkEnabled, barkUrl, ntfyEnabled, ntfyUrl } = req.body;
      const message = "This is a test notification from WebSSH!";
      
      let successIds = [];
      let errors = [];

      if (barkEnabled && barkUrl) {
        let url = barkUrl;
        if (!url.endsWith('/')) url += '/';
        url += \`Test%20Notification/\${encodeURIComponent(message)}\`;
        try {
          const r = await fetch(url);
          if (r.ok) successIds.push('bark');
          else errors.push('Bark failed with status ' + r.status);
        } catch(e: any) {
          errors.push('Bark error: ' + e.message);
        }
      }

      if (ntfyEnabled && ntfyUrl) {
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
      }

      if (successIds.length === 0 && errors.length === 0) {
        return res.status(400).json({ error: "No notification channels enabled or configured properly." });
      }

      if (errors.length > 0) {
        return res.status(500).json({ error: errors.join(', '), successIds });
      }

      res.json({ success: true, successIds });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });`;

if (!content.includes('/settings/test-notification')) {
  content = content.replace(replaceTarget, replaceTarget + '\n\n' + testNotificationHandler);
}
fs.writeFileSync('api.ts', content);
