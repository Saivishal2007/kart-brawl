const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const lines = html.split('\n');

console.log("=== INSPECTING .ui-overlay CSS & MAIN MENU HTML (L1330 to L1420) ===");
lines.forEach((line, idx) => {
  if (line.includes('.ui-overlay') || (idx >= 1330 && idx <= 1360)) {
    console.log(`L${idx+1}: ${line.trim().substring(0, 120)}`);
  }
});
