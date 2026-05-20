import fs from 'fs';

let content = fs.readFileSync('src/components/TerminalComponent.tsx', 'utf-8');

const target1 = `  const [history, setHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('ai-ssh-cmd-history');
    return saved ? JSON.parse(saved) : [];
  });
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('ai-ssh-cmd-history', JSON.stringify(history));
  }, [history]);`;

const replace1 = `  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const hasLoadedHistory = useRef(false);

  useEffect(() => {
    fetch('/api/command-history', {
      headers: { 'Authorization': \`Bearer \${localStorage.getItem('ai-ssh-token')}\` }
    })
    .then(r => r.json())
    .then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setHistory(data);
      } else {
        const saved = localStorage.getItem('ai-ssh-cmd-history');
        if (saved) {
           const parsed = JSON.parse(saved);
           if (Array.isArray(parsed) && parsed.length > 0) setHistory(parsed);
        }
      }
      hasLoadedHistory.current = true;
    })
    .catch(console.error);
  }, []);

  useEffect(() => {
    if (!hasLoadedHistory.current) return;
    
    // Fallback to local storage for quick reload
    localStorage.setItem('ai-ssh-cmd-history', JSON.stringify(history));

    const payloadStr = JSON.stringify({ history });
    const d = btoa(encodeURIComponent(payloadStr)).split('').reverse().join('');
    
    fetch('/api/command-history', {
      method: 'POST',
      headers: { 
        'Authorization': \`Bearer \${localStorage.getItem('ai-ssh-token')}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ d })
    }).catch(console.error);
  }, [history]);`;

content = content.replace(target1, replace1);

fs.writeFileSync('src/components/TerminalComponent.tsx', content);
