import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TerminalSquare, MessageSquare, Save, Settings, Plus, Play, Tag, Edit, Trash, X, Bot, Globe, LogOut, Users, Search, Archive, Sun, Moon, LayoutTemplate } from 'lucide-react';
import { cn } from './lib/utils';
import TerminalComponent, { TerminalRef } from './components/TerminalComponent';
import QuickCommands from './components/QuickCommands';
import { CheckSquare, Square } from 'lucide-react';
import SessionInfoPanel from './components/SessionInfoPanel';
import AIChatComponent from './components/AIChatComponent';
import SessionForm from './components/SessionForm';
import SettingsModal, { AISettings } from './components/SettingsModal';
import ImportExportModal from './components/ImportExportModal';
import AuthPage from './components/AuthPage';
import AdminModal from './components/AdminModal';
import SmartMacroAgent from './components/SmartMacroAgent';
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
  expirationDate?: string;
  renewalCycle?: string;
  uptimeMonitorEnabled?: boolean;
}

const getExpirationInfo = (expirationDate?: string, cycleInMonths?: string) => {
  if (!expirationDate) return null;
  const expDate = new Date(expirationDate);
  const now = new Date();
  const msLeft = expDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  
  if (daysLeft < 0) return { text: `Expired (${expDate.toLocaleDateString()})`, color: 'text-red-600 font-bold' };
  
  let percent = 100;
  if (cycleInMonths && cycleInMonths !== 'none') {
    const cycleMonths = parseInt(cycleInMonths);
    const startDate = new Date(expDate);
    startDate.setMonth(startDate.getMonth() - cycleMonths);
    const totalMs = expDate.getTime() - startDate.getTime();
    percent = (msLeft / totalMs) * 100;
  } else {
    // default cycle to 1 year if not provided
    const totalMs = 365 * 24 * 60 * 60 * 1000;
    percent = (msLeft / totalMs) * 100;
  }
  
  let color = 'text-emerald-500';
  if (percent <= 10) color = 'text-red-600 font-bold';
  else if (percent <= 20) color = 'text-red-400';
  else if (percent <= 30) color = 'text-orange-500';
  else if (percent <= 50) color = 'text-yellow-500';
  
  return { text: `Exp: ${expDate.toLocaleDateString()} (${daysLeft}d left)`, color };
};

export default function App() {
  const { t, i18n } = useTranslation();
  const { user, token, logout, isLoading } = useAuth();
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem('ai-ssh-settings');
    const parsed = saved ? JSON.parse(saved) : { provider: 'gemini', apiKey: '', baseUrl: '', model: 'gemini-2.5-pro' };
    if (!parsed.commandHistorySize) parsed.commandHistorySize = 200;
    if (!parsed.statsRefreshInterval) parsed.statsRefreshInterval = 10000;
    return parsed;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('ai-ssh-theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('ai-ssh-theme', theme);
  }, [theme]);

  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [tabs, setTabs] = useState<{id: string, session: Session}[]>(() => {
    const saved = localStorage.getItem('ai-ssh-tabs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [activeTabId, setActiveTabId] = useState<string | null>(() => {
    return localStorage.getItem('ai-ssh-active-tab') || null;
  });
  
  // Restore active session on load if tabs exist
  useEffect(() => {
    if (tabs.length > 0 && activeTabId) {
      const tab = tabs.find(t => t.id === activeTabId);
      if (tab) {
        setActiveSession(tab.session);
      }
    }
  }, []); // Only on mount

  useEffect(() => {
    localStorage.setItem('ai-ssh-tabs', JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    if (activeTabId) {
      localStorage.setItem('ai-ssh-active-tab', activeTabId);
    } else {
      localStorage.removeItem('ai-ssh-active-tab');
    }
  }, [activeTabId]);

  const [isEditingSession, setIsEditingSession] = useState<Session | Partial<Session> | null>(null);
  const [terminalContexts, setTerminalContexts] = useState<Record<string, string>>({});
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkedSessionIds, setCheckedSessionIds] = useState<string[]>([]);
  const terminalRefs = useRef<Record<string, TerminalRef>>({});
  const [activeSmartMacroGoal, setActiveSmartMacroGoal] = useState<string | null>(null);

  // Resizable Sidebars Logic
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('ai-ssh-left-width');
    return saved ? parseInt(saved, 10) : 350;
  });
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('ai-ssh-right-width');
    return saved ? parseInt(saved, 10) : 380;
  });
  const [bottomPanelHeight, setBottomPanelHeight] = useState(() => {
    const saved = localStorage.getItem('ai-ssh-bottom-height');
    return saved ? parseInt(saved, 10) : 180;
  });
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isResizingMain, setIsResizingMain] = useState(false);

  useEffect(() => {
    localStorage.setItem('ai-ssh-left-width', leftSidebarWidth.toString());
  }, [leftSidebarWidth]);

  useEffect(() => {
    localStorage.setItem('ai-ssh-right-width', rightSidebarWidth.toString());
  }, [rightSidebarWidth]);

  useEffect(() => {
    localStorage.setItem('ai-ssh-bottom-height', bottomPanelHeight.toString());
  }, [bottomPanelHeight]);

  const resetLayout = useCallback(() => {
    setLeftSidebarWidth(350);
    setRightSidebarWidth(380);
    setBottomPanelHeight(180);
  }, []);

  const startResizingLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
  }, []);

  const startResizingRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
  }, []);

  const startResizingMain = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingMain(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizingLeft(false);
    setIsResizingRight(false);
    setIsResizingMain(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizingLeft) {
      const newWidth = e.clientX - 16; 
      if (newWidth > 200 && newWidth < 600) {
        setLeftSidebarWidth(newWidth);
      }
    }
    if (isResizingRight) {
      const newWidth = window.innerWidth - e.clientX - 16;
      if (newWidth > 250 && newWidth < 600) {
        setRightSidebarWidth(newWidth);
      }
    }
    if (isResizingMain) {
      const newHeight = window.innerHeight - e.clientY - 32; // Adjust for p-4 padding
      if (newHeight > 100 && newHeight < 500) {
        setBottomPanelHeight(newHeight);
      }
    }
  }, [isResizingLeft, isResizingRight, isResizingMain]);

  useEffect(() => {
    if (isResizingLeft || isResizingRight || isResizingMain) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizingLeft, isResizingRight, isResizingMain, resize, stopResizing]);

  const fetchSessions = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error(`Fetch sessions failed: ${res.status} ${res.statusText}`, errData);
      }
    } catch (err) {
      console.error('Failed to fetch /api/sessions:', err);
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
          setSessions(prev => [...prev, payload]);
        } else {
          setSessions(prev => prev.map(s => s.id === id ? payload : s));
        }
        setIsEditingSession(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error(`Save session failed: ${res.status} ${res.statusText}`, errData);
      }
    } catch (err) {
      console.error(`Failed to save session to ${isNew ? '/api/sessions' : `/api/sessions/${id}`}:`, err);
    }
  };

  const handleImportSessions = async (importedSessions: Session[]) => {
    if (!token) return;
    let isAnySuccess = false;
    for (const session of importedSessions) {
      const isNew = !sessions.find(s => s.id === session.id);
      const id = session.id || uuidv4();
      const payload = { ...session, id };

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
          isAnySuccess = true;
        }
      } catch (err) {
        console.error('Failed to import session', err);
      }
    }
    if (isAnySuccess) {
      fetchSessions();
    }
  };

  const openTab = (session: Session) => {
    const existingTab = tabs.find(t => t.session.id === session.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      setActiveSession(existingTab.session);
    } else {
      setActiveSession(session);
      const newTabId = uuidv4();
      setTabs(prev => [...prev, { id: newTabId, session }]);
      setActiveTabId(newTabId);
    }
  };

  const closeTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        if (newTabs.length > 0) {
          setActiveTabId(newTabs[newTabs.length - 1].id);
          setActiveSession(newTabs[newTabs.length - 1].session);
        } else {
          setActiveTabId(null);
          setActiveSession(null);
        }
      }
      return newTabs;
    });
    setTerminalContexts(prev => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
  };

  const deleteSession = async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSessions(sessions.filter(s => s.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete session', err);
    }
  };

  if (isLoading) {
    return <div className="h-screen w-full bg-zinc-50 dark:bg-[#09090b] text-zinc-500 text-zinc-500 dark:text-zinc-400 flex items-center justify-center font-mono">Loading...</div>;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className={cn(
      "flex h-screen w-full bg-zinc-50 dark:bg-[#09090b] text-zinc-500 text-zinc-500 dark:text-zinc-400 font-sans p-4 gap-0 overflow-hidden",
      (isResizingLeft || isResizingRight || isResizingMain) && "select-none",
      (isResizingLeft || isResizingRight) && "cursor-col-resize",
      isResizingMain && "cursor-row-resize"
    )}>
      {/* Left Sidebar: Sessions */}
      <aside 
        style={{ width: `${leftSidebarWidth}px` }} 
        className="flex flex-col gap-4 shrink-0"
      >
        <div className="h-12 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center px-4 gap-3 shrink-0">
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
            className="text-zinc-500 hover:dark:text-zinc-300 ml-2"
            title={i18n.language === 'en' ? t('app.langZh') : t('app.langEn')}
          >
            <Globe className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="text-zinc-500 hover:dark:text-zinc-300 ml-2"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={resetLayout}
            className="text-zinc-500 hover:dark:text-zinc-300 ml-2"
            title={t('app.resetLayout') || 'Reset Layout'}
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-zinc-500 hover:dark:text-zinc-300 ml-2"
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
        
        <div className="flex-1 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col gap-4">
          <div className="flex justify-between items-center shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t('app.savedSessions')}</h2>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsImportExportOpen(true)}
                className="text-zinc-500 hover:text-indigo-400 transition-colors flex items-center justify-center p-1"
                title="Import/Export Sessions"
              >
                <Archive className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsEditingSession({ authType: 'password', port: 22, tags: [] })}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors flex items-center justify-center p-1"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-zinc-500" />
            </div>
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-md text-zinc-700 dark:text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          
          {/* Tag Filter */}
          {Array.from(new Set(sessions.flatMap(s => s.tags || []))).length > 0 && (
            <div className="flex flex-wrap gap-1.5 shrink-0">
              {Array.from(new Set(sessions.flatMap(s => s.tags || []))).map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={cn(
                    "px-2 py-0.5 text-[10px] rounded uppercase font-bold tracking-tighter transition-colors border",
                    selectedTag === tag 
                      ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/50" 
                      : "bg-zinc-50 dark:bg-[#09090b] text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:dark:text-zinc-300"
                  )}
                >
                  <div className="flex items-center gap-1">
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                  </div>
                </button>
              ))}
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {sessions.filter(s => {
              const matchesTag = !selectedTag || (s.tags && s.tags.includes(selectedTag));
              const matchesSearch = !searchQuery || 
                (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase())) || 
                (s.host && s.host.toLowerCase().includes(searchQuery.toLowerCase()));
              return matchesTag && matchesSearch;
            }).length === 0 ? (
              <div className="p-4 text-center text-sm text-zinc-500">
                {t('app.noSavedSessions')}
              </div>
            ) : (
              sessions.filter(s => {
                const matchesTag = !selectedTag || (s.tags && s.tags.includes(selectedTag));
                const matchesSearch = !searchQuery || 
                  (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase())) || 
                  (s.host && s.host.toLowerCase().includes(searchQuery.toLowerCase()));
                return matchesTag && matchesSearch;
              }).map(session => (
                <div 
                  key={session.id}
                  className={cn(
                    "p-3 rounded-lg border transition-colors cursor-pointer group hover:bg-zinc-100 dark:hover:bg-zinc-800/30",
                     "border-transparent"
                  )}
                  onClick={() => openTab(session)}
                >
                  <div className="flex justify-between text-sm font-medium items-center">
                    <div className="flex items-center gap-2">
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           setCheckedSessionIds(prev => 
                             prev.includes(session.id) ? prev.filter(id => id !== session.id) : [...prev, session.id]
                           );
                         }}
                         className="text-zinc-500 hover:text-indigo-400 transition-colors"
                      >
                         {checkedSessionIds.includes(session.id) ? <CheckSquare className="w-3.5 h-3.5 text-indigo-400" /> : <Square className="w-3.5 h-3.5" />}
                      </button>
                      <span className="text-zinc-500 text-zinc-500 dark:text-zinc-400 group-hover:dark:text-zinc-300">
                        {session.name || session.host}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setIsEditingSession(session); }}
                        className="text-zinc-500 hover:dark:text-zinc-300 hidden group-hover:block"
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
                  <div className="flex flex-col gap-1 mt-1">
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {session.username}@{session.host}:{session.port}
                    </p>
                    {(() => {
                      const expInfo = getExpirationInfo(session.expirationDate, session.renewalCycle);
                      if (!expInfo) return null;
                      return (
                        <p className={cn("text-[10px] truncate", expInfo.color)}>
                          {expInfo.text}
                        </p>
                      );
                    })()}
                  </div>
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
          
          <QuickCommands 
            onExecuteActive={(cmd) => {
              if (activeTabId && terminalRefs.current[activeTabId]) {
                 terminalRefs.current[activeTabId].executeCommand(cmd);
              }
            }} 
            onRunSmartMacro={(goal) => {
              if (activeTabId) {
                setActiveSmartMacroGoal(goal);
              } else {
                alert("Please open a terminal session first.");
              }
            }}
            checkedSessionIds={checkedSessionIds}
            sessions={sessions}
            hasActiveSession={!!activeSession}
          />
        </div>
      </aside>

      {/* Left Resizer */}
      <div 
        onMouseDown={startResizingLeft}
        className={cn(
          "w-4 group relative cursor-col-resize flex items-center justify-center transition-all bg-transparent z-10",
          isResizingLeft && "bg-indigo-500/5"
        )}
      >
        <div className={cn(
          "w-[1px] h-32 bg-zinc-800 transition-colors group-hover:bg-indigo-500/50 group-hover:h-full",
          isResizingLeft && "bg-indigo-500 h-full"
        )} />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col gap-0 min-w-0">
        {tabs.length > 0 ? (
          <>
            {/* Tabs Bar */}
            <div className="h-10 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center px-2 shrink-0 overflow-x-auto custom-scrollbar gap-1 mb-4">
               {tabs.map((tab) => (
                 <div
                   key={tab.id}
                   onClick={() => {
                     setActiveTabId(tab.id);
                     setActiveSession(tab.session);
                   }}
                   className={cn(
                     "px-4 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap shrink-0",
                     activeTabId === tab.id 
                       ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" 
                       : "text-zinc-500 hover:dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                   )}
                 >
                   <span className={cn("w-2 h-2 rounded-full", activeTabId === tab.id ? "bg-emerald-500" : "bg-zinc-600")}></span>
                   {tab.session.name || tab.session.host}
                   <button 
                     onClick={(e) => closeTab(e, tab.id)}
                     className="ml-2 hover:text-zinc-900 dark:hover:text-white p-0.5 rounded-md hover:bg-zinc-700/50"
                   >
                     <X className="w-3 h-3" />
                   </button>
                 </div>
               ))}
            </div>

            {/* Terminal Container */}
            <div className="flex-1 bg-zinc-950 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-0 font-mono text-sm overflow-hidden flex flex-col relative w-full min-h-0">
               {tabs.map((tab) => (
                 <div 
                   key={tab.id} 
                   className={cn(
                     "w-full h-full flex flex-col min-h-0",
                     activeTabId === tab.id ? "flex" : "hidden"
                   )}
                 >
                   <TerminalComponent 
                     ref={el => { if (el) terminalRefs.current[tab.id] = el; }}
                     session={tab.session} 
                     onContextUpdate={ctx => setTerminalContexts(prev => ({...prev, [tab.id]: ctx}))}
                     historySize={aiSettings.commandHistorySize}
                     multiLineCommandDelay={aiSettings.multiLineCommandDelay}
                   />
                 </div>
               ))}
            </div>

            {/* Main Content Resizer */}
            <div 
              onMouseDown={startResizingMain}
              className={cn(
                "h-4 group relative cursor-row-resize flex items-center justify-center transition-all bg-transparent z-10",
                isResizingMain && "bg-indigo-500/5"
              )}
            >
              <div className={cn(
                "h-[1px] w-32 bg-zinc-800 transition-colors group-hover:bg-indigo-500/50 group-hover:w-full",
                isResizingMain && "bg-indigo-500 w-full"
              )} />
            </div>
            
            {/* Session Info Panel (CPU/Memory/Upload) */}
            <div 
              style={{ height: `${bottomPanelHeight}px` }}
              className="shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xl"
            >
               <SessionInfoPanel session={activeSession!} refreshInterval={aiSettings.statsRefreshInterval} />
            </div>
          </>
        ) : (
          <div className="flex-1 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-4 text-zinc-500 p-8">
             <TerminalSquare className="w-16 h-16 opacity-20 mb-4" />
             <div className="text-center space-y-2">
               <h3 className="text-zinc-700 dark:text-zinc-300 font-medium tracking-widest text-xs uppercase font-bold">{t('app.noActiveSession')}</h3>
               <p className="text-sm">{t('app.selectSessionHint')}</p>
             </div>
          </div>
        )}
      </main>

      {/* Right Resizer */}
      <div 
        onMouseDown={startResizingRight}
        className={cn(
          "w-4 group relative cursor-col-resize flex items-center justify-center transition-all bg-transparent z-10",
          isResizingRight && "bg-indigo-500/5"
        )}
      >
        <div className={cn(
          "w-[1px] h-32 bg-zinc-800 transition-colors group-hover:bg-indigo-500/50 group-hover:h-full",
          isResizingRight && "bg-indigo-500 h-full"
        )} />
      </div>

      {/* Right Sidebar: AI Chat */}
      {tabs.length > 0 ? (
        <aside 
          style={{ width: `${rightSidebarWidth}px` }}
          className="shrink-0 flex flex-col gap-4 relative z-20"
        >
          <div className="flex-1 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col overflow-hidden max-h-full">
            <AIChatComponent 
              terminalContext={activeTabId ? terminalContexts[activeTabId] || '' : ''} 
              onExecuteCommand={(cmd) => {
                 if (activeTabId && terminalRefs.current[activeTabId]) {
                    terminalRefs.current[activeTabId].executeCommand(cmd);
                 }
              }}
              aiSettings={aiSettings}
            />
          </div>
        </aside>
      ) : (
        <aside 
          style={{ width: `${rightSidebarWidth}px` }}
          className="shrink-0 flex flex-col gap-4 relative z-20"
        >
           <div className="h-48 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col opacity-50">
             <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">{t('app.workspace')}</h2>
             <div className="flex-1 flex items-center justify-center text-sm text-zinc-500 text-zinc-500 dark:text-zinc-400 font-mono">{t('app.standbyMode')}</div>
           </div>
           <div className="flex-1 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center opacity-50 text-center gap-3">
              <Bot className="w-8 h-8 text-zinc-500 text-zinc-500 dark:text-zinc-400" />
              <p className="text-xs text-zinc-500">{t('app.connectToChat')}</p>
           </div>
        </aside>
      )}

      {isEditingSession && (
        <SessionForm 
          session={isEditingSession as Partial<Session>} 
          onSave={saveSession} 
          onClose={() => setIsEditingSession(null)} 
          availableTags={Array.from(new Set(sessions.flatMap(s => s.tags || [])))}
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

      {isImportExportOpen && (
        <ImportExportModal
          sessions={sessions}
          onImport={handleImportSessions}
          onClose={() => setIsImportExportOpen(false)}
        />
      )}

      {isAdminOpen && <AdminModal onClose={() => setIsAdminOpen(false)} />}

      {activeSmartMacroGoal && activeTabId && (
        <SmartMacroAgent 
          goal={activeSmartMacroGoal}
          terminalContext={terminalContexts[activeTabId] || ''}
          onExecuteCommand={(cmd) => {
            if (terminalRefs.current[activeTabId]) {
              terminalRefs.current[activeTabId].executeCommand(cmd);
            }
          }}
          onFinish={() => setActiveSmartMacroGoal(null)}
          aiSettings={aiSettings}
        />
      )}
    </div>
  );
}
