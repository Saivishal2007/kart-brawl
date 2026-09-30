const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';
const lines = script3.split('\n');

console.log("=== SEARCHING FOR KART_CLASSES IN SCRIPT 3 ===");
lines.forEach((line, idx) => {
  if (line.includes('KART_CLASSES =') || line.includes('const KART_CLASSES')) {
    console.log(`L${idx+1}: ${line.trim()}`);
  }
});
