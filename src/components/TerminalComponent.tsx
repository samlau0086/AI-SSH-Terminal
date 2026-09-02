import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';
import type { Session } from '../App';
import { RefreshCw, Unplug, AlertCircle, History, Trash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import TextareaAutosize from 'react-textarea-autosize';

interface Props {
  session: Session;
  allSessions?: Session[];
  onContextUpdate: (context: string) => void;
  historySize?: number;
  multiLineCommandDelay?: number;
}

export interface TerminalRef {
  executeCommand: (cmd: string) => void;
}

const getTerminalKeySequence = (event: KeyboardEvent) => {
  if (event.ctrlKey && event.key.length === 1) {
    return String.fromCharCode(event.key.toUpperCase().charCodeAt(0) - 64);
  }

  switch (event.key) {
    case 'Enter': return '\r';
    case 'Escape': return '\x1b';
    case 'Backspace': return '\x7f';
    case 'Tab': return '\t';
    case 'ArrowUp': return '\x1b[A';
    case 'ArrowDown': return '\x1b[B';
    case 'ArrowRight': return '\x1b[C';
    case 'ArrowLeft': return '\x1b[D';
    case 'Home': return '\x1b[H';
    case 'End': return '\x1b[F';
    case 'Delete': return '\x1b[3~';
    case 'PageUp': return '\x1b[5~';
    case 'PageDown': return '\x1b[6~';
    default:
      return !event.altKey && !event.metaKey && event.key.length === 1 ? event.key : null;
  }
};

const TerminalComponent = forwardRef<TerminalRef, Props>(({ session, allSessions = [], onContextUpdate, historySize = 200, multiLineCommandDelay = 0 }, ref) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const outputBuffer = useRef<string[]>([]);
  const connectionCleanupRef = useRef<(() => void) | null>(null);
  const focusTerminalAfterCommandRef = useRef(false);
  const commandInputRef = useRef<HTMLTextAreaElement>(null);
  const terminalInputModeRef = useRef(false);
  
  const [cmdInput, setCmdInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const hasLoadedHistory = useRef(false);

  useEffect(() => {
    fetch('/api/command-history', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('ai-ssh-token')}` }
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
        'Authorization': `Bearer ${localStorage.getItem('ai-ssh-token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ d })
    }).catch(console.error);
  }, [history]);

  const runCommand = async (cmd: string) => {
    if (!socket || status !== 'connected') return;

    focusTerminalAfterCommandRef.current = true;
    terminalInputModeRef.current = true;
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }

    if (multiLineCommandDelay > 0) {
      // Split by newline and filter out entirely empty lines if needed,
      // but usually user might want empty lines. Let's send exactly what's typed.
      const lines = cmd.split('\n');
      for (let i = 0; i < lines.length; i++) {
        socket.emit('ssh-data', lines[i] + '\n');
        if (i < lines.length - 1) {
          await new Promise(resolve => setTimeout(resolve, multiLineCommandDelay));
        }
      }
    } else {
      const fullCmd = cmd.endsWith('\n') ? cmd : cmd + '\n';
      socket.emit('ssh-data', fullCmd);
    }
  };

  useImperativeHandle(ref, () => ({
    executeCommand: (cmd: string) => {
      runCommand(cmd).then(() => {
        // Let's also ensure the terminal gets focus
        setTimeout(() => {
          xtermRef.current?.focus();
        }, 100);
      });
    }
  }));

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cmdInput.trim() && socket && status === 'connected') {
      runCommand(cmdInput);
      
      setHistory(prev => {
        const newHistory = [cmdInput, ...prev.filter(c => c !== cmdInput)].slice(0, historySize);
        return newHistory;
      });
      setCmdInput('');
      setHistoryIndex(-1);

      window.setTimeout(() => xtermRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommandSubmit(e as any);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(nextIndex);
        setCmdInput(history[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setCmdInput(history[nextIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCmdInput('');
      }
    }
  };

  useEffect(() => {
    const forwardFallbackKey = (event: KeyboardEvent) => {
      if (!terminalInputModeRef.current || !socket || status !== 'connected' || event.defaultPrevented || event.isComposing) {
        return;
      }

      if (xtermRef.current?.element?.contains(document.activeElement)) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTerminalTarget = target === document.body
        || target === commandInputRef.current
        || !!(target && terminalRef.current?.contains(target));
      if (!isTerminalTarget) {
        return;
      }

      const sequence = getTerminalKeySequence(event);
      if (!sequence) return;

      event.preventDefault();
      event.stopPropagation();
      socket.emit('ssh-data', sequence);
    };

    document.addEventListener('keydown', forwardFallbackKey, true);
    return () => document.removeEventListener('keydown', forwardFallbackKey, true);
  }, [socket, status]);

  
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (xtermRef.current && fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const connect = () => {
    if (!terminalRef.current) return;

    connectionCleanupRef.current?.();
    connectionCleanupRef.current = null;
    setStatus('connecting');
    setErrorMsg('');
    outputBuffer.current = [];

    // Initialize xterm
    if (!xtermRef.current) {
      const darkTheme = {
        background: '#09090b', // zinc-950
        foreground: '#f4f4f5', // zinc-50
        cursor: '#10b981', // emerald-500
        selectionBackground: '#27272a',
        black: '#18181b',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#f4f4f5',
      };
      const lightTheme = {
        background: '#fafafa', // zinc-50
        foreground: '#09090b', // zinc-950
        cursor: '#10b981', // emerald-500
        selectionBackground: '#e4e4e7',
        black: '#ffffff',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#09090b',
      };
      const term = new Terminal({
        cursorBlink: true,
        convertEol: true,
        theme: isDark ? darkTheme : lightTheme,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: 14,
        allowTransparency: true
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();
      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      const handleResize = () => fitAddon.fit();
      window.addEventListener('resize', handleResize);
    } else {
      xtermRef.current.clear();
      outputBuffer.current = [];
    }

    // Connect to backend
    // Vite proxy handles development, but we should connect to the current origin
    const newSocket = io({
      path: '/socket.io'
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      // Configure credentials to send (NEVER print these)
      const terminalSize = xtermRef.current
        ? { cols: xtermRef.current.cols, rows: xtermRef.current.rows }
        : undefined;
      const connectOpts = {
        host: session.host,
        port: session.port,
        username: session.username,
        authType: session.authType,
        password: session.password,
        privateKey: session.privateKey,
        passphrase: session.passphrase,
        terminalSize,
        jumpHost: session.jumpHostId ? allSessions.find(s => s.id === session.jumpHostId) : null
      };
      
      newSocket.emit('ssh-connect', connectOpts);
    });

    newSocket.on('ssh-status', (stat: any) => {
      if (stat.status === 'connected' || stat.status === 'shell-ready') {
        setStatus('connected');
        terminalInputModeRef.current = true;
        if (xtermRef.current) {
          xtermRef.current.focus();
        }
      } else if (stat.status === 'error') {
        setStatus('error');
        setErrorMsg(stat.message);
        xtermRef.current?.writeln(`\x1b[31m[SSH Error] ${stat.message}\x1b[0m`);
      } else if (stat.status === 'disconnected') {
        setStatus(prev => prev === 'error' ? 'error' : 'disconnected');
        xtermRef.current?.writeln(`\x1b[33m\r\n[SSH Disconnected]\x1b[0m`);
      }
    });

    newSocket.on('ssh-data', (data: string) => {
      if (xtermRef.current) {
        xtermRef.current.write(data);

        if (focusTerminalAfterCommandRef.current) {
          focusTerminalAfterCommandRef.current = false;
          window.setTimeout(() => xtermRef.current?.focus(), 0);
        }
        
        // Track output for context (keep last 50 lines approximate)
        const lines = data.split('\n');
        outputBuffer.current = [...outputBuffer.current, ...lines].slice(-50);
        
        // Debounce context update slightly
        onContextUpdate(outputBuffer.current.join('\n'));
        xtermRef.current.scrollToBottom();
      }
    });

    const dataListener = xtermRef.current?.onData((data) => {
      if (newSocket.connected) {
        newSocket.emit('ssh-data', data);
      }
    });

    const resizeListener = xtermRef.current?.onResize((size) => {
      if (newSocket.connected) {
        newSocket.emit('ssh-resize', size);
      }
    });

    if (xtermRef.current) {
      newSocket.emit('ssh-resize', {
        cols: xtermRef.current.cols,
        rows: xtermRef.current.rows
      });
    }

    connectionCleanupRef.current = () => {
      dataListener?.dispose();
      resizeListener?.dispose();
      newSocket.disconnect();
    };

    return connectionCleanupRef.current;
  };

  useEffect(() => {
    if (xtermRef.current) {
      const darkTheme = {
        background: '#09090b',
        foreground: '#f4f4f5',
        cursor: '#10b981',
        selectionBackground: '#27272a',
        black: '#18181b',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#f4f4f5',
      };
      const lightTheme = {
        background: '#fafafa',
        foreground: '#09090b',
        cursor: '#10b981',
        selectionBackground: '#e4e4e7',
        black: '#ffffff',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#09090b',
      };
      xtermRef.current.options.theme = isDark ? darkTheme : lightTheme;
    }
  }, [isDark]);

  useEffect(() => {
    const cleanup = connect();
    
    return () => {
      cleanup?.();
      connectionCleanupRef.current = null;
    };
  }, [session.id]);

  // Clean up terminal on unmount
  useEffect(() => {
    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className="relative flex-1 bg-transparent overflow-hidden flex flex-col h-full w-full p-4">
      {status === 'connecting' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center gap-3 shadow-2xl">
            <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
            <span className="font-bold text-xs uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{t('terminal.connecting', { host: session.host })}</span>
          </div>
        </div>
      )}
      
      {status === 'error' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white dark:bg-[#18181b] border border-red-900/30 p-5 rounded-xl max-w-sm flex flex-col gap-3 shadow-2xl">
            <div className="flex items-center gap-2 text-red-500 font-bold uppercase tracking-widest text-xs">
              <AlertCircle className="w-4 h-4" />
              <span>{t('terminal.connectionFailed')}</span>
            </div>
            <p className="text-sm text-zinc-500 text-zinc-500 dark:text-zinc-400 font-mono">{errorMsg}</p>
            <button 
              onClick={connect}
              className="mt-2 w-full py-2 bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-xs font-bold uppercase tracking-widest text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              {t('terminal.retryConnection')}
            </button>
          </div>
        </div>
      )}

      {status === 'disconnected' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl max-w-sm flex flex-col gap-3 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500 text-zinc-500 dark:text-zinc-400">
              <Unplug className="w-6 h-6" />
            </div>
            <div className="font-bold uppercase tracking-widest text-zinc-700 dark:text-zinc-300 text-sm">{t('terminal.sessionDisconnected')}</div>
            <button 
              onClick={connect}
              className="mt-2 w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
            >
              {t('terminal.reconnect')}
            </button>
          </div>
        </div>
      )}

      <div
        ref={terminalRef}
        onMouseDown={() => {
          terminalInputModeRef.current = true;
          xtermRef.current?.focus();
        }}
        className="flex-1 w-full min-h-0 overflow-hidden"
      />
      
      {/* Command Input Bar */}
      <form 
        onSubmit={handleCommandSubmit}
        onFocusCapture={() => { terminalInputModeRef.current = false; }}
        className="mt-2 shrink-0 flex items-end bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-md p-1 relative z-10"
      >
        <span className="text-zinc-500 font-mono text-xs ml-2 mr-2 shrink-0 mb-2">$</span>
        <TextareaAutosize
          id="cmd-input-textarea"
          ref={commandInputRef}
          value={cmdInput}
          onChange={e => setCmdInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('terminal.typeCommand')}
          minRows={1}
          maxRows={6}
          className="flex-1 bg-transparent border-none outline-none text-zinc-700 dark:text-zinc-300 font-mono text-xs placeholder:dark:text-zinc-600 disabled:opacity-50 resize-none py-1.5"
          disabled={status !== 'connected'}
        />
        <div className="relative mb-0.5 ml-1 shrink-0 flex items-center justify-center">
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
              </div>
              <div className="overflow-y-auto flex-1 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-500">No history</div>
                ) : (
                  <div className="py-1">
                    {history.map((cmd, i) => (
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
        </button>
      </form>
    </div>
  );
});

export default TerminalComponent;
