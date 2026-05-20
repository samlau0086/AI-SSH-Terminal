import fs from 'fs';

let appContent = fs.readFileSync('src/App.tsx', 'utf-8');

// Insert fetchSettings next to fetchSessions
appContent = appContent.replace(
  'const fetchSessions = useCallback(async () => {',
  `const fetchSettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/settings/me', {
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.aiSettings) {
          setAiSettings(data.aiSettings);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const fetchSessions = useCallback(async () => {`
);

let fetchSettingsDef = `
  useEffect(() => {
    localStorage.setItem('ai-ssh-settings', JSON.stringify(aiSettings));
  }, [aiSettings]);
`;

// Also, when aiSettings is updated (on Save), we can save to DB without needing to use SettingsModal to do it manually.
// Wait, SettingsModal saves everything!
appContent = appContent.replace(
  `  const handleSaveSettings = (newSettings: AISettings) => {
    setAiSettings(newSettings);
    setIsSettingsOpen(false);
  };`,
  `  const handleSaveSettings = async (newSettings: AISettings, fullDataToSave: any) => {
    setAiSettings(newSettings);
    setIsSettingsOpen(false);
    
    // Attempt saving to DB
    try {
      const payloadStr = JSON.stringify({ aiSettings: newSettings, ...fullDataToSave });
      const d = btoa(encodeURIComponent(payloadStr)).split('').reverse().join('');
      await fetch('/api/settings/me', {
        method: 'POST',
        headers: { 
          'Authorization': \`Bearer \${token}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ d })
      });
    } catch (e) {
      console.error(e);
    }
  };`
);

// We need to edit SettingsModal so it passes fullDataToSave (notification settings) back to onSave,
// OR modify SettingsModal to not do the POST itself, but rely on App.tsx! Let's modify SettingsModal.
fs.writeFileSync('src/App.tsx', appContent);
