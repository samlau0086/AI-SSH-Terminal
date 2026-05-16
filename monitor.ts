import { exec } from 'child_process';

const lastChecked = new Map<string, number>();

export function startUptimeMonitor(db: any) {
  // Check every 1 minute if a session is due for pinging
  const CORE_TICK = 1 * 60 * 1000;

  setInterval(async () => {
    try {
      const activeSessions = await db.all('SELECT * FROM sessions WHERE uptimeMonitorEnabled = 1');
      if (!activeSessions || activeSessions.length === 0) return;

      Object.values(activeSessions.reduce((acc: any, s: any) => {
        if (!acc[s.userId]) acc[s.userId] = [];
        acc[s.userId].push(s);
        return acc;
      }, {})).forEach(async (sessionsForUser: any) => {
        if (!sessionsForUser || sessionsForUser.length === 0) return;
        
        const userId = sessionsForUser[0].userId;
        const user = await db.get('SELECT settings FROM users WHERE id = ?', [userId]);
        
        let settings: any = { uptimeCheckInterval: 5 };
        if (user && user.settings) {
           try {
              const parsed = JSON.parse(user.settings);
              settings = { ...settings, ...parsed };
           } catch(e) {}
        }
        
        let ntfyEnabled = settings.ntfyEnabled ?? (settings.notificationChannel === 'ntfy');
        let barkEnabled = settings.barkEnabled ?? (settings.notificationChannel === 'bark');
        let ntfyUrl = settings.ntfyUrl || (settings.notificationChannel === 'ntfy' ? settings.notificationUrl : '');
        let barkUrl = settings.barkUrl || (settings.notificationChannel === 'bark' ? settings.notificationUrl : '');

        settings = { ...settings, ntfyEnabled, barkEnabled, ntfyUrl, barkUrl };
        
        const intervalMs = (settings.uptimeCheckInterval || 5) * 60 * 1000;
        const now = Date.now();

        sessionsForUser.forEach((session: any) => {
           const last = lastChecked.get(session.id) || 0;
           if (now - last < intervalMs) return; // not due yet

           lastChecked.set(session.id, now);

           exec(`ping -c 1 -W 2 ${session.host}`, (err, stdout, stderr) => {
              if (err) {
                 // Offline
                 console.log(`[Uptime Monitor] Host ${session.host} is offline!`);
                 sendNotification(session, settings);
              } else {
                 console.log(`[Uptime Monitor] Host ${session.host} is online.`);
              }
           });
        });
      });
    } catch (e: any) {
      console.error("[Uptime Monitor] Error:", e);
    }
  }, CORE_TICK);
}

const lastNotified = new Map<string, number>();

function sendNotification(session: any, settings: any) {
    if (!settings.ntfyEnabled && !settings.barkEnabled) return;

    // Throttle notifications to max 1 per 10 minutes per session
    const last = lastNotified.get(session.id);
    const now = Date.now();
    if (last && now - last < 10 * 60 * 1000) return;

    lastNotified.set(session.id, now);

    const message = `VPS Alert: ${session.name || session.host} (${session.host}) is unreachable!`;
    console.log(`[Uptime Monitor] Sending notifications for ${session.host}...`);

    if (settings.barkEnabled && settings.barkUrl) {
      let url = settings.barkUrl;
      if (!url.endsWith('/')) url += '/';
      url += encodeURIComponent(message);
      
      fetch(url)
        .then(res => res.text())
        .catch(err => console.error("[Uptime Monitor] Bark failed:", err));
    }

    if (settings.ntfyEnabled && settings.ntfyUrl) {
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
    }
}
