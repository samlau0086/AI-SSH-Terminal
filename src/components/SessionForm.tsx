import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { X, Eye, EyeOff } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
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
    username: 'root',
    ...session,
    tags: session?.tags || []
  });
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

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
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
            {session.id ? t('sessionForm.editSession') : t('sessionForm.newSession')}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors">
            <X className="w-4 h-4 text-zinc-500 hover:dark:text-zinc-300" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">{t('sessionForm.sessionName')}</label>
              <input 
                type="text" 
                value={formData.name || ''}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="Production DB Server"
                className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-zinc-800 dark:text-zinc-200"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">{t('sessionForm.host')}</label>
                <input 
                  type="text" 
                  required
                  value={formData.host || ''}
                  onChange={e => setFormData({...formData, host: e.target.value})}
                  placeholder="192.168.1.1"
                  className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-zinc-800 dark:text-zinc-200"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">{t('sessionForm.port')}</label>
                <input 
                  type="number" 
                  value={formData.port || 22}
                  onChange={e => setFormData({...formData, port: parseInt(e.target.value) || 22})}
                  className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-zinc-800 dark:text-zinc-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">{t('sessionForm.username')}</label>
              <input 
                type="text" 
                required
                value={formData.username || ''}
                onChange={e => setFormData({...formData, username: e.target.value})}
                placeholder="root"
                className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-zinc-800 dark:text-zinc-200"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">{t('sessionForm.authentication')}</label>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, authType: 'password'})}
                  className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md border transition-colors ${formData.authType === 'password' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'dark:bg-[#09090b] border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:dark:text-zinc-300 text-zinc-700'}`}
                >
                  {t('sessionForm.password')}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, authType: 'privateKey'})}
                  className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md border transition-colors ${formData.authType === 'privateKey' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'dark:bg-[#09090b] border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:dark:text-zinc-300 text-zinc-700'}`}
                >
                  {t('sessionForm.privateKey')}
                </button>
              </div>

              {formData.authType === 'password' ? (
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={formData.password || ''}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder={t('sessionForm.password')}
                    className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:border-indigo-500 text-zinc-800 dark:text-zinc-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-500 dark:hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea 
                    value={formData.privateKey || ''}
                    onChange={e => setFormData({...formData, privateKey: e.target.value})}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                    className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-zinc-800 dark:text-zinc-200 font-mono h-24 resize-none"
                  />
                  <div className="relative">
                    <input 
                      type={showPassphrase ? "text" : "password"} 
                      value={formData.passphrase || ''}
                      onChange={e => setFormData({...formData, passphrase: e.target.value})}
                      placeholder={t('sessionForm.passphrase')}
                      className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:border-indigo-500 text-zinc-800 dark:text-zinc-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-500 dark:hover:text-zinc-300"
                    >
                      {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">{t('sessionForm.tags')}</label>
              <div className="relative" ref={suggestionRef}>
                <div className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 flex flex-wrap gap-2 focus-within:border-indigo-500 transition-colors">
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
                    className="flex-1 bg-transparent border-none focus:outline-none text-sm min-w-[100px] text-zinc-800 dark:text-zinc-200"
                    placeholder={t('sessionForm.addTag')}
                  />
                </div>

                {showTagSuggestions && tagInput && filteredSuggestions.length > 0 && (
                  <div className="absolute z-[60] left-0 right-0 mt-1 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl max-h-40 overflow-y-auto custom-scrollbar overflow-hidden">
                    {filteredSuggestions.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddTag(tag)}
                        className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-indigo-600 hover:text-zinc-900 dark:hover:text-white transition-colors border-b border-zinc-200/50 border-zinc-200/50 dark:border-zinc-800/50 last:border-0"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">{t('sessionForm.notes')}</label>
              <textarea 
                value={formData.notes || ''}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-zinc-800 dark:text-zinc-200 h-20 resize-none font-mono"
                placeholder={t('sessionForm.envNotes')}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Renewal Cycle</label>
                <select
                  value={formData.renewalCycle || 'none'}
                  onChange={e => setFormData({...formData, renewalCycle: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-zinc-800 dark:text-zinc-200"
                >
                  <option value="none">None</option>
                  <option value="1">1 Month</option>
                  <option value="3">3 Months</option>
                  <option value="6">6 Months</option>
                  <option value="12">1 Year</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Expiration Date</label>
                <DatePicker 
                  selected={formData.expirationDate ? new Date(formData.expirationDate) : null}
                  onChange={(date: Date | null) => {
                    if (date) {
                      const offset = date.getTimezoneOffset()
                      const safeDate = new Date(date.getTime() - (offset*60*1000))
                      setFormData({...formData, expirationDate: safeDate.toISOString().split('T')[0]})
                    } else {
                      setFormData({...formData, expirationDate: undefined})
                    }
                  }}
                  className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-zinc-800 dark:text-zinc-200"
                  dateFormat="yyyy-MM-dd"
                  isClearable
                  placeholderText="yyyy-mm-dd"
                  wrapperClassName="w-full"
                />
              </div>
            </div>

          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 text-zinc-500 dark:text-zinc-400 rounded-lg transition-colors"
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
