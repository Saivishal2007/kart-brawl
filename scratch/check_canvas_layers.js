const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const lines = html.split('\n');

console.log("=== SEARCHING FOR #kb-bg-layer AND #c CANVAS STYLES ===");
lines.forEach((line, idx) => {
  if (line.includes('kb-bg-layer') || line.includes('id="c"') || line.includes('#c {')) {
    console.log(`L${idx+1}: ${line.trim().substring(0, 120)}`);
  }
});
