import fs from 'fs';

let content = fs.readFileSync('src/components/AdminModal.tsx', 'utf-8');

// Replace confirm
content = content.replace(
  "if (confirm(t('auth.confirmDeleteUser') || 'Are you sure you want to delete this user?')) {",
  "setDeletingUserId(null);"
);

// Find delete button
const targetButton = `<button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-1 text-zinc-500 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-500/20 rounded"
                        title={t('auth.deleteUser') as string}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>`;
                      
const newButton = `{deletingUserId === u.id ? (
                        <div className="flex gap-2">
                            <button onClick={() => handleDeleteUser(u.id)} className="text-[10px] uppercase font-bold text-red-500 hover:text-red-600">Conf</button>
                            <button onClick={() => setDeletingUserId(null)} className="text-[10px] uppercase font-bold text-zinc-500 hover:text-zinc-600">Can</button>
                        </div>
                      ) : (
                      <button
                        onClick={() => setDeletingUserId(u.id)}
                        className="p-1 text-zinc-500 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-500/20 rounded"
                        title={t('auth.deleteUser') as string}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      )}`;

content = content.replace(targetButton, newButton);

content = content.replace(
  'const [statusMsg, setStatusMsg] = useState(\'\');',
  'const [statusMsg, setStatusMsg] = useState(\'\');\n  const [deletingUserId, setDeletingUserId] = useState<number|null>(null);'
);

fs.writeFileSync('src/components/AdminModal.tsx', content);
