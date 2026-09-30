const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';
const lines = script3.split('\n');

console.log("=== SEARCHING FOR ERRORS IN GAME LOOP FUNCTIONS ===");

// Let's search for functions called inside animate during UIState.GAME:
const gameLoopFns = [
  'integrateKart',
  'resolveKartCollisions',
  'updateProjectiles',
  'updateMines',
  'updatePickups',
  'updateParticles',
  'updateSuperNovas',
  'updateArenaEvents',
  'updateCamera',
  'updateHUD',
  'spawnNitroFlame'
];

gameLoopFns.forEach(fn => {
  lines.forEach((line, idx) => {
    if (line.includes(`function ${fn}`)) {
      console.log(`${fn} defined at Line ${idx+1}`);
    }
  });
});
