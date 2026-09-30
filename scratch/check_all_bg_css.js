const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const lines = html.split('\n');

console.log("=== SEARCHING ALL BACKGROUND STYLES IN CSS ===");
lines.forEach((line, idx) => {
  if (line.includes('background') && (line.includes('#060713') || line.includes('#0a0e') || line.includes('mainMenu') || line.includes('ui-overlay') || line.includes('kb-menu'))) {
    console.log(`L${idx+1}: ${line.trim()}`);
  }
});
