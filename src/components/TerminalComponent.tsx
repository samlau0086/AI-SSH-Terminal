import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';
import type { Session } from '../App';
import { RefreshCw, Unplug, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  session: Session;
  onContextUpdate: (context: string) => void;
}

export interface TerminalRef {
  executeCommand: (cmd: string) => void;
}

const TerminalComponent = forwardRef<TerminalRef, Props>(({ session, onContextUpdate }, ref) => {
  const { t } = useTranslation();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const outputBuffer = useRef<string[]>([]);
  
  useImperativeHandle(ref, () => ({
    executeCommand: (cmd: string) => {
      // If we are connected and socket exists, send the command + newline
      if (socket && status === 'connected') {
        const fullCmd = cmd.endsWith('\n') ? cmd : cmd + '\n';
        socket.emit('ssh-data', fullCmd);
        
        // Let's also ensure the terminal gets focus
        setTimeout(() => {
          xtermRef.current?.focus();
        }, 100);
      }
    }
  }));
  
  const connect = () => {
    if (!terminalRef.current) return;

    setStatus('connecting');
    setErrorMsg('');
    outputBuffer.current = [];

    // Initialize xterm
    if (!xtermRef.current) {
      const term = new Terminal({
        cursorBlink: true,
        theme: {
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
        },
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: 14,
        allowTransparency: true
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();
      xtermRef.current = term;

      const handleResize = () => fitAddon.fit();
      window.addEventListener('resize', handleResize);
    } else {
      xtermRef.current.clear();
    }

    // Connect to backend
    // Vite proxy handles development, but we should connect to the current origin
    const newSocket = io({
      path: '/socket.io'
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      // Configure credentials to send (NEVER print these)
      const connectOpts = {
        host: session.host,
        port: session.port,
        username: session.username,
        authType: session.authType,
        password: session.password,
        privateKey: session.privateKey,
        passphrase: session.passphrase
      };
      
      newSocket.emit('ssh-connect', connectOpts);
    });

    newSocket.on('ssh-status', (stat: any) => {
      if (stat.status === 'connected' || stat.status === 'shell-ready') {
        setStatus('connected');
        if (xtermRef.current) {
          xtermRef.current.focus();
        }
      } else if (stat.status === 'error') {
        setStatus('error');
        setErrorMsg(stat.message);
        xtermRef.current?.writeln(`\x1b[31m[SSH Error] ${stat.message}\x1b[0m`);
      } else if (stat.status === 'disconnected') {
        setStatus('disconnected');
        xtermRef.current?.writeln(`\x1b[33m\r\n[SSH Disconnected]\x1b[0m`);
      }
    });

    newSocket.on('ssh-data', (data: string) => {
      if (xtermRef.current) {
        xtermRef.current.write(data);
        
        // Track output for context (keep last 50 lines approximate)
        const lines = data.split('\n');
        outputBuffer.current = [...outputBuffer.current, ...lines].slice(-50);
        
        // Debounce context update slightly
        onContextUpdate(outputBuffer.current.join('\n'));
      }
    });

    xtermRef.current?.onData((data) => {
      if (newSocket.connected && status === 'connected') {
        newSocket.emit('ssh-data', data);
      }
    });

    xtermRef.current?.onResize((size) => {
      newSocket.emit('ssh-resize', size);
    });

    return () => {
      newSocket.disconnect();
    };
  };

  useEffect(() => {
    connect();
    
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [session]);

  // Clean up terminal on unmount
  useEffect(() => {
    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className="relative flex-1 bg-transparent overflow-hidden flex flex-col h-full w-full">
      {status === 'connecting' && (
        <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#18181b] border border-zinc-800 p-4 rounded-xl flex items-center gap-3 shadow-2xl">
            <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
            <span className="font-bold text-xs uppercase tracking-widest text-zinc-300">{t('terminal.connecting', { host: session.host })}</span>
          </div>
        </div>
      )}
      
      {status === 'error' && (
        <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#18181b] border border-red-900/30 p-5 rounded-xl max-w-sm flex flex-col gap-3 shadow-2xl">
            <div className="flex items-center gap-2 text-red-500 font-bold uppercase tracking-widest text-xs">
              <AlertCircle className="w-4 h-4" />
              <span>{t('terminal.connectionFailed')}</span>
            </div>
            <p className="text-sm text-zinc-400 font-mono">{errorMsg}</p>
            <button 
              onClick={connect}
              className="mt-2 w-full py-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg text-xs font-bold uppercase tracking-widest text-zinc-300 transition-colors"
            >
              {t('terminal.retryConnection')}
            </button>
          </div>
        </div>
      )}

      {status === 'disconnected' && (
        <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#18181b] border border-zinc-800 p-5 rounded-xl max-w-sm flex flex-col gap-3 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <Unplug className="w-6 h-6" />
            </div>
            <div className="font-bold uppercase tracking-widest text-zinc-300 text-sm">{t('terminal.sessionDisconnected')}</div>
            <button 
              onClick={connect}
              className="mt-2 w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
            >
              {t('terminal.reconnect')}
            </button>
          </div>
        </div>
      )}

      <div ref={terminalRef} className="flex-1 w-full h-full" />
    </div>
  );
});

export default TerminalComponent;
