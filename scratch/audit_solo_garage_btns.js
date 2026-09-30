const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const buttonRegex = /<button[^>]*>([\s\S]*?)<\/button>/gi;
let match;
let buttons = [];

while ((match = buttonRegex.exec(html)) !== null) {
  const fullTag = match[0];
  const label = match[1].replace(/<[^>]+>/g, '').trim();
  const idMatch = fullTag.match(/id="([^"]+)"/i);
  const onclickMatch = fullTag.match(/onclick="([^"]+)"/i);
  
  buttons.push({
    index: buttons.length,
    id: idMatch ? idMatch[1] : 'NO_ID',
    label: label.substring(0, 30),
    onclick: onclickMatch ? onclickMatch[1] : 'NO_ONCLICK_ATTR',
    fullTag: fullTag.substring(0, 150)
  });
}

console.log("=== AUDIT OF ALL SOLO AND GARAGE BUTTONS ===");
buttons.forEach(b => {
  if (b.id.toLowerCase().includes('solo') || b.id.toLowerCase().includes('garage') || b.id.toLowerCase().includes('char') || b.label.toLowerCase().includes('solo') || b.label.toLowerCase().includes('garage') || b.label.toLowerCase().includes('engine') || b.label.toLowerCase().includes('equip')) {
    console.log(`[${b.index}] ID: ${b.id.padEnd(25)} | Label: ${b.label.padEnd(25)} | onclick: ${b.onclick}`);
  }
});
