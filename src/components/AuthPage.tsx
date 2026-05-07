import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { TerminalSquare } from 'lucide-react';

export default function AuthPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || t('auth.error'));
      }

      if (data.message) {
        // This is a pending approval message
        setSuccessMsg(data.message);
        setIsLogin(true); // Switch to login screen so they can't submit register again immediately
        return;
      }
      
      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="h-screen w-full bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center mb-8 dark:text-zinc-300 text-zinc-700">
        <TerminalSquare className="w-12 h-12 text-indigo-500 mb-2" />
        <h1 className="text-2xl font-bold uppercase tracking-widest">{t('app.title')}</h1>
      </div>

      <div className="dark:bg-[#18181b] dark:bg-white bg-zinc-900 border dark:border-zinc-800 border-zinc-200 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl p-6">
        <h2 className="text-lg font-bold uppercase tracking-widest dark:text-zinc-300 text-zinc-700 mb-6 text-center">
          {isLogin ? t('auth.login') : t('auth.register')}
        </h2>

        {error && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-400 text-xs p-3 rounded-lg mb-4 text-center">
            {error}
          </div>
        )}
        
        {successMsg && (
          <div className="bg-green-900/30 border border-green-500/50 text-green-400 text-xs p-3 rounded-lg mb-4 text-center">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest dark:text-zinc-500 text-zinc-500 mb-1.5">
              {t('auth.username')}
            </label>
            <input 
              type="text" 
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full dark:bg-[#09090b] bg-zinc-50 border dark:border-zinc-800 border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 dark:text-zinc-200 text-zinc-800"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest dark:text-zinc-500 text-zinc-500 mb-1.5">
              {t('auth.password')}
            </label>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full dark:bg-[#09090b] bg-zinc-50 border dark:border-zinc-800 border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 dark:text-zinc-200 text-zinc-800"
            />
          </div>

          <button 
            type="submit"
            className="w-full py-2.5 mt-2 text-xs font-bold uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
          >
            {t('auth.submit')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs dark:text-zinc-500 text-zinc-500 hover:dark:text-zinc-300 text-zinc-700 transition-colors"
          >
            {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
          </button>
        </div>
      </div>
    </div>
  );
}