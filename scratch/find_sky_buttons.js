const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const buttonRegex = /<button[^>]*>([\s\S]*?)<\/button>/gi;
let match;
let skyButtons = [];

while ((match = buttonRegex.exec(html)) !== null) {
  const fullTag = match[0];
  if (fullTag.toLowerCase().includes('sky') || fullTag.toLowerCase().includes('weather') || fullTag.toLowerCase().includes('btnweathertoggle')) {
    skyButtons.push(fullTag);
  }
}

console.log("=== SKY / WEATHER BUTTONS FOUND IN HTML ===");
skyButtons.forEach(b => console.log("  ", b));
