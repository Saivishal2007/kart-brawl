const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const lines = html.split('\n');

console.log("=== SEARCHING CSS LINES (L1 to L1000) FOR BACKGROUND RULES ===");
for (let i = 0; i < 1000 && i < lines.length; i++) {
  if (lines[i].includes('background')) {
    console.log(`L${i+1}: ${lines[i].trim().substring(0, 120)}`);
  }
}
