const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const lines = html.split('\n');

console.log("=== SEARCHING FOR BODY CSS IN CLIENT/INDEX.HTML ===");
lines.forEach((line, idx) => {
  if (line.includes('body {') || line.includes('body{')) {
    console.log(`L${idx+1}: ${line.trim()}`);
  }
});
