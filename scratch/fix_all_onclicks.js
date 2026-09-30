const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

console.log("=== FIXING ALL INLINE ONCLICK ATTRIBUTES TO USE window.xxx() ===");

// List of function name replacements from bare fn() to window.fn()
const replacements = [
  { from: /onclick="if\(window\.initSoloGame\) initSoloGame\(\)"/g, to: 'onclick="if(window.initSoloGame) window.initSoloGame()"' },
  { from: /onclick="if\(window\.openGarage\) openGarage\(\)"/g, to: 'onclick="if(window.openGarage) window.openGarage()"' },
  { from: /onclick="if\(window\.closeGarage\) closeGarage\(\)"/g, to: 'onclick="if(window.closeGarage) window.closeGarage()"' },
  { from: /onclick="if\(window\.equipGarageItem\) equipGarageItem\(\)"/g, to: 'onclick="if(window.equipGarageItem) window.equipGarageItem()"' },
  { from: /onclick="if\(window\.confirmCharacterSelection\) confirmCharacterSelection\(\)"/g, to: 'onclick="if(window.confirmCharacterSelection) window.confirmCharacterSelection()"' },
  { from: /onclick="if\(window\.handleCreateRoom\) handleCreateRoom\(\)"/g, to: 'onclick="if(window.handleCreateRoom) window.handleCreateRoom()"' },
  { from: /onclick="if\(window\.handleJoinSubmit\) handleJoinSubmit\(\)"/g, to: 'onclick="if(window.handleJoinSubmit) window.handleJoinSubmit()"' },
  { from: /onclick="if\(window\.handleLobbyReady\) handleLobbyReady\(\)"/g, to: 'onclick="if(window.handleLobbyReady) window.handleLobbyReady()"' },
  { from: /onclick="if\(window\.handleLobbyStartMatch\) handleLobbyStartMatch\(\)"/g, to: 'onclick="if(window.handleLobbyStartMatch) window.handleLobbyStartMatch()"' },
  { from: /onclick="if\(window\.toggleSetting\) toggleSetting\(([^)]+)\)"/g, to: 'onclick="if(window.toggleSetting) window.toggleSetting($1)"' },
  { from: /onclick="if\(window\.switchGarageTab\) switchGarageTab\(([^)]+)\)"/g, to: 'onclick="if(window.switchGarageTab) window.switchGarageTab($1)"' },
  { from: /onclick="if\(window\.setUIState\) setUIState\(([^)]+)\)"/g, to: 'onclick="if(window.setUIState) window.setUIState($1)"' },
  { from: /onclick="event\.stopPropagation\(\);\s*if\(window\.setUIState\) setUIState\(([^)]+)\)"/g, to: 'onclick="event.stopPropagation(); if(window.setUIState) window.setUIState($1)"' }
];

let replacedCount = 0;
replacements.forEach(r => {
  const matches = html.match(r.from);
  if (matches) {
    replacedCount += matches.length;
    html = html.replace(r.from, r.to);
  }
});

console.log(`Successfully updated ${replacedCount} inline onclick attributes in index.html!`);

fs.writeFileSync(htmlPath, html, 'utf8');
