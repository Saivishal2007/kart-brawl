const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';
const lines = script3.split('\n');

console.log("=== CHECKING ALL DECLARATIONS OF 'scene' IN SCRIPT 3 ===");
lines.forEach((line, idx) => {
  if (line.includes('let scene') || line.includes('var scene') || line.includes('const scene') || line.includes('scene = new THREE.Scene')) {
    console.log(`L${idx+1}: ${line.trim()}`);
  }
});
