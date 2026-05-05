import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TerminalSquare, MessageSquare, Save, Settings, Plus, Play, Tag, Edit, Trash, X, Bot, Globe, LogOut, Users } from 'lucide-react';
import { cn } from './lib/utils';
import TerminalComponent, { TerminalRef } from './components/TerminalComponent';
import AIChatComponent from './components/AIChatComponent';
import SessionForm from './components/SessionForm';
import SettingsModal, { AISettings } from './components/SettingsModal';
import AuthPage from './components/AuthPage';
import AdminModal from './components/AdminModal';
import { useTranslation } from 'react-i18next';
import { useAuth } from './contexts/AuthContext';

export interface Session {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'privateKey';
  password?: string;
  privateKey?: string;
  passphrase?: string;
  tags: string[];
  notes: string;
}

export default function App() {
  const { t, i18n } = useTranslation();
  const { user, token, logout, isLoading } = useAuth();
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem('ai-ssh-settings');
    return saved ? JSON.parse(saved) : { provider: 'gemini', apiKey: '', baseUrl: '', model: 'gemini-2.5-pro' };
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isEditingSession, setIsEditingSession] = useState<Session | Partial<Session> | null>(null);
  const [terminalContext, setTerminalContext] = useState<string>('');
  const terminalRef = useRef<TerminalRef>(null);

  const fetchSessions = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    }
  }, [token]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    localStorage.setItem('ai-ssh-settings', JSON.stringify(aiSettings));
  }, [aiSettings]);

  const saveSession = async (sessionData: Session) => {
    const isNew = !sessions.find(s => s.id === sessionData.id);
    const id = sessionData.id || uuidv4();
    const payload = { ...sessionData, id };

    try {
      const method = isNew ? 'POST' : 'PUT';
      const endpoint = isNew ? '/api/sessions' : `/api/sessions/${id}`;
      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        if (isNew) {
          setSessions([...sessions, payload]);
        } else {
          setSessions(sessions.map(s => s.id === id ? payload : s));
        }
        setIsEditingSession(null);
      }
    } catch (err) {
      console.error('Failed to save session', err);
    }
  };

  const deleteSession = async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSessions(sessions.filter(s => s.id !== id));
        if (activeSession?.id === id) setActiveSession(null);
      }
    } catch (err) {
      console.error('Failed to delete session', err);
    }
  };

  if (isLoading) {
    return <div className="h-screen w-full bg-[#09090b] text-zinc-400 flex items-center justify-center font-mono">Loading...</div>;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="flex h-screen w-full bg-[#09090b] text-zinc-400 font-sans p-4 gap-4 overflow-hidden">
      {/* Left Sidebar: Sessions */}
      <aside className="w-64 flex flex-col gap-4 shrink-0">
        <div className="h-12 bg-[#18181b] border border-zinc-800 rounded-xl flex items-center px-4 gap-3 shrink-0">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-xs font-bold text-zinc-500 tracking-widest ml-auto">{t('app.title')}</span>
          <button
            onClick={() => {
              const newLang = i18n.language === 'en' ? 'zh' : 'en';
              i18n.changeLanguage(newLang);
              localStorage.setItem('ai-ssh-lang', newLang);
            }}
            className="text-zinc-500 hover:text-zinc-300 ml-2"
            title={i18n.language === 'en' ? t('app.langZh') : t('app.langEn')}
          >
            <Globe className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-zinc-500 hover:text-zinc-300 ml-2"
            title={t('app.settings')}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => setIsAdminOpen(true)}
              className="text-zinc-500 hover:text-emerald-400 ml-2"
              title={t('auth.adminDashboard')}
            >
              <Users className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={logout}
            className="text-zinc-500 hover:text-red-400 ml-2"
            title={t('app.logout')}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
        
        <div className="flex-1 bg-[#18181b] border border-zinc-800 rounded-xl p-4 flex flex-col gap-4 overflow-hidden">
          <div className="flex justify-between items-center shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t('app.savedSessions')}</h2>
            <button 
              onClick={() => setIsEditingSession({ authType: 'password', port: 22, tags: [] })}
              className="text-zinc-500 hover:text-white transition-colors flex items-center justify-center p-1"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {sessions.length === 0 ? (
              <div className="p-4 text-center text-sm text-zinc-500">
                {t('app.noSavedSessions')}
              </div>
            ) : (
              sessions.map(session => (
                <div 
                  key={session.id}
                  className={cn(
                    "p-3 rounded-lg border transition-colors cursor-pointer group",
                    activeSession?.id === session.id 
                      ? "bg-zinc-800/50 border-zinc-700" 
                      : "border-transparent hover:bg-zinc-800/30"
                  )}
                  onClick={() => setActiveSession(session)}
                >
                  <div className="flex justify-between text-sm font-medium items-center">
                    <span className={activeSession?.id === session.id ? "text-zinc-200" : "text-zinc-400 group-hover:text-zinc-300"}>
                      {session.name || session.host}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setIsEditingSession(session); }}
                        className="text-zinc-500 hover:text-zinc-300 hidden group-hover:block"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                        className="text-zinc-500 hover:text-red-400 hidden group-hover:block"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] mt-1 text-zinc-600 truncate">
                    {session.username}@{session.host}:{session.port}
                  </p>
                  {session.tags && session.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {session.tags.map(tag => (
                        <span key={tag} className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          
          <div className="mt-auto p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg shrink-0">
            <p className="text-[10px] text-indigo-300 uppercase tracking-tighter font-bold">{t('app.aiAssistant')}</p>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{t('app.aiReady')}</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col gap-4 min-w-0">
        {activeSession ? (
          <>
            {/* Connection Bar */}
            <div className="h-12 bg-[#18181b] border border-zinc-800 rounded-xl flex items-center px-6 gap-4 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-sm text-zinc-200 font-mono">{activeSession.username}@{activeSession.host}</span>
              </div>
              <div className="h-4 w-px bg-zinc-800 hidden sm:block"></div>
              <div className="hidden sm:flex gap-2">
                <span className="px-2 py-1 bg-zinc-800 text-[10px] rounded text-zinc-400 font-mono">{t('app.port')}: {activeSession.port}</span>
                <span className="px-2 py-1 bg-zinc-800 text-[10px] rounded text-zinc-400 font-mono">{activeSession.authType}</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button 
                  onClick={() => setActiveSession(null)}
                  className="text-zinc-500 hover:text-zinc-300 rounded-md transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Terminal Window */}
            <div className="flex-1 bg-black border border-zinc-800 rounded-xl p-4 font-mono text-sm overflow-hidden flex flex-col relative w-full h-full max-h-full">
              <TerminalComponent 
                ref={terminalRef}
                session={activeSession} 
                onContextUpdate={setTerminalContext}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 bg-[#18181b] border border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-4 text-zinc-500 p-8">
             <TerminalSquare className="w-16 h-16 opacity-20 mb-4" />
             <div className="text-center space-y-2">
               <h3 className="text-zinc-300 font-medium tracking-widest text-xs uppercase font-bold">{t('app.noActiveSession')}</h3>
               <p className="text-sm">{t('app.selectSessionHint')}</p>
             </div>
          </div>
        )}
      </main>

      {/* Right Sidebar: AI Chat */}
      {activeSession ? (
        <aside className="w-[340px] xl:w-[380px] shrink-0 flex flex-col gap-4">
          <div className="flex-1 bg-[#18181b] border border-zinc-800 rounded-xl flex flex-col overflow-hidden max-h-full">
            <AIChatComponent 
              terminalContext={terminalContext} 
              onExecuteCommand={(cmd) => terminalRef.current?.executeCommand(cmd)}
              aiSettings={aiSettings}
            />
          </div>
        </aside>
      ) : (
        <aside className="w-[340px] xl:w-[380px] shrink-0 flex flex-col gap-4">
           <div className="h-48 bg-[#18181b] border border-zinc-800 rounded-xl p-4 flex flex-col opacity-50">
             <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">{t('app.workspace')}</h2>
             <div className="flex-1 flex items-center justify-center text-sm text-zinc-600 font-mono">{t('app.standbyMode')}</div>
           </div>
           <div className="flex-1 bg-[#18181b] border border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center opacity-50 text-center gap-3">
              <Bot className="w-8 h-8 text-zinc-600" />
              <p className="text-xs text-zinc-500">{t('app.connectToChat')}</p>
           </div>
        </aside>
      )}

      {isEditingSession && (
        <SessionForm 
          session={isEditingSession as Partial<Session>} 
          onSave={saveSession} 
          onClose={() => setIsEditingSession(null)} 
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          settings={aiSettings}
          onSave={(newSettings) => {
            setAiSettings(newSettings);
            setIsSettingsOpen(false);
          }}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {isAdminOpen && <AdminModal onClose={() => setIsAdminOpen(false)} />}
    </div>
  );
}
