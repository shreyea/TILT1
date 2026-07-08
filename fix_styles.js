const fs = require('fs');
const path = require('path');

// Fix the styles. -> s. mismatch in files that use `const s = useMemo`
const srcDir = path.join(__dirname, 'frontend', 'src');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Only fix files that use `const s = useMemo` (meaning the style variable is `s`)
  if (!content.includes('const s = useMemo')) return;
  
  // Check if there are any `styles.` references in JSX (not in createStyles definition)
  const createStylesIndex = content.indexOf('const createStyles');
  if (createStylesIndex === -1) return;
  
  // Only replace styles. -> s. BEFORE the createStyles definition (i.e. in JSX/component code)
  const beforeCreateStyles = content.substring(0, createStylesIndex);
  const afterCreateStyles = content.substring(createStylesIndex);
  
  if (beforeCreateStyles.includes('styles.') || beforeCreateStyles.includes('styles[')) {
    const fixed = beforeCreateStyles.replace(/\bstyles\./g, 's.').replace(/\bstyles\[/g, 's[');
    content = fixed + afterCreateStyles;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed styles. -> s. in', filePath);
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') walk(full);
    else if (entry.name.endsWith('.js')) fixFile(full);
  }
}

walk(srcDir);
console.log('Done!');
