import fs from 'fs';

let content = fs.readFileSync('src/components/SettingsModal.tsx', 'utf-8');

let newTestFunction = `  const handleTestNotification = async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
      const res = await fetch('/api/settings/test-notification', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${localStorage.getItem('ai-ssh-token')}\`
        },
        body: JSON.stringify({
          ntfyEnabled: notificationSettings.ntfyEnabled,
          ntfyUrl: notificationSettings.ntfyUrl,
          barkEnabled: notificationSettings.barkEnabled,
          barkUrl: notificationSettings.barkUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send notification');
      setTestStatus('success');
      setTestMessage('Notification sent successfully!');
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message || 'Test failed');
    }
  };`;

// Insert the new function somewhere before handleTestModel
if (!content.includes('handleTestNotification')) {
  let findTarget = 'const handleTestModel = async () => {';
  content = content.replace(findTarget, newTestFunction + '\n\n  ' + findTarget);
}

let notificationSection = `                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-700 dark:text-zinc-300 mb-4 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-orange-500" />
                    Push Notifications
                  </h3>`;

// Check what the exact class is
// Then find where to insert the button
// Actually, let's insert it right after the Bark input fields, before the uptimecheck interval
let barkSection = `            onChange={e => setNotificationSettings({...notificationSettings, barkUrl: e.target.value})}
                        className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-zinc-800 dark:text-zinc-200"
                        placeholder="https://api.day.app/yourkey/"
                      />
                    )}`;

let testButtonUI = `
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleTestNotification}
                      disabled={testStatus === 'testing' || (!notificationSettings.ntfyEnabled && !notificationSettings.barkEnabled)}
                      className="w-full py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {testStatus === 'testing' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Test Notification'}
                    </button>
                    {testStatus === 'success' && testMessage && testMessage.includes('Notification') && (
                      <div className="mt-2 text-xs text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {testMessage}
                      </div>
                    )}
                    {testStatus === 'error' && testMessage && (!testMessage.includes('API') && !testMessage.includes('model')) && (
                      <div className="mt-2 text-xs text-red-500">
                        {testMessage}
                      </div>
                    )}
                  </div>`;

if (!content.includes('handleTestNotification}')) {
  // Try to find the Bark section
  // Let's replace the placeholder directly since we can't reliably guess the string.
  // Instead, since settings are arranged in divs under a section, let's do a more robust string replace
  let uptimeTarget = `<label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Uptime Check Interval (Minutes)</label>`;
  if (content.includes(uptimeTarget)) {
      content = content.replace(uptimeTarget, testButtonUI + '\n\n                  <div>\n                    ' + uptimeTarget);
  }
}

fs.writeFileSync('src/components/SettingsModal.tsx', content);
