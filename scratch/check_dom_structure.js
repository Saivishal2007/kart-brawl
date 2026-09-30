const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const lines = html.split('\n');

console.log("=== INSPECTING HTML BODY DOM STRUCTURE ===");
lines.forEach((line, idx) => {
  if (line.includes('<canvas') || line.includes('id="mainMenu"') || line.includes('id="hud"') || line.includes('id="overlay"') || line.includes('<body') || line.includes('</body')) {
    console.log(`L${idx+1}: ${line.trim()}`);
  }
});
