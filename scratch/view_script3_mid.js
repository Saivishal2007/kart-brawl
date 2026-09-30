const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';
const lines = script3.split('\n');

console.log("=== SCRIPT 3 LINES 60 to 200 ===");
for (let i = 60; i < 200 && i < lines.length; i++) {
  console.log(`L${i + 1}: ${lines[i]}`);
}
