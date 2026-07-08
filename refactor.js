const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'frontend/src');

function refactorFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if it imports COLORS
  if (!content.includes('COLORS')) return;
  // Don't refactor theme.js itself
  if (filePath.endsWith('theme.js')) return;
  // App.js is already done
  if (filePath.endsWith('App.js') || filePath.endsWith('ThemeContext.js')) return;

  // 1. Update imports
  // Need to import useTheme from context. Add it if not present.
  let hasUseMemo = content.includes('useMemo');
  if (!hasUseMemo) {
    content = content.replace(/import\s+React\s*(?:,\s*\{[^}]*\})?\s*from\s+['"]react['"];/, (match) => {
      if (match.includes('{')) {
        return match.replace('{', '{ useMemo, ');
      } else {
        return `import React, { useMemo } from 'react';`;
      }
    });
  }

  // Remove COLORS and SHADOWS from theme import
  content = content.replace(/import\s+\{\s*([^}]*)\s*\}\s+from\s+['"]([^'"]*theme)['"];/, (match, p1, p2) => {
    let imports = p1.split(',').map(i => i.trim());
    imports = imports.filter(i => i !== 'COLORS' && i !== 'SHADOWS');
    if (imports.length === 0) return '';
    return `import { ${imports.join(', ')} } from '${p2}';`;
  });

  // Add useTheme import
  let depth = filePath.includes('components') || filePath.includes('screens') ? '../' : './';
  content = `import { useTheme } from '${depth}context/ThemeContext';\n` + content;

  // 2. Wrap StyleSheet
  let isS = content.includes('const s = StyleSheet.create');
  let styleVarName = isS ? 's' : 'styles';

  content = content.replace(/const\s+(styles|s)\s*=\s*StyleSheet\.create\(\{/, 'const createStyles = (COLORS, SHADOWS) => StyleSheet.create({');

  // 3. Inject hooks into components
  // Look for `export default function ComponentName(` or `export function ComponentName(`
  const componentRegex = /(export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{|export\s+function\s+\w+\s*\([^)]*\)\s*\{|const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{)/g;
  
  content = content.replace(componentRegex, (match) => {
    return `${match}\n  const { COLORS, SHADOWS, themeName, toggleTheme } = useTheme();\n  const ${styleVarName} = useMemo(() => createStyles(COLORS, SHADOWS), [COLORS, SHADOWS]);\n`;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Refactored', filePath);
}

function traverse(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverse(fullPath);
    } else if (fullPath.endsWith('.js')) {
      refactorFile(fullPath);
    }
  }
}

traverse(directoryPath);
