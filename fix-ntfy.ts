import fs from 'fs';

let content = fs.readFileSync('src/components/SettingsModal.tsx', 'utf-8');

const uiTarget = `                  <div>
                    <label className="flex items-center gap-2 mb-2">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-indigo-600 rounded border-zinc-300 dark:border-zinc-700 bg-transparent focus:ring-0 focus:ring-offset-0"
                        checked={notificationSettings.ntfyEnabled}
                        onChange={e => setNotificationSettings({...notificationSettings, ntfyEnabled: e.target.checked})}
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">ntfy.sh</span>
                    </label>
                    {notificationSettings.ntfyEnabled && (
                      <input 
                        type="text" 
                        value={notificationSettings.ntfyUrl}
                        onChange={e => setNotificationSettings({...notificationSettings, ntfyUrl: e.target.value})}
                        className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-zinc-800 dark:text-zinc-200"
                        placeholder="https://ntfy.sh/mytopic"
                      />
                    )}
                  </div>`;
content = content.replace(uiTarget, '');

content = content.replace(/ntfyEnabled:\s*notificationSettings\.ntfyEnabled,?/g, '');
content = content.replace(/ntfyUrl:\s*notificationSettings\.ntfyUrl,?/g, '');
content = content.replace(/ntfyEnabled:\s*notificationSettings\.?\s*,?\s*/g, '');
content = content.replace(/ntfyUrl:\s*notificationSettings\.?\s*,?\s*/g, '');


fs.writeFileSync('src/components/SettingsModal.tsx', content);
