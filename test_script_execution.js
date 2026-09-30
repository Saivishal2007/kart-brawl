const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'client', 'index.html'), 'utf8');

// Search for external scripts in head/body
const scriptSrcRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
let match;
console.log('=== External Script Imports in index.html ===');
while ((match = scriptSrcRegex.exec(content)) !== null) {
  console.log('Script SRC:', match[1]);
}

// Find lines referencing global objects like THREE, socket, localStorage, AudioContext
console.log('\n=== Checking global references before event listeners ===');
const lines = content.split('\n');
let insideScript = false;
let scriptLineCount = 0;

lines.forEach((line, i) => {
  if (line.includes('<script>')) { insideScript = true; return; }
  if (line.includes('</script>')) { insideScript = false; return; }
  if (!insideScript) return;

  scriptLineCount++;
  // Check lines that could crash if globals are missing or local storage fails
  if (line.includes('new THREE.') || line.includes('localStorage.') || line.includes('new AudioContext')) {
    if (scriptLineCount < 4000) {
      console.log(`L${i+1} (Script line ${scriptLineCount}): ${line.trim()}`);
    }
  }
});
