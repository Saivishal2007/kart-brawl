const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const lines = html.split('\n');

console.log("=== SEARCHING FOR #startScreen IN CLIENT/INDEX.HTML ===");
lines.forEach((line, idx) => {
  if (line.includes('startScreen')) {
    console.log(`L${idx+1}: ${line.trim()}`);
  }
});
