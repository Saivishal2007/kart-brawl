const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const lines = html.split('\n');

console.log("=== CHECKING CAMERA & CANVAS IN CLIENT/INDEX.HTML ===");
lines.forEach((line, idx) => {
  if (line.includes('PerspectiveCamera') || line.includes('renderer =') || line.includes('#c') || line.includes('canvas')) {
    console.log(`L${idx+1}: ${line.trim().substring(0, 120)}`);
  }
});
