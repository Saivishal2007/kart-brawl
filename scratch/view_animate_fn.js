const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';
const lines = script3.split('\n');

console.log("=== INSPECTING ANIMATE LOOP (L5830 to L5920) ===");
for (let i = 5830; i < 5920 && i < lines.length; i++) {
  console.log(`L${i + 1}: ${lines[i]}`);
}
