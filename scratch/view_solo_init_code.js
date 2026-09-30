const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';
const lines = script3.split('\n');

console.log("=== INSPECTING initSoloGame (L5365 to L5420) ===");
for (let i = 5365; i < 5420 && i < lines.length; i++) {
  console.log(`L${i + 1}: ${lines[i]}`);
}
