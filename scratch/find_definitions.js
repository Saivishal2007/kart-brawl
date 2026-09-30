const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';

const searchTerms = [
  'switchGarageTab',
  'equipGarageItem',
  'confirmCharacterSelection',
  'btnGarageEquip',
  'btnConfirmCharacter',
  'handleJoinSubmit',
  'btnJoinSubmit',
  'btnLobbyReady',
  'btnLobbyStartMatch',
  'toggleSetting',
  'toggleQuality',
  'SpectatorDirector',
  'copyRoomCode',
  'initSoloGame',
  'createRoom',
  'joinRoom'
];

console.log("=== SEARCHING FOR FUNCTION DEFINITIONS IN SCRIPT 3 ===");
searchTerms.forEach(term => {
  const matches = [];
  const lines = script3.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes(term)) {
      matches.push(`L${idx+1}: ${line.trim().substring(0, 100)}`);
    }
  });
  console.log(`\nTerm '${term}' (${matches.length} matches):`);
  matches.slice(0, 5).forEach(m => console.log("  ", m));
});
