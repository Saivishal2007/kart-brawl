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
    label: label.substring(0, 25),
    onclick: onclickMatch ? onclickMatch[1] : 'NO_ONCLICK_ATTR'
  });
}

console.log("=== AUDIT OF ALL BUTTONS AND THEIR ONCLICK ATTRIBUTES ===");
buttons.forEach(b => {
  console.log(`[${b.index}] ID: ${b.id.padEnd(25)} | Label: ${b.label.padEnd(25)} | onclick: ${b.onclick}`);
});
