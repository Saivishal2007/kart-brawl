const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'client', 'index.html'), 'utf8');

// Extract main script
const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/gi);
const mainScript = scriptMatch ? scriptMatch[scriptMatch.length - 1] : '';

// Check for "use strict"
console.log('Script includes use strict:', mainScript.includes('"use strict"'));

// Let's check for any variables assigned without var/let/const
const assignmentRegex = /^\s*([a-zA-Z0-9_$]+)\s*=\s*[^=]/gm;
let match;
const globalVars = new Set(['window', 'document', 'console', 'localStorage', 'sessionStorage', 'navigator', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'location', 'performance', 'Math', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp', 'JSON', 'THREE', 'io', 'socket', 'UIState', 'UIManager', 'SoundFX', 'Haptics', 'ProgressionSystem', 'CharacterRegistry', 'KART_CLASSES', 'WEAPONS', 'PICKUP_TYPES', 'PICKUP_COLORS', 'EquipmentSystem', 'CosmeticsRegistry']);

const undeclaredAssignments = [];
while ((match = assignmentRegex.exec(mainScript)) !== null) {
  const varName = match[1];
  if (!globalVars.has(varName) && !mainScript.includes(`let ${varName}`) && !mainScript.includes(`const ${varName}`) && !mainScript.includes(`var ${varName}`) && !mainScript.includes(`function ${varName}`)) {
    undeclaredAssignments.push(varName);
  }
}

console.log('Potential undeclared assignments:', [...new Set(undeclaredAssignments)]);
