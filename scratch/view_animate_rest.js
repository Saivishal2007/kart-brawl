const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';
const lines = script3.split('\n');

console.log("=== INSPECTING ANIMATE LOOP (L5920 to L5990) ===");
for (let i = 5920; i < 5990 && i < lines.length; i++) {
  console.log(`L${i + 1}: ${lines[i]}`);
}
