const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend/src/screens');

const files = [
  'HomeScreen.js',
  'SearchScreen.js',
  'QueueScreen.js',
  'NowPlayingScreen.js',
  'AudioSettingsScreen.js'
];

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  
  let hookCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('useTheme()')) {
      hookCount++;
      // If it's not the very first hook injected, it's likely a mistake from my script
      if (hookCount > 1 && (lines[i].includes('const { COLORS, SHADOWS, themeName }') || lines[i].includes('const { COLORS, SHADOWS }'))) {
        lines[i] = ''; // remove hook
        // Also remove the next line which is createStyles
        if (i + 1 < lines.length && lines[i+1].includes('createStyles')) {
          lines[i+1] = '';
        }
      }
    }
  }
  
  fs.writeFileSync(filePath, lines.filter(l => l !== '').join('\n'), 'utf8');
  console.log('Fixed', file);
}
