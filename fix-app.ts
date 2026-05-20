import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Insert fetchSettings next to fetchSessions
content = content.replace(
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

let findText = `onSave={(newSettings) => {
            setAiSettings(newSettings);
            setIsSettingsOpen(false);
          }}`;

let replaceText = `onSave={(newSettings, fullDataToSave) => {
            setAiSettings(newSettings);
            setIsSettingsOpen(false);
            
            if (fullDataToSave) {
              const payloadStr = JSON.stringify({ aiSettings: newSettings, ...fullDataToSave });
              const d = btoa(encodeURIComponent(payloadStr)).split('').reverse().join('');
              fetch('/api/settings/me', {
                method: 'POST',
                headers: { 
                  'Authorization': \`Bearer \${token}\`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ d })
              }).catch(console.error);
            }
          }}`;

content = content.replace(findText, replaceText);

fs.writeFileSync('src/App.tsx', content);
