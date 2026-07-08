const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'frontend/src');

function refactorFile(filePath) {
  if (filePath.endsWith('theme.js')) return;
  if (filePath.endsWith('App.js') || filePath.endsWith('ThemeContext.js')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('useTheme')) return;

  // Remove ALL injected lines from previous script
  content = content.replace(/[ \t]*const \{ COLORS, SHADOWS, themeName, toggleTheme \} = useTheme\(\);\n/g, '');
  content = content.replace(/[ \t]*const s = useMemo\(\(\) => createStyles\(COLORS, SHADOWS\), \[COLORS, SHADOWS\]\);\n/g, '');
  content = content.replace(/[ \t]*const styles = useMemo\(\(\) => createStyles\(COLORS, SHADOWS\), \[COLORS, SHADOWS\]\);\n/g, '');

  let styleVarName = content.match(/s\.\w+/) ? 's' : 'styles';

  // Inject correctly into the main component only
  const componentRegex = /(export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{|export\s+function\s+\w+\s*\([^)]*\)\s*\{)/g;
  
  content = content.replace(componentRegex, (match) => {
    return `${match}\n  const { COLORS, SHADOWS, themeName, toggleTheme } = useTheme();\n  const ${styleVarName} = useMemo(() => createStyles(COLORS, SHADOWS), [COLORS, SHADOWS]);\n`;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed', filePath);
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
