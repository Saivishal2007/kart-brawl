const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';
const lines = script3.split('\n');

console.log("=== SIMULATING INITIALIZATION AND FIRST FRAME OF ANIMATE ===");

// Extract lines inside animate function
let animateStart = -1, animateEnd = -1;
lines.forEach((line, idx) => {
  if (line.includes('function animate()')) animateStart = idx;
  if (line.includes('requestAnimationFrame(animate);') && idx > 5950) animateEnd = idx;
});

console.log(`animate() is from line ${animateStart+1} to line ${animateEnd+1}`);
for (let i = animateStart; i <= animateStart + 45; i++) {
  console.log(`L${i+1}: ${lines[i]}`);
}
