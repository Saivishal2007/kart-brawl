const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';
const lines = script3.split('\n');

console.log("=== INSPECTING updateCamera (L4924 to L4960) ===");
for (let i = 4924; i < 4960 && i < lines.length; i++) {
  console.log(`L${i + 1}: ${lines[i]}`);
}

console.log("\n=== INSPECTING updateHUD (L5061 to L5100) ===");
for (let i = 5061; i < 5100 && i < lines.length; i++) {
  console.log(`L${i + 1}: ${lines[i]}`);
}
