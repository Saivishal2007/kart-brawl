const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const lines = html.split('\n');

console.log("=== SEARCHING FOR #c STYLES AND BODY STYLES ===");
lines.forEach((line, idx) => {
  if (line.includes('#c') || line.includes('body {') || line.includes('canvas') || line.includes('z-index')) {
    if (line.includes('{') || line.includes('canvas')) {
      console.log(`L${idx+1}: ${line.trim().substring(0, 120)}`);
    }
  }
});
