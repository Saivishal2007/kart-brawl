const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const lines = html.split('\n');

console.log("=== SEARCHING FOR MAIN MENU CSS & HTML IN CLIENT/INDEX.HTML ===");
lines.forEach((line, idx) => {
  if (line.includes('id="mainMenu"') || line.includes('#mainMenu') || line.includes('.main-menu-overlay') || line.includes('.menu-screen')) {
    console.log(`L${idx+1}: ${line.trim().substring(0, 120)}`);
  }
});
