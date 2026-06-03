import { closeSshSession, connectStoredSshSession } from './ssh.js';

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
        
        
        let barkEnabled = settings.barkEnabled ?? (settings.notificationChannel === 'bark');
        
        let barkUrl = settings.barkUrl || (settings.notificationChannel === 'bark' ? settings.notificationUrl : '');

        settings = { ...settings, barkEnabled, barkUrl };
        
        const intervalMs = (settings.uptimeCheckInterval || 5) * 60 * 1000;
        const now = Date.now();

        sessionsForUser.forEach(async (session: any) => {
           const last = lastChecked.get(session.id) || 0;
           if (now - last < intervalMs) return; // not due yet

           lastChecked.set(session.id, now);

           let connection = null;
           try {
              connection = await connectStoredSshSession(db, session, session.userId);
              console.log(`[Uptime Monitor] Host ${session.host} is online.`);
           } catch (err) {
              console.log(`[Uptime Monitor] Host ${session.host} is offline!`);
              sendNotification(session, settings);
           } finally {
              closeSshSession(connection);
           }
        });
      });
    } catch (e: any) {
      console.error("[Uptime Monitor] Error:", e);
    }
  }, CORE_TICK);
}

const lastExpirationNotified = new Map<string, boolean>();

export function startExpirationMonitor(db: any) {
  // Check every 12 hours
  const EXPIRATION_TICK = 12 * 60 * 60 * 1000;
  
  const checkExpirations = async () => {
    try {
      const activeSessions = await db.all('SELECT * FROM sessions WHERE expirationDate IS NOT NULL AND expirationDate != ""');
      if (!activeSessions || activeSessions.length === 0) return;

      Object.values(activeSessions.reduce((acc: any, s: any) => {
        if (!acc[s.userId]) acc[s.userId] = [];
        acc[s.userId].push(s);
        return acc;
      }, {})).forEach(async (sessionsForUser: any) => {
        if (!sessionsForUser || sessionsForUser.length === 0) return;
        
        const userId = sessionsForUser[0].userId;
        const user = await db.get('SELECT settings FROM users WHERE id = ?', [userId]);
        
        let settings: any = {};
        if (user && user.settings) {
           try {
              settings = JSON.parse(user.settings);
           } catch(e) {}
        }
        
        let barkEnabled = settings.barkEnabled ?? (settings.notificationChannel === 'bark');
        let barkUrl = settings.barkUrl || (settings.notificationChannel === 'bark' ? settings.notificationUrl : '');
        settings = { ...settings, barkEnabled, barkUrl };
        
        const warningDays = settings.expirationWarningDays || 7;
        const todayStr = new Date().toISOString().split('T')[0];

        sessionsForUser.forEach((session: any) => {
           const expDate = new Date(session.expirationDate);
           if (isNaN(expDate.getTime())) return;

           const daysLeft = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 3600 * 24));
           
           if (daysLeft > 0 && daysLeft <= warningDays) {
              const notifyKey = `${session.id}_${todayStr}`;
              if (!lastExpirationNotified.has(notifyKey)) {
                 lastExpirationNotified.set(notifyKey, true);
                 const msg = `VPS Expiration Alert: ${session.name || session.host} (${session.host}) is expiring in ${daysLeft} day(s) on ${session.expirationDate}!`;
                 console.log(`[Expiration Monitor] ${msg}`);
                 sendNotification(session, settings, msg);
              }
           }
        });
      });
    } catch (e: any) {
      console.error("[Expiration Monitor] Error:", e);
    }
  };

  // Run once on startup, then every tick
  setTimeout(checkExpirations, 5000); // give db time to init
  setInterval(checkExpirations, EXPIRATION_TICK);
}

const lastNotified = new Map<string, number>();

function sendNotification(session: any, settings: any, overrideMsg?: string) {
    if (!settings.barkEnabled) return;

    // Throttle notifications to max 1 per 10 minutes per session (for uptime)
    if (!overrideMsg) {
      const last = lastNotified.get(session.id);
      const now = Date.now();
      if (last && now - last < 10 * 60 * 1000) return;
      lastNotified.set(session.id, now);
    }

    const message = overrideMsg || `VPS Alert: ${session.name || session.host} (${session.host}) is unreachable!`;
    console.log(`[Notification Monitor] Sending for ${session.host}...`);

    if (settings.barkEnabled && settings.barkUrl) {
      let url = settings.barkUrl;
      if (!url.endsWith('/')) url += '/';
      url += encodeURIComponent(message);
      
      fetch(url)
        .then(res => res.text())
        .catch(err => console.error("[Notification Monitor] Bark failed:", err));
    }
}

