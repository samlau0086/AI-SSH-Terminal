import fs from 'fs';

let content = fs.readFileSync('src/components/TerminalComponent.tsx', 'utf-8');

// 1. Add History icon
if (!content.includes('History } from')) {
  content = content.replace(
    "import { RefreshCw, Unplug, AlertCircle } from 'lucide-react';",
    "import { RefreshCw, Unplug, AlertCircle, History } from 'lucide-react';"
  );
}

// 2. Add state
if (!content.includes('isHistoryOpen')) {
  content = content.replace(
    'const [historyIndex, setHistoryIndex] = useState(-1);',
    'const [historyIndex, setHistoryIndex] = useState(-1);\n  const [isHistoryOpen, setIsHistoryOpen] = useState(false);'
  );
}

// 3. Add UI
let findFormEnd = `<button 
          type="submit" 
          disabled={status !== 'connected' || !cmdInput.trim()}
          className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded disabled:opacity-50 transition-colors uppercase font-bold tracking-widest shrink-0 mb-0.5 ml-2"
        >
          {t('chat.run' /* we can just use send/run translation */)}
        </button>`;
        
let replaceFormEnd = `<div className="relative mb-0.5 ml-1 shrink-0 flex items-center justify-center">
          <button 
            type="button" 
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1.5 transition-colors rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Command History"
          >
            <History className="w-4 h-4" />
          </button>
          
          {isHistoryOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-80 max-h-64 flex flex-col bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-50">
              <div className="p-2 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Command History</span>
                <span className="text-[10px] text-zinc-400">{history.length} items</span>
              </div>
              <div className="overflow-y-auto flex-1 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-500">No history</div>
                ) : (
                  <div className="py-1">
                    {history.map((cmd, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setCmdInput(cmd);
                          setIsHistoryOpen(false);
                          setTimeout(() => xtermRef.current?.focus(), 10);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 truncate"
                        title={cmd}
                      >
                        {cmd}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <button 
          type="submit" 
          disabled={status !== 'connected' || !cmdInput.trim()}
          className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded disabled:opacity-50 transition-colors uppercase font-bold tracking-widest shrink-0 mb-0.5 ml-2"
        >
          {t('chat.run' /* we can just use send/run translation */)}
        </button>`;

content = content.replace(findFormEnd, replaceFormEnd);

fs.writeFileSync('src/components/TerminalComponent.tsx', content);
