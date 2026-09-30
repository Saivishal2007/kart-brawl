const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const lines = html.split('\n');

console.log("=== INSPECTING CONTEXT AROUND btnWeatherToggle IN HTML ===");
lines.forEach((line, idx) => {
  if (line.includes('btnWeatherToggle')) {
    console.log(`Line ${idx+1}:`);
    for (let i = Math.max(0, idx - 15); i <= Math.min(lines.length - 1, idx + 15); i++) {
      console.log(`  L${i+1}: ${lines[i]}`);
    }
  }
});
