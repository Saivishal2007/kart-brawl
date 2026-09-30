const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const lines = html.split('\n');

console.log("=== INSPECTING SCREEN CONTAINER CSS ===");
lines.forEach((line, idx) => {
  if (line.includes('#mainMenu') || line.includes('.menu-overlay') || line.includes('.kb-screen') || line.includes('.main-menu-content') || line.includes('#c {')) {
    console.log(`L${idx+1}: ${line.trim().substring(0, 120)}`);
  }
});
