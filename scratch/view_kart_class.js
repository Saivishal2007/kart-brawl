const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';
const lines = script3.split('\n');

console.log("=== INSPECTING Kart CONSTRUCTOR IN SCRIPT 3 ===");
lines.forEach((line, idx) => {
  if (line.includes('function Kart(') || line.includes('class Kart')) {
    console.log(`Kart constructor defined at Line ${idx+1}`);
    for (let i = idx; i < idx + 40; i++) {
      console.log(`  L${i+1}: ${lines[i]}`);
    }
  }
});
