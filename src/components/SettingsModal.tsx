import { useState } from 'react';
import { X, Server, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export interface AISettings {
  provider: 'gemini' | 'openai';
  apiKey: string;
  baseUrl: string;
  model: string;
  commandHistorySize?: number;
}

interface Props {
  settings: AISettings;
  onSave: (settings: AISettings) => void;
  onClose: () => void;
}

export default function SettingsModal({ settings, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<AISettings>({ ...settings });
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleTestModel = async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
      if (formData.provider === 'openai') {
        const client = new OpenAI({
          apiKey: formData.apiKey,
          baseURL: formData.baseUrl || undefined,
          dangerouslyAllowBrowser: true
        });
        
        let res: any;
        try {
          res = await client.chat.completions.create({
            messages: [{ role: 'user', content: 'Say "Hi" if you can read this.' }],
            model: formData.model || 'gpt-4o',
            max_tokens: 10,
          });
        } catch (apiError: any) {
          if (typeof apiError?.message === 'string' && apiError.message.toLowerCase().includes('<!doctype html')) {
             throw new Error(`API returned an HTML page. Try appending "/v1" to your Base URL.`);
          }
          throw apiError;
        }

        if (typeof res === 'string' || !res?.choices?.length) {
          const responseStr = typeof res === 'string' ? res : JSON.stringify(res);
          if (responseStr.toLowerCase().includes('<!doctype html') || responseStr.includes('<html')) {
            throw new Error(`API returned an HTML page. Try appending "/v1" to your Base URL.`);
          }
          throw new Error('Invalid API response');
        }
      } else {
        const ai = new GoogleGenAI({ apiKey: formData.apiKey || process.env.GEMINI_API_KEY });
        await ai.models.generateContent({
          model: formData.model || 'gemini-2.5-pro',
          contents: [{ role: 'user', parts: [{ text: 'Say "Hi" if you can read this.' }] }],
        });
      }
      setTestStatus('success');
      setTestMessage('Connection successful!');
    } catch (error: any) {
      setTestStatus('error');
      setTestMessage(error.message || 'Connection failed.');
    }
  };

  return (
    <div className="fixed inset-0 dark:bg-black/80 bg-zinc-500/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="dark:bg-[#18181b] dark:bg-white bg-zinc-900 border dark:border-zinc-800 border-zinc-200 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b dark:border-zinc-800 border-zinc-200 bg-[#09090b]/50">
          <h2 className="text-xs font-bold uppercase tracking-widest dark:text-zinc-300 text-zinc-700">
            {t('settings.title')}
          </h2>
          <button onClick={onClose} className="p-1 dark:hover:bg-zinc-800 hover:bg-zinc-200 rounded-md transition-colors">
            <X className="w-4 h-4 dark:text-zinc-500 text-zinc-500 hover:dark:text-zinc-300 text-zinc-700" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-xs dark:text-zinc-400 dark:text-zinc-600 text-zinc-400 mb-4">{t('settings.description')}</p>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest dark:text-zinc-500 text-zinc-500 mb-1.5">{t('settings.aiProvider')}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, provider: 'gemini'})}
                  className={`flex-1 py-2 px-3 text-[11px] font-bold uppercase tracking-wider rounded-md border transition-colors flex items-center justify-center gap-2 ${formData.provider === 'gemini' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'dark:bg-[#09090b] bg-zinc-50 dark:border-zinc-800 border-zinc-200 dark:text-zinc-500 text-zinc-500 hover:dark:text-zinc-300 text-zinc-700'}`}
                >
                  {t('settings.providerGemini')}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, provider: 'openai'})}
                  className={`flex-1 py-2 px-3 text-[11px] font-bold uppercase tracking-wider rounded-md border transition-colors flex items-center justify-center gap-2 ${formData.provider === 'openai' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'dark:bg-[#09090b] bg-zinc-50 dark:border-zinc-800 border-zinc-200 dark:text-zinc-500 text-zinc-500 hover:dark:text-zinc-300 text-zinc-700'}`}
                >
                  <Server className="w-3.5 h-3.5" />
                  {t('settings.providerOpenAI')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest dark:text-zinc-500 text-zinc-500 mb-1.5">{t('settings.apiKey')} *</label>
              <input 
                type="password" 
                required
                value={formData.apiKey || ''}
                onChange={e => setFormData({...formData, apiKey: e.target.value})}
                className="w-full dark:bg-[#09090b] bg-zinc-50 border dark:border-zinc-800 border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 dark:text-zinc-200 text-zinc-800"
                placeholder={t('settings.apiKeyPlaceholder')}
              />
            </div>

            {formData.provider === 'openai' && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest dark:text-zinc-500 text-zinc-500 mb-1.5">{t('settings.baseUrl')}</label>
                <input 
                  type="text" 
                  value={formData.baseUrl || ''}
                  onChange={e => setFormData({...formData, baseUrl: e.target.value})}
                  className="w-full dark:bg-[#09090b] bg-zinc-50 border dark:border-zinc-800 border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 dark:text-zinc-200 text-zinc-800"
                  placeholder={t('settings.baseUrlPlaceholder')}
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest dark:text-zinc-500 text-zinc-500 mb-1.5">{t('settings.model')} *</label>
              <input 
                type="text" 
                required
                value={formData.model || ''}
                onChange={e => setFormData({...formData, model: e.target.value})}
                className={`w-full dark:bg-[#09090b] bg-zinc-50 border dark:border-zinc-800 border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none dark:text-zinc-200 text-zinc-800 ${formData.provider === 'openai' ? 'focus:border-emerald-500' : 'focus:border-indigo-500'}`}
                placeholder={t('settings.modelPlaceholder')}
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest dark:text-zinc-500 text-zinc-500 mb-1.5">Command History Size</label>
              <input 
                type="number" 
                min="1"
                max="1000"
                value={formData.commandHistorySize || 200}
                onChange={e => setFormData({...formData, commandHistorySize: parseInt(e.target.value) || 200})}
                className="w-full dark:bg-[#09090b] bg-zinc-50 border dark:border-zinc-800 border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 dark:text-zinc-200 text-zinc-800"
              />
            </div>
            
            {testStatus !== 'idle' && (
              <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                testStatus === 'testing' ? 'bg-zinc-800/50 border-zinc-700 dark:text-zinc-300 text-zinc-700' :
                testStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                {testStatus === 'testing' && <Activity className="w-4 h-4 animate-pulse shrink-0" />}
                {testStatus === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                {testStatus === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
                <div className="flex-1 break-all mt-0.5">{testMessage || 'Testing connection...'}</div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 mt-4 border-t dark:border-zinc-800 border-zinc-200">
            <button
              type="button"
              onClick={handleTestModel}
              disabled={testStatus === 'testing'}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest border border-zinc-700 dark:hover:bg-zinc-800 hover:bg-zinc-200 dark:text-zinc-300 text-zinc-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <Activity className="w-3.5 h-3.5" />
              Test Connection
            </button>
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest dark:hover:bg-zinc-800 hover:bg-zinc-200 dark:text-zinc-400 dark:text-zinc-600 text-zinc-400 rounded-lg transition-colors"
              >
                {t('settings.cancel')}
              </button>
              <button 
                type="submit"
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
              >
                {t('settings.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
