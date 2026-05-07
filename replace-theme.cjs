const fs = require('fs');
const path = require('path');

const replacements = {
  'bg-\\[#09090b\\]': 'dark:bg-[#09090b] bg-zinc-50',
  'bg-\\[#18181b\\]': 'dark:bg-[#18181b] bg-white',
  'border-zinc-800': 'dark:border-zinc-800 border-zinc-200',
  'text-zinc-400': 'dark:text-zinc-400 text-zinc-600',
  'text-zinc-500': 'dark:text-zinc-500 text-zinc-500',
  'text-zinc-300': 'dark:text-zinc-300 text-zinc-700',
  'text-zinc-200': 'dark:text-zinc-200 text-zinc-800',
  'text-zinc-600': 'dark:text-zinc-600 text-zinc-400',
  'bg-black': 'dark:bg-black bg-zinc-100',
  'bg-black/80': 'dark:bg-black/80 bg-zinc-500/80',
  'bg-black/60': 'dark:bg-black/60 bg-zinc-500/80',
  'bg-black/50': 'dark:bg-black/50 bg-zinc-200/50',
  'hover:bg-zinc-800': 'dark:hover:bg-zinc-800 hover:bg-zinc-200',
  'hover:bg-zinc-800/30': 'dark:hover:bg-zinc-800/30 hover:bg-zinc-200/50',
  'border-zinc-700/80': 'dark:border-zinc-700/80 border-zinc-300',
  'bg-white': 'dark:bg-white bg-zinc-900', // for terminal texts that might be inverted
};

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      
      for (const [key, value] of Object.entries(replacements)) {
        const regex = new RegExp(`(?<!dark:)(?<!light:)${key}(?![\\w/-])`, 'g');
        if (content.match(regex)) {
          content = content.replace(regex, value);
          modified = true;
        }
      }
      
      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Modified: ${fullPath}`);
      }
    }
  }
}

processDirectory('./src');
