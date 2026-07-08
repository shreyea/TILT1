const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'frontend/src');

function revertFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Don't revert theme.js itself
  if (filePath.endsWith('theme.js')) return;
  // App.js is already done manually
  if (filePath.endsWith('App.js')) return;

  if (!content.includes('useTheme')) return;

  // 1. Update imports
  content = content.replace(/import\s+\{\s*([^}]*)\s*\}\s+from\s+['"]([^'"]*theme)['"];/, (match, p1, p2) => {
    let imports = p1.split(',').map(i => i.trim());
    imports = imports.filter(i => i !== 'useTheme');
    if (!imports.includes('COLORS')) imports.unshift('COLORS');
    if (!imports.includes('SHADOWS')) imports.push('SHADOWS');
    return `import { ${imports.join(', ')} } from '${p2}';`;
  });

  // 2. Wrap StyleSheet
  let isS = content.includes('const s = createStyles');
  let styleVarName = isS ? 's' : 'styles';

  content = content.replace(/const\s+createStyles\s*=\s*\(\s*COLORS\s*,\s*SHADOWS\s*\)\s*=>\s*StyleSheet\.create\(\{/, `const ${styleVarName} = StyleSheet.create({`);

  // 3. Remove injected hooks
  content = content.replace(/[ \t]*const\s+\{\s*COLORS[^}]*\}\s*=\s*useTheme\(\);\n?/g, '');
  content = content.replace(/[ \t]*const\s+(styles|s)\s*=\s*createStyles\(COLORS,\s*SHADOWS\);\n?/g, '');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Reverted', filePath);
}

function traverse(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverse(fullPath);
    } else if (fullPath.endsWith('.js')) {
      revertFile(fullPath);
    }
  }
}

traverse(directoryPath);
