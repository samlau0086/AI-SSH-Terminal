import fs from 'fs';

let content = fs.readFileSync('src/components/CredentialsManager.tsx', 'utf-8');

// 1. Add state
content = content.replace(
  'const [errorMsg, setErrorMsg] = useState<string | null>(null);',
  'const [errorMsg, setErrorMsg] = useState<string | null>(null);\n  const [deletingId, setDeletingId] = useState<string | null>(null);'
);

// 2. Remove window.confirm
content = content.replace(
  "if (!window.confirm('Are you sure you want to delete this credential?')) return;",
  "setDeletingId(null);"
);

// 3. Update the buttons
const replaceTarget = `<div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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
              </div>`;

const newButtons = `<div className="flex items-center gap-1 opacity-100 transition-opacity">
                {deletingId === c.id ? (
                  <div className="flex items-center gap-2 px-2">
                    <button type="button" onClick={() => handleDelete(c.id)} className="text-[10px] font-bold uppercase tracking-widest text-red-500 hover:text-red-600">Conf</button>
                    <button type="button" onClick={() => setDeletingId(null)} className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-700">Can</button>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => { setEditForm(c); setIsEditing(c.id); }} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 rounded md:opacity-0 md:group-hover:opacity-100">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => setDeletingId(c.id)} className="p-1.5 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-500/20 text-zinc-500 rounded md:opacity-0 md:group-hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>`;

content = content.replace(replaceTarget, newButtons);
fs.writeFileSync('src/components/CredentialsManager.tsx', content);
