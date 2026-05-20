import fs from 'fs';

let content = fs.readFileSync('src/components/TerminalComponent.tsx', 'utf-8');

// replace xtermRef.current?.focus() with focus on textarea
let target1 = `setIsHistoryOpen(false);
                          setTimeout(() => xtermRef.current?.focus(), 10);`;
let replace1 = `setIsHistoryOpen(false);
                          setTimeout(() => {
                            const ta = document.getElementById('cmd-input-textarea');
                            if (ta) ta.focus();
                          }, 10);`;
                          
content = content.replace(target1, replace1);

let target2 = `<TextareaAutosize
          value={cmdInput}`;
let replace2 = `<TextareaAutosize
          id="cmd-input-textarea"
          value={cmdInput}`;

content = content.replace(target2, replace2);

fs.writeFileSync('src/components/TerminalComponent.tsx', content);
