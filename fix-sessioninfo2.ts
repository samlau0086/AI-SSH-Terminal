import fs from 'fs';

let content = fs.readFileSync('src/components/SessionInfoPanel.tsx', 'utf-8');

// replace window.confirm
content = content.replace(
  "if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;",
  "setDeletingFile(null);"
);

// find where handleDelete is called
// Typically: <button onClick={() => handleDelete(file.name, file.isDirectory)} ...><Trash2 /> ...
const targetButton = `<button
                        onClick={() => handleDelete(file.name, file.isDirectory)}
                        className="p-1 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-500/20 text-zinc-400 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>`;
                      
const newButton = `{deletingFile === file.name ? (
                        <div className="flex gap-2">
                            <button onClick={() => handleDelete(file.name, file.isDirectory)} className="text-[10px] uppercase font-bold text-red-500">Conf</button>
                            <button onClick={() => setDeletingFile(null)} className="text-[10px] uppercase font-bold text-zinc-500">Can</button>
                        </div>
                      ) : (
                      <button
                        onClick={() => setDeletingFile(file.name)}
                        className="p-1 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-500/20 text-zinc-400 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      )}`;

content = content.replace(targetButton, newButton);

// add state
content = content.replace(
  'const [uploadProgress, setUploadProgress] = useState(0);',
  'const [uploadProgress, setUploadProgress] = useState(0);\n  const [deletingFile, setDeletingFile] = useState<string|null>(null);'
);

fs.writeFileSync('src/components/SessionInfoPanel.tsx', content);
