const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const lines = html.split('\n');

console.log("=== INSPECTING .ui-overlay CSS (L860 to L885) ===");
for (let i = 860; i < 885 && i < lines.length; i++) {
  console.log(`L${i + 1}: ${lines[i]}`);
}
