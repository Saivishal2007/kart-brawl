const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Find all buttons in HTML
const buttonRegex = /<button[^>]*>([\s\S]*?)<\/button>/gi;
let match;
let buttons = [];

while ((match = buttonRegex.exec(html)) !== null) {
  const fullTag = match[0];
  const label = match[1].replace(/<[^>]+>/g, '').trim();
  const idMatch = fullTag.match(/id="([^"]+)"/i);
  const onclickMatch = fullTag.match(/onclick="([^"]+)"/i);
  const classMatch = fullTag.match(/class="([^"]+)"/i);
  
  buttons.push({
    id: idMatch ? idMatch[1] : null,
    label: label.substring(0, 30),
    onclick: onclickMatch ? onclickMatch[1] : null,
    class: classMatch ? classMatch[1] : null,
    fullTag: fullTag.substring(0, 120)
  });
}

console.log(`Found ${buttons.length} buttons:`);
console.table(buttons);

// Also extract script 3 content and test window helper definitions
const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';

console.log("\nChecking script length:", script3.length);

// Check window object assignments in script3
const windowAssignments = script3.match(/window\.\w+\s*=/g) || [];
console.log("\nGlobal window assignments in script3:");
console.log([...new Set(windowAssignments)]);
