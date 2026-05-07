import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { X } from 'lucide-react';
import type { Session } from '../App';
import { useTranslation } from 'react-i18next';

interface Props {
  session: Partial<Session>;
  onSave: (session: Session) => void;
  onClose: () => void;
  availableTags?: string[];
}

export default function SessionForm({ session, onSave, onClose, availableTags = [] }: Props) {
  const { t } = useTranslation();
  const suggestionRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<Partial<Session>>({
    id: uuidv4(),
    ...session,
    tags: session.tags || []
  });
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowTagSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSuggestions = availableTags.filter(tag => 
    tag.toLowerCase().includes(tagInput.toLowerCase()) && 
    !(formData.tags || []).includes(tag)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.host || !formData.username) return;
    onSave(formData as Session);
  };

  const handleAddTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !(formData.tags || []).includes(trimmedTag)) {
      setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), trimmedTag] }));
    }
    setTagInput('');
    setShowTagSuggestions(false);
  };

  const addTagOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  const removeTag = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter((_, i) => i !== idx)
    }));
  };

  return (
    <div className="fixed inset-0 dark:bg-black/80 bg-zinc-500/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="dark:bg-[#18181b] dark:bg-white bg-zinc-900 border dark:border-zinc-800 border-zinc-200 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b dark:border-zinc-800 border-zinc-200 bg-[#09090b]/50">
          <h2 className="text-xs font-bold uppercase tracking-widest dark:text-zinc-300 text-zinc-700">
            {session.id ? t('sessionForm.editSession') : t('sessionForm.newSession')}
          </h2>
          <button onClick={onClose} className="p-1 dark:hover:bg-zinc-800 hover:bg-zinc-200 rounded-md transition-colors">
            <X className="w-4 h-4 dark:text-zinc-500 text-zinc-500 hover:dark:text-zinc-300 text-zinc-700" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest dark:text-zinc-500 text-zinc-500 mb-1.5">{t('sessionForm.sessionName')}</label>
              <input 
                type="text" 
                value={formData.name || ''}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="Production DB Server"
                className="w-full dark:bg-[#09090b] bg-zinc-50 border dark:border-zinc-800 border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 dark:text-zinc-200 text-zinc-800"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest dark:text-zinc-500 text-zinc-500 mb-1.5">{t('sessionForm.host')}</label>
                <input 
                  type="text" 
                  required
                  value={formData.host || ''}
                  onChange={e => setFormData({...formData, host: e.target.value})}
                  placeholder="192.168.1.1"
                  className="w-full dark:bg-[#09090b] bg-zinc-50 border dark:border-zinc-800 border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 dark:text-zinc-200 text-zinc-800"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest dark:text-zinc-500 text-zinc-500 mb-1.5">{t('sessionForm.port')}</label>
                <input 
                  type="number" 
                  value={formData.port || 22}
                  onChange={e => setFormData({...formData, port: parseInt(e.target.value) || 22})}
                  className="w-full dark:bg-[#09090b] bg-zinc-50 border dark:border-zinc-800 border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 dark:text-zinc-200 text-zinc-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest dark:text-zinc-500 text-zinc-500 mb-1.5">{t('sessionForm.username')}</label>
              <input 
                type="text" 
                required
                value={formData.username || ''}
                onChange={e => setFormData({...formData, username: e.target.value})}
                placeholder="root"
                className="w-full dark:bg-[#09090b] bg-zinc-50 border dark:border-zinc-800 border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 dark:text-zinc-200 text-zinc-800"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest dark:text-zinc-500 text-zinc-500 mb-1.5">{t('sessionForm.authentication')}</label>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, authType: 'password'})}
                  className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md border transition-colors ${formData.authType === 'password' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'dark:bg-[#09090b] bg-zinc-50 dark:border-zinc-800 border-zinc-200 dark:text-zinc-500 text-zinc-500 hover:dark:text-zinc-300 text-zinc-700'}`}
                >
                  {t('sessionForm.password')}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, authType: 'privateKey'})}
                  className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md border transition-colors ${formData.authType === 'privateKey' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'dark:bg-[#09090b] bg-zinc-50 dark:border-zinc-800 border-zinc-200 dark:text-zinc-500 text-zinc-500 hover:dark:text-zinc-300 text-zinc-700'}`}
                >
                  {t('sessionForm.privateKey')}
                </button>
              </div>

              {formData.authType === 'password' ? (
                <input 
                  type="password" 
                  value={formData.password || ''}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  placeholder={t('sessionForm.password')}
                  className="w-full dark:bg-[#09090b] bg-zinc-50 border dark:border-zinc-800 border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 dark:text-zinc-200 text-zinc-800"
                />
              ) : (
                <div className="space-y-2">
                  <textarea 
                    value={formData.privateKey || ''}
                    onChange={e => setFormData({...formData, privateKey: e.target.value})}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                    className="w-full dark:bg-[#09090b] bg-zinc-50 border dark:border-zinc-800 border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 dark:text-zinc-200 text-zinc-800 font-mono h-24 resize-none"
                  />
                  <input 
                    type="password" 
                    value={formData.passphrase || ''}
                    onChange={e => setFormData({...formData, passphrase: e.target.value})}
                    placeholder={t('sessionForm.passphrase')}
                    className="w-full dark:bg-[#09090b] bg-zinc-50 border dark:border-zinc-800 border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 dark:text-zinc-200 text-zinc-800"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest dark:text-zinc-500 text-zinc-500 mb-1.5">{t('sessionForm.tags')}</label>
              <div className="relative" ref={suggestionRef}>
                <div className="w-full dark:bg-[#09090b] bg-zinc-50 border dark:border-zinc-800 border-zinc-200 rounded-lg p-2 flex flex-wrap gap-2 focus-within:border-indigo-500 transition-colors">
                  {(formData.tags || []).map((tag, idx) => (
                    <span key={idx} className="flex items-center gap-1 px-2 py-1 bg-indigo-500/10 text-indigo-400 font-bold uppercase tracking-tighter rounded text-[10px]">
                      {tag}
                      <button type="button" onClick={() => removeTag(idx)} className="hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input 
                    type="text" 
                    value={tagInput}
                    onChange={e => {
                      setTagInput(e.target.value);
                      setShowTagSuggestions(true);
                    }}
                    onFocus={() => setShowTagSuggestions(true)}
                    onKeyDown={addTagOnEnter}
                    className="flex-1 bg-transparent border-none focus:outline-none text-sm min-w-[100px] dark:text-zinc-200 text-zinc-800"
                    placeholder={t('sessionForm.addTag')}
                  />
                </div>

                {showTagSuggestions && tagInput && filteredSuggestions.length > 0 && (
                  <div className="absolute z-[60] left-0 right-0 mt-1 dark:bg-[#18181b] dark:bg-white bg-zinc-900 border dark:border-zinc-800 border-zinc-200 rounded-lg shadow-xl max-h-40 overflow-y-auto custom-scrollbar overflow-hidden">
                    {filteredSuggestions.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddTag(tag)}
                        className="w-full text-left px-3 py-2 text-xs dark:text-zinc-300 text-zinc-700 hover:bg-indigo-600 hover:text-white transition-colors border-b border-zinc-800/50 last:border-0"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest dark:text-zinc-500 text-zinc-500 mb-1.5">{t('sessionForm.notes')}</label>
              <textarea 
                value={formData.notes || ''}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                className="w-full dark:bg-[#09090b] bg-zinc-50 border dark:border-zinc-800 border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 dark:text-zinc-200 text-zinc-800 h-20 resize-none font-mono"
                placeholder={t('sessionForm.envNotes')}
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t dark:border-zinc-800 border-zinc-200">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold uppercase tracking-widest dark:hover:bg-zinc-800 hover:bg-zinc-200 dark:text-zinc-400 dark:text-zinc-600 text-zinc-400 rounded-lg transition-colors"
            >
              {t('sessionForm.cancel')}
            </button>
            <button 
              type="submit"
              className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
            >
              {t('sessionForm.saveSession')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
