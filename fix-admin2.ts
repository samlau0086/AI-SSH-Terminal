import fs from 'fs';

let content = fs.readFileSync('src/components/AdminModal.tsx', 'utf-8');

// Fix the deleteUser function
content = content.replace(
  `  const deleteUser = async (id: number) => {
    if (id === currentUser?.id) return;
    
    setDeletingUserId(null);
      try {
        const res = await fetch(\`/api/admin/accounts/\${id}\`, {
          method: 'DELETE',
          headers: { 'Authorization': \`Bearer \${token}\` }
        });
        if (res.ok) {
          setUsers(users.filter(u => u.id !== id));
        }
      } catch (err) {
        console.error(err);
      }
    }
  };`,
  `  const deleteUser = async (id: number) => {
    if (id === currentUser?.id) return;
    setDeletingUserId(null);
    try {
      const res = await fetch(\`/api/admin/accounts/\${id}\`, {
        method: 'DELETE',
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };`
);

// add the state
content = content.replace(
  'const [loading, setLoading] = useState(true);',
  'const [loading, setLoading] = useState(true);\n  const [deletingUserId, setDeletingUserId] = useState<number|null>(null);'
);

// find the trailing delete button
// It's the one using <Trash className="w-4 h-4" />
const targetBtn = `{u.id !== currentUser?.id && (
                      <button 
                        onClick={() => deleteUser(u.id)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                        title="Delete User"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    )}`;
                    
const newBtn = `{u.id !== currentUser?.id && (
                      deletingUserId === u.id ? (
                        <div className="flex items-center gap-2">
                           <button onClick={() => deleteUser(u.id)} className="px-2 py-1 text-[10px] uppercase font-bold text-red-500">Conf</button>
                           <button onClick={() => setDeletingUserId(null)} className="px-2 py-1 text-[10px] uppercase font-bold text-zinc-500">Can</button>
                        </div>
                      ) : (
                      <button 
                        onClick={() => setDeletingUserId(u.id)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                        title="Delete User"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                      )
                    )}`;

content = content.replace(targetBtn, newBtn);

fs.writeFileSync('src/components/AdminModal.tsx', content);
