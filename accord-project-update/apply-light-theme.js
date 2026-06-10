const fs = require('fs');
const path = require('path');

const files = [
  'components/builder/builder-page.tsx',
  'components/contracts/contract-editor.tsx',
  'components/contracts/editor-toolbar.tsx'
];

const replacements = [
  // Backgrounds
  { pattern: /bg-\[#0c0e16\]/g, replacement: 'bg-background' },
  { pattern: /bg-\[#0f1117\]/g, replacement: 'bg-card' },
  { pattern: /bg-\[#111520\]/g, replacement: 'bg-card' },
  { pattern: /bg-\[#161b27\]/g, replacement: 'bg-popover' },
  { pattern: /bg-\[#1a1d27\]/g, replacement: 'bg-muted' },
  { pattern: /bg-\[#e8e8e8\]/g, replacement: 'bg-secondary' }, // Editor canvas bg
  { pattern: /bg-\[#f8fafc\]/g, replacement: 'bg-card' }, // E.g. signature canvas bg
  { pattern: /bg-\[#c8c8c8\]/g, replacement: 'bg-secondary' },
  { pattern: /hover:bg-\[#c8c8c8\]\/80/g, replacement: 'hover:bg-secondary/80' },
  { pattern: /bg-slate-800/g, replacement: 'bg-popover' },
  { pattern: /bg-white\/5/g, replacement: 'bg-accent' },
  { pattern: /bg-white\/\[0\.0[0-9]+\]/g, replacement: 'bg-accent' },
  { pattern: /bg-white\/10/g, replacement: 'bg-secondary' },
  
  // Gradients
  { pattern: /bg-gradient-to-r from-violet-600 to-indigo-600/g, replacement: 'bg-primary' },
  { pattern: /hover:from-violet-500 hover:to-indigo-500/g, replacement: 'hover:bg-primary/90' },
  
  // Borders
  { pattern: /border-white\/\[0\.0[0-9]+\]/g, replacement: 'border-border' },
  { pattern: /border-white\/10/g, replacement: 'border-border' },
  { pattern: /border-white\/20/g, replacement: 'border-primary/20' },

  // Text colors
  { pattern: /text-slate-200/g, replacement: 'text-foreground' },
  { pattern: /text-slate-300/g, replacement: 'text-foreground' },
  { pattern: /text-slate-400/g, replacement: 'text-muted-foreground' },
  { pattern: /text-slate-500/g, replacement: 'text-muted-foreground' },
  { pattern: /text-slate-600/g, replacement: 'text-muted-foreground' },
  { pattern: /text-slate-700/g, replacement: 'text-muted-foreground' },

  // Primary Action colors (violet to semantic)
  { pattern: /bg-violet-600\/10/g, replacement: 'bg-primary/10' },
  { pattern: /bg-violet-600\/20/g, replacement: 'bg-primary/20' },
  { pattern: /bg-violet-600/g, replacement: 'bg-primary' },
  { pattern: /bg-violet-500\/10/g, replacement: 'bg-primary/10' },
  { pattern: /bg-violet-500\/15/g, replacement: 'bg-primary/10' },
  { pattern: /bg-violet-500\/20/g, replacement: 'bg-primary/20' },
  { pattern: /bg-violet-500\/30/g, replacement: 'bg-primary/30' },
  { pattern: /hover:bg-violet-500\/30/g, replacement: 'hover:bg-primary/20' },
  { pattern: /hover:bg-violet-500\/40/g, replacement: 'hover:bg-primary/20' },
  { pattern: /hover:bg-violet-500/g, replacement: 'hover:bg-primary/90' },
  { pattern: /hover:bg-violet-600\/90/g, replacement: 'hover:bg-primary/90' },
  
  { pattern: /text-violet-300/g, replacement: 'text-primary' },
  { pattern: /text-violet-400-foreground/g, replacement: 'text-primary-foreground' },
  { pattern: /text-violet-400/g, replacement: 'text-primary' },
  { pattern: /text-white/g, replacement: 'text-primary-foreground' },

  { pattern: /border-violet-500\/20/g, replacement: 'border-primary/20' },
  { pattern: /border-violet-500\/30/g, replacement: 'border-primary/30' },
  { pattern: /border-violet-500\/40/g, replacement: 'border-primary/40' },
  { pattern: /border-violet-500\/60/g, replacement: 'border-primary' },
  { pattern: /border-violet-500/g, replacement: 'border-primary' },
  { pattern: /focus:border-violet-500\/40/g, replacement: 'focus:border-primary/50' },
  { pattern: /focus:border-violet-500\/60/g, replacement: 'focus:border-primary' },
  { pattern: /focus:border-violet-500/g, replacement: 'focus:border-primary' },
  { pattern: /focus:ring-violet-500\/20/g, replacement: 'focus:ring-ring/20' },
  { pattern: /focus:ring-violet-500/g, replacement: 'focus:ring-ring' },
  { pattern: /shadow-violet-500\/20/g, replacement: 'shadow-primary/20' },

  // Interactive states
  { pattern: /hover:text-slate-200/g, replacement: 'hover:text-foreground' },
  { pattern: /hover:text-slate-300/g, replacement: 'hover:text-foreground' },
  { pattern: /hover:bg-white\/5/g, replacement: 'hover:bg-accent' },
  { pattern: /hover:bg-white\/10/g, replacement: 'hover:bg-accent/80' },
];

files.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${file} - does not exist.`);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  let original = content;

  replacements.forEach(({ pattern, replacement }) => {
    content = content.replace(pattern, replacement);
  });

  if (content !== original) {
    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${file}`);
  } else {
    console.log(`No changes needed in ${file}`);
  }
});
