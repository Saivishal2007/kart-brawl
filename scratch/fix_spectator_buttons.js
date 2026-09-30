const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Fix spectator buttons
html = html.replace(
  '<button class="spectator-btn" id="btnPrevSpectator">◀</button>',
  '<button class="spectator-btn" id="btnPrevSpectator" onclick="if(window.spectatorCycle) spectatorCycle(-1)">◀</button>'
);
html = html.replace(
  '<button class="spectator-btn" id="btnNextSpectator">▶</button>',
  '<button class="spectator-btn" id="btnNextSpectator" onclick="if(window.spectatorCycle) spectatorCycle(1)">▶</button>'
);
html = html.replace(
  '<button class="spectator-btn" id="spectatorCamModeBtn" style="min-width:180px;">🎬 ACTION DIRECTOR</button>',
  '<button class="spectator-btn" id="spectatorCamModeBtn" style="min-width:180px;" onclick="if(window.spectatorToggleMode) spectatorToggleMode()">🎬 ACTION DIRECTOR</button>'
);

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Spectator buttons updated with inline onclick attributes');
