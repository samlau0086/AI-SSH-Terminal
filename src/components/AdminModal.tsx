import { useState, useEffect } from 'react';
import { useAuth, User } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { X, UserCog, Trash } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function AdminModal({ onClose }: Props) {
  const { t } = useTranslation();
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [token]);

  const approveUser = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/approve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === id ? { ...u, is_approved: 1 } : u));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteUser = async (id: number) => {
    if (id === currentUser?.id) return;
    
    if (confirm(t('auth.confirmDeleteUser') || 'Are you sure you want to delete this user?')) {
      try {
        const res = await fetch(`/api/admin/users/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setUsers(users.filter(u => u.id !== id));
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="fixed inset-0 dark:bg-black/80 bg-zinc-500/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="dark:bg-[#18181b] dark:bg-white bg-zinc-900 border dark:border-zinc-800 border-zinc-200 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b dark:border-zinc-800 border-zinc-200 bg-[#09090b]/50 shrink-0">
          <div className="flex items-center gap-2">
            <UserCog className="w-4 h-4 text-emerald-500" />
            <h2 className="text-xs font-bold uppercase tracking-widest dark:text-zinc-300 text-zinc-700">
              {t('auth.adminDashboard')}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 dark:hover:bg-zinc-800 hover:bg-zinc-200 rounded-md transition-colors">
            <X className="w-4 h-4 dark:text-zinc-500 text-zinc-500 hover:dark:text-zinc-300 text-zinc-700" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
          {loading ? (
            <div className="text-center dark:text-zinc-500 text-zinc-500 text-sm py-8">Loading...</div>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between dark:bg-[#09090b] bg-zinc-50 border dark:border-zinc-800 border-zinc-200 rounded-lg p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium dark:text-zinc-200 text-zinc-800">{u.username}</span>
                      {!u.is_approved && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          Pending
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider font-bold dark:text-zinc-500 text-zinc-500 mt-1">Role: {u.role}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!u.is_approved && (
                      <button 
                        onClick={() => approveUser(u.id)}
                        className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold bg-indigo-500 text-white hover:bg-indigo-400 rounded-md transition-colors"
                        title="Approve User"
                      >
                        Approve
                      </button>
                    )}
                    {u.id !== currentUser?.id && (
                      <button 
                        onClick={() => deleteUser(u.id)}
                        className="p-2 dark:text-zinc-500 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                        title="Delete User"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
