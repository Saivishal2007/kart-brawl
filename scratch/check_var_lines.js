const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';
const lines = script3.split('\n');

console.log("=== CHECKING VARIABLE DEFINITIONS VS ANIMATE LINE NUMBERS ===");
const vars = ['SpectatorDirector', 'ReplaySystem', 'boostTextures', 'clouds', 'stadiumSectors', 'stadiumFlashes', 'floatingHazards', 'pickups'];

vars.forEach(v => {
  lines.forEach((line, idx) => {
    if (line.includes(`const ${v} =`) || line.includes(`let ${v} =`) || line.includes(`var ${v} =`) || line.includes(`function ${v}`)) {
      console.log(`${v} defined at Line ${idx+1}: ${line.trim().substring(0, 100)}`);
    }
  });
});

lines.forEach((line, idx) => {
  if (line.includes('function animate()')) {
    console.log(`function animate() defined at Line ${idx+1}`);
  }
});
