import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Play, Plus, Edit, Trash, Zap, X, CheckSquare, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { Session } from '../App';

export interface QuickCommand {
  id: string;
  name: string;
  command: string;
}

interface QuickCommandsProps {
  onExecuteActive: (command: string) => void;
  checkedSessionIds: string[];
  sessions: Session[];
}

export default function QuickCommands({ onExecuteActive, checkedSessionIds, sessions }: QuickCommandsProps) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [commands, setCommands] = useState<QuickCommand[]>([]);
  const [isEditing, setIsEditing] = useState<QuickCommand | Partial<QuickCommand> | null>(null);
  const [executionResults, setExecutionResults] = useState<{ sessionId: string; output: string; error?: string }[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    fetchCommands();
  }, [token]);

  const fetchCommands = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/quick-commands', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCommands(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing || !isEditing.name || !isEditing.command) return;

    const isNew = !isEditing.id;
    const id = isEditing.id || uuidv4();
    const payload = { ...isEditing, id };

    try {
      const res = await fetch(isNew ? '/api/quick-commands' : `/api/quick-commands/${id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        if (isNew) {
          setCommands([...commands, payload as QuickCommand]);
        } else {
          setCommands(commands.map(c => c.id === id ? payload as QuickCommand : c));
        }
        setIsEditing(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteCommand = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/quick-commands/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCommands(commands.filter(c => c.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const executeCommand = async (cmd: QuickCommand) => {
    if (checkedSessionIds.length === 0) {
      // Execute only in active terminal
      onExecuteActive(cmd.command);
      return;
    }

    // Otherwise, execute on all checked sessions!
    setIsExecuting(true);
    setExecutionResults([]);
    setShowResults(true);

    try {
      const res = await fetch('/api/sessions/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionIds: checkedSessionIds,
          command: cmd.command
        })
      });

      if (res.ok) {
        const data = await res.json();
        setExecutionResults(data.results);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="bg-[#18181b] border-t border-zinc-800 p-3 shrink-0 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-amber-400" />
          Quick Commands
        </h3>
        <button 
          onClick={() => setIsEditing({ name: '', command: '' })}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
        {commands.map(cmd => (
          <div 
            key={cmd.id} 
            className="flex items-center gap-1 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-md px-2 py-1 shrink-0 group cursor-pointer transition-colors"
            onClick={() => executeCommand(cmd)}
            title={cmd.command}
          >
            <span className="text-xs text-zinc-300 font-medium">{cmd.name}</span>
            <div className="flex items-center ml-2 border-l border-zinc-700 pl-1 -mr-1">
              <button
                onClick={(e) => { e.stopPropagation(); setIsEditing(cmd); }}
                className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-300"
              >
                <Edit className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => deleteCommand(cmd.id, e)}
                className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400"
              >
                <Trash className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
        {commands.length === 0 && (
          <span className="text-xs text-zinc-600 italic">No quick commands added yet.</span>
        )}
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-[#09090b]">
              <h2 className="text-sm font-bold text-zinc-200">
                {isEditing.id ? 'Edit Quick Command' : 'Add Quick Command'}
              </h2>
              <button onClick={() => setIsEditing(null)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={saveCommand} className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Name</label>
                <input
                  type="text"
                  required
                  value={isEditing.name || ''}
                  onChange={e => setIsEditing({...isEditing, name: e.target.value})}
                  className="w-full bg-[#09090b] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Check Status"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Command</label>
                <textarea
                  required
                  value={isEditing.command || ''}
                  onChange={e => setIsEditing({...isEditing, command: e.target.value})}
                  rows={3}
                  className="w-full bg-[#09090b] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="e.g. systemctl status nginx"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                 <button 
                  type="button" 
                  onClick={() => setIsEditing(null)}
                  className="px-4 py-2 text-xs font-bold uppercase hover:bg-zinc-800 text-zinc-400 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-xs font-bold uppercase bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResults && (
         <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-[#18181b] border border-zinc-800 rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
             <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-[#09090b] shrink-0">
               <h2 className="text-sm font-bold text-zinc-200">Execution Results</h2>
               <button onClick={() => setShowResults(false)} className="text-zinc-500 hover:text-zinc-300">
                 <X className="w-5 h-5" />
               </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-4">
               {isExecuting && executionResults.length === 0 ? (
                 <div className="text-center text-zinc-500 py-8 animate-pulse text-sm">Executing command on selected sessions...</div>
               ) : (
                 executionResults.map(res => {
                    const session = sessions.find(s => s.id === res.sessionId);
                    return (
                      <div key={res.sessionId} className="border border-zinc-800 rounded-lg overflow-hidden">
                        <div className="bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 border-b border-zinc-800 flex justify-between">
                          <span>{session?.name || session?.host}</span>
                          {res.error ? (
                            <span className="text-red-400">Failed</span>
                          ) : (
                            <span className="text-emerald-400">Exit code: {res.code}</span>
                          )}
                        </div>
                        <div className="bg-black p-3 font-mono text-xs whitespace-pre-wrap overflow-x-auto text-zinc-300 max-h-60 custom-scrollbar">
                           {res.error ? <span className="text-red-400">{res.error}</span> : (res.output || <span className="text-zinc-600 italic">No output</span>)}
                        </div>
                      </div>
                    )
                 })
               )}
             </div>
           </div>
         </div>
      )}
    </div>
  );
}