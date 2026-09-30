const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';
const lines = script3.split('\n');

console.log("=== FULL INSPECTION OF animate() BODY ===");
let inAnimate = false;
lines.forEach((line, idx) => {
  if (line.includes('function animate()')) inAnimate = true;
  if (inAnimate) {
    console.log(`L${idx+1}: ${line}`);
    if (line.includes('renderer.render(scene, camera);')) {
      inAnimate = false;
    }
  }
});
