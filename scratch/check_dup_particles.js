const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';
const lines = script3.split('\n');

console.log("=== INSPECTING updateParticles DEFINITION 1 (L3975 to L3995) ===");
for (let i = 3975; i < 3995 && i < lines.length; i++) {
  console.log(`L${i + 1}: ${lines[i]}`);
}

console.log("\n=== INSPECTING updateParticles DEFINITION 2 (L4895 to L4915) ===");
for (let i = 4895; i < 4915 && i < lines.length; i++) {
  console.log(`L${i + 1}: ${lines[i]}`);
}
