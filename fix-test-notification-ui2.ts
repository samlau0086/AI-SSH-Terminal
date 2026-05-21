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

if (!content.includes('handleTestNotification')) {
  let findTarget = 'const handleTestModel = async () => {';
  content = content.replace(findTarget, newTestFunction + '\n\n  ' + findTarget);
}

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
                    {testStatus === 'success' && testMessage && testMessage.includes('Notification sent') && (
                      <div className="mt-2 text-xs text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {testMessage}
                      </div>
                    )}
                    {testStatus === 'error' && testMessage && (!testMessage.includes('API') && !testMessage.includes('model') && !testMessage.includes('Cannot ')) && (
                      <div className="mt-2 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {testMessage}
                      </div>
                    )}
                  </div>`;

if (!content.includes('Test Notification</button>')) {
  let barkTarget = `                        placeholder="https://api.day.app/yourkey/"
                      />
                    )}
                  </div>`;
  content = content.replace(barkTarget, barkTarget + '\n' + testButtonUI);
}

fs.writeFileSync('src/components/SettingsModal.tsx', content);
