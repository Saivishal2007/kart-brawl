// test-visual-assets.js
// Tests the 3D model generation, character avatars, and kart meshes
const fs = require('fs');

console.log('--- TESTING 3D ASSETS & VISUAL OVERHAUL ---');

const html = fs.readFileSync('client/index.html', 'utf8');

// Assertions on HTML & CSS
const checks = [
  { name: 'Front page overlay element exists', test: html.includes('id="mainMenu"') && html.includes('kb-hero-top-bar') },
  { name: 'Hero actions stack exists', test: html.includes('class="kb-hero-actions-stack"') },
  { name: 'Hero loadout card exists', test: html.includes('class="kb-hero-loadout-card"') },
  { name: 'Hero rotate hint exists', test: html.includes('class="kb-hero-rotate-hint"') },
  { name: 'CharacterModelFactory.createAvatar exists', test: html.includes('createAvatar(characterId, opts = {})') },
  { name: 'HeroMenuShowcase exists', test: html.includes('const HeroMenuShowcase =') },
  { name: 'All 8 characters defined in registry', test: ['racer', 'tank', 'tech', 'wildcard', 'ghost', 'bomber', 'guardian', 'rookie'].every(c => html.includes(`id: '${c}'`)) },
  { name: 'All kart classes supported in makeKartMesh', test: ['tank', 'flash', 'guardian', 'magnet', 'bomber', 'ghost'].every(k => html.includes(`classKey === '${k}'`)) },
  { name: 'Class-specific geometries present', test: html.includes('wingBlade') && html.includes('plow') && html.includes('rollBar') && html.includes('coilL') && html.includes('blastShield') },
  { name: 'Driver character sits in bucket seat with steering wheel', test: html.includes('driverAvatar.position.set(0, 0.44, -0.18)') && html.includes('steerColumn') && html.includes('steerWheel') },
  { name: 'Pedestal and neon ring in Garage stage', test: html.includes('pedMat') && html.includes('ringGeo') },
  { name: 'Driver procedural breathing and head animation', test: html.includes('updateAnimation') },
  { name: 'Clean visibility toggling in setUIState', test: html.includes('HeroMenuShowcase.setVisible(true)') && html.includes('HeroMenuShowcase.setVisible(false)') }
];

let allPassed = true;
checks.forEach((c, idx) => {
  if (c.test) {
    console.log(`✓ [PASS ${idx + 1}/${checks.length}] ${c.name}`);
  } else {
    console.error(`✗ [FAIL ${idx + 1}/${checks.length}] ${c.name}`);
    allPassed = false;
  }
});

if (allPassed) {
  console.log('\n🌟 ALL VISUAL OVERHAUL ASSERTIONS PASSED PERFECTLY!');
  process.exit(0);
} else {
  console.error('\n❌ SOME ASSERTIONS FAILED');
  process.exit(1);
}
