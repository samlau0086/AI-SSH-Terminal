import fs from 'fs';

let content = fs.readFileSync('src/components/TerminalComponent.tsx', 'utf-8');

if (!content.includes('Trash } from')) {
    content = content.replace(
        "import { RefreshCw, Unplug, AlertCircle, History } from 'lucide-react';",
        "import { RefreshCw, Unplug, AlertCircle, History, Trash } from 'lucide-react';"
    );
}

// target for header
let targetHeader = `<div className="p-2 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Command History</span>
                <span className="text-[10px] text-zinc-400">{history.length} items</span>
              </div>`;
              
let replaceHeader = `<div className="p-2 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Command History</span>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-400">{history.length} items</span>
                    {history.length > 0 && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setHistory([]); }}
                            className="text-[10px] text-red-500 hover:text-red-600 uppercase tracking-widest font-bold"
                        >
                            Clear
                        </button>
                    )}
                </div>
              </div>`;

content = content.replace(targetHeader, replaceHeader);

// target for items
let targetItems = `{history.map((cmd, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setCmdInput(cmd);
                          setIsHistoryOpen(false);
                          setTimeout(() => {
                            const ta = document.getElementById('cmd-input-textarea');
                            if (ta) ta.focus();
                          }, 10);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 truncate"
                        title={cmd}
                      >
                        {cmd}
                      </button>
                    ))}`;
                    
let replaceItems = `{history.map((cmd, i) => (
                      <div key={i} className="group relative w-full">
                        <button
                          type="button"
                          onClick={() => {
                            setCmdInput(cmd);
                            setIsHistoryOpen(false);
                            setTimeout(() => {
                              const ta = document.getElementById('cmd-input-textarea');
                              if (ta) ta.focus();
                            }, 10);
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 pr-8 truncate"
                          title={cmd}
                        >
                          {cmd}
                        </button>
                        <button
                          type="button"
                          title="Delete command"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistory(prev => prev.filter((_, idx) => idx !== i));
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shrink-0"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}`;

content = content.replace(targetItems, replaceItems);

fs.writeFileSync('src/components/TerminalComponent.tsx', content);
