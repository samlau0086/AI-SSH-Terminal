import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, Key } from 'lucide-react';

export interface Credential {
  id: string;
  name: string;
  username: string;
  authType: 'password' | 'privateKey';
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export default function CredentialsManager() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Credential>>({});

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    try {
      const res = await fetch('/api/users/me/auth-profiles', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCredentials(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!editForm.name || !editForm.username) return;
    try {
      const isNew = !editForm.id;
      const id = editForm.id || crypto.randomUUID();
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/api/users/me/auth-profiles' : `/api/users/me/auth-profiles/${id}`;
      
      const payloadObj = { ...editForm, id };
      const payloadStr = JSON.stringify(payloadObj);
      const payload = btoa(unescape(encodeURIComponent(payloadStr)));

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payload })
      });
      
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      
      setIsEditing(null);
      fetchCredentials();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credential?')) return;
    try {
      await fetch(`/api/users/me/auth-profiles/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      fetchCredentials();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Saved Credentials</h3>
        <button
          type="button"
          onClick={() => {
            setEditForm({ authType: 'password', username: 'root' });
            setIsEditing('new');
          }}
          className="flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-xs transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Credential
        </button>
      </div>

      {isEditing && (
        <div className="bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 space-y-3 mb-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Name</label>
            <input
              type="text"
              value={editForm.name || ''}
              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
              placeholder="e.g. Prod Server Key"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Username</label>
            <input
              type="text"
              value={editForm.username || ''}
              onChange={e => setEditForm({ ...editForm, username: e.target.value })}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Auth Type</label>
            <select
              value={editForm.authType}
              onChange={e => setEditForm({ ...editForm, authType: e.target.value as any, password: '', privateKey: '', passphrase: '' })}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="password">Password</option>
              <option value="privateKey">Private Key</option>
            </select>
          </div>
          
          {editForm.authType === 'password' && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Password</label>
              <input
                type="password"
                value={editForm.password || ''}
                onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {editForm.authType === 'privateKey' && (
            <>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Private Key</label>
                <textarea
                  value={editForm.privateKey || ''}
                  onChange={e => setEditForm({ ...editForm, privateKey: e.target.value })}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500 h-24 font-mono"
                  placeholder="-----BEGIN RSA PRIVATE KEY-----"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Passphrase (Optional)</label>
                <input
                  type="password"
                  value={editForm.passphrase || ''}
                  onChange={e => setEditForm({ ...editForm, passphrase: e.target.value })}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
              disabled={!editForm.name || !editForm.username}
            >
              <Check className="w-3 h-3" /> Save
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(null)}
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded text-xs hover:bg-zinc-300 dark:hover:bg-zinc-700"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      )}

      {credentials.length === 0 && !isEditing ? (
        <div className="text-center py-6 text-zinc-500 dark:text-zinc-400 text-sm border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
          No credentials saved yet.
        </div>
      ) : (
        <div className="space-y-2">
          {credentials.map(c => (
            <div key={c.id} className="flex items-center justify-between p-2 bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                  <Key className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{c.name}</div>
                  <div className="text-xs text-zinc-500">{c.username} • {c.authType === 'password' ? 'Password' : 'Private Key'}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => {
                    setEditForm(c);
                    setIsEditing(c.id);
                  }}
                  className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 rounded"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  className="p-1.5 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-500/20 text-zinc-500 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
