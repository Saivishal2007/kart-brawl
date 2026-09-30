const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const lines = html.split('\n');

console.log("=== INSPECTING #kb-bg-layer CSS (L290 to L330) ===");
for (let i = 290; i < 330 && i < lines.length; i++) {
  console.log(`L${i + 1}: ${lines[i]}`);
}
