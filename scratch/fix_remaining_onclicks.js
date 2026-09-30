const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Fix buttons 10, 24, 28
html = html.replace(
  'onclick="if(window.socket) socket.emit(\'leaveRoom\'); if(window.setUIState) setUIState(\'ONLINE_MENU\')"',
  'onclick="if(window.leaveRoom) window.leaveRoom(); else if(window.setUIState) window.setUIState(\'ONLINE_MENU\');"'
);
html = html.replace(
  'onclick="if(window.socket) socket.emit(\'leaveRoom\'); if(window.setUIState) setUIState(\'ONLINE_MENU\')"',
  'onclick="if(window.leaveRoom) window.leaveRoom(); else if(window.setUIState) window.setUIState(\'ONLINE_MENU\');"'
);

// Fix Spectator buttons
html = html.replace(
  '<button class="spectator-btn" id="btnPrevSpectator">◀</button>',
  '<button class="spectator-btn" id="btnPrevSpectator" onclick="if(window.spectatorCycle) window.spectatorCycle(-1)">◀</button>'
);
html = html.replace(
  '<button class="spectator-btn" id="btnNextSpectator">▶</button>',
  '<button class="spectator-btn" id="btnNextSpectator" onclick="if(window.spectatorCycle) window.spectatorCycle(1)">▶</button>'
);
html = html.replace(
  '<button class="spectator-btn" id="spectatorCamModeBtn" style="min-width:180px;">🎬 ACTION DIRECTOR</button>',
  '<button class="spectator-btn" id="spectatorCamModeBtn" style="min-width:180px;" onclick="if(window.spectatorToggleMode) window.spectatorToggleMode()">🎬 ACTION DIRECTOR</button>'
);

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Fixed remaining inline onclick attributes');
