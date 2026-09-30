const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Prepare global helper exports block to insert right after window.copyRoomCode = copyRoomCode;
const windowHelpersBlock = `
window.UIState = UIState;
window.setUIState = setUIState;
window.copyRoomCode = copyRoomCode;

window.switchGarageTab = function(elOrName) {
  let tabName = typeof elOrName === 'string' ? elOrName : null;
  if (!tabName && elOrName && elOrName.getAttribute) tabName = elOrName.getAttribute('data-gtab') || elOrName.getAttribute('data-tab');
  const allTabs = document.querySelectorAll('.kb-garage-tab-btn, .garage-tab');
  if (tabName) {
    allTabs.forEach(t => {
      if (t.getAttribute('data-gtab') === tabName || t.getAttribute('data-tab') === tabName) t.classList.add('active');
      else t.classList.remove('active');
    });
    if (typeof previewState !== 'undefined') {
      previewState.tab = tabName;
      previewState.tabChanged = true;
    }
  } else if (elOrName && elOrName.classList) {
    allTabs.forEach(t => t.classList.remove('active'));
    elOrName.classList.add('active');
    const gtab = elOrName.getAttribute('data-gtab') || elOrName.getAttribute('data-tab');
    if (gtab && typeof previewState !== 'undefined') {
      previewState.tab = gtab;
      previewState.tabChanged = true;
    }
  }
  if (typeof renderGarageUI === 'function') renderGarageUI();
  if (typeof SoundFX !== 'undefined' && SoundFX.playUIClick) SoundFX.playUIClick();
};

window.openGarage = function() {
  if (typeof setUIState === 'function') setUIState(UIState.GARAGE);
  if (typeof SoundFX !== 'undefined' && SoundFX.playUIClick) SoundFX.playUIClick();
};

window.closeGarage = function() {
  if (typeof setUIState === 'function') setUIState(UIState.MAIN_MENU);
  if (typeof SoundFX !== 'undefined' && SoundFX.playUIClick) SoundFX.playUIClick();
};

window.equipGarageItem = function() {
  if (typeof previewState !== 'undefined' && previewState.selectedItem) {
    const cat = previewState.selectedCategory;
    const id = previewState.selectedItem.id || previewState.selectedItem.key;
    if (typeof EquipmentSystem !== 'undefined' && EquipmentSystem.equipItem) EquipmentSystem.equipItem(cat, id);
    if (typeof renderGarageUI === 'function') renderGarageUI();
  }
  if (typeof SoundFX !== 'undefined' && SoundFX.playUIClick) SoundFX.playUIClick();
};

window.confirmCharacterSelection = function() {
  if (typeof selectedCharTempId !== 'undefined' && typeof CharacterRegistry !== 'undefined') {
    const charObj = CharacterRegistry.getCharacter(selectedCharTempId);
    const currentLevel = (typeof ProgressionSystem !== 'undefined' && ProgressionSystem.data) ? (ProgressionSystem.data.level || 1) : 1;
    if (charObj && currentLevel >= charObj.reqLvl) {
      CharacterRegistry.setSelectedCharacterId(charObj.id);
      if (typeof setUIState === 'function') setUIState(UIState.GARAGE);
    }
  } else {
    if (typeof setUIState === 'function') setUIState(UIState.GARAGE);
  }
  if (typeof SoundFX !== 'undefined' && SoundFX.playUIClick) SoundFX.playUIClick();
};

window.handleCreateRoom = function() {
  const name = typeof getPlayerName === 'function' ? getPlayerName() : 'KartPlayer';
  try { localStorage.setItem('kb_player_name', name); } catch(e){}
  if (typeof socket !== 'undefined' && socket && socket.connected) {
    const charId = (typeof CharacterRegistry !== 'undefined' && CharacterRegistry.getSelectedCharacterId) ? CharacterRegistry.getSelectedCharacterId() : 'speedster';
    socket.emit('createRoom', { displayName: name, characterId: charId });
  } else {
    if (typeof showJoinError === 'function') showJoinError('❌ Server offline. Unable to create room.');
  }
  if (typeof SoundFX !== 'undefined' && SoundFX.playUIClick) SoundFX.playUIClick();
};

window.handleJoinSubmit = function() {
  if (typeof clearJoinError === 'function') clearJoinError();
  const input = document.getElementById('joinCodeInput');
  const code = input ? input.value.trim().toUpperCase() : '';
  if (!code || code.length !== 6) {
    if (typeof showJoinError === 'function') showJoinError('❌ Please enter a valid 6-character room code.');
    return;
  }
  const name = typeof getPlayerName === 'function' ? getPlayerName() : 'KartPlayer';
  try { localStorage.setItem('kb_player_name', name); } catch(e){}
  if (typeof socket !== 'undefined' && socket && socket.connected) {
    const charId = (typeof CharacterRegistry !== 'undefined' && CharacterRegistry.getSelectedCharacterId) ? CharacterRegistry.getSelectedCharacterId() : 'speedster';
    socket.emit('joinRoom', { roomId: code, displayName: name, characterId: charId });
  } else {
    if (typeof showJoinError === 'function') showJoinError('❌ Server offline. Unable to connect to server.');
  }
  if (typeof SoundFX !== 'undefined' && SoundFX.playUIClick) SoundFX.playUIClick();
};

window.handleLobbyReady = function() {
  if (typeof socket !== 'undefined' && socket && socket.connected && typeof isReadyRequestInFlight !== 'undefined' && !isReadyRequestInFlight) {
    isReadyRequestInFlight = true;
    socket.emit('playerReady', { ready: !isMyPlayerReady });
  }
  if (typeof SoundFX !== 'undefined' && SoundFX.playUIClick) SoundFX.playUIClick();
};

window.handleLobbyStartMatch = function() {
  if (typeof socket !== 'undefined' && socket && socket.connected && typeof isRoomHost !== 'undefined' && isRoomHost && typeof isStartRequestInFlight !== 'undefined' && !isStartRequestInFlight) {
    if (typeof isMyPlayerReady !== 'undefined' && !isMyPlayerReady) {
      if (typeof showLobbyNotice === 'function') showLobbyNotice('❌ Host must be READY before starting the match!', true);
      return;
    }
    isStartRequestInFlight = true;
    socket.emit('startMatch');
  }
  if (typeof SoundFX !== 'undefined' && SoundFX.playUIClick) SoundFX.playUIClick();
};

window.toggleSetting = function(key) {
  const el = document.getElementById('toggle' + key);
  if (!el) return;
  if (key === 'Quality') {
    const isHigh = el.textContent.trim() === 'HIGH';
    el.textContent = isHigh ? 'LOW' : 'HIGH';
    if (!isHigh) el.classList.add('active'); else el.classList.remove('active');
    try { localStorage.setItem('kb_quality', el.textContent); } catch(e){}
    if (typeof SoundFX !== 'undefined' && SoundFX.playUIClick) SoundFX.playUIClick();
    return;
  }
  el.classList.toggle('active');
  el.textContent = el.classList.contains('active') ? 'ENABLED' : 'DISABLED';
  if (typeof SoundFX !== 'undefined' && SoundFX.updateVolumes) SoundFX.updateVolumes();
  if (key === 'Music' && typeof SoundFX !== 'undefined') {
    if (el.textContent === 'ENABLED' && SoundFX.startMusic) SoundFX.startMusic();
    else if (SoundFX.stopMusic) SoundFX.stopMusic();
  }
  try { localStorage.setItem('kb_' + key.toLowerCase(), el.textContent); } catch(e){}
  if (typeof SoundFX !== 'undefined' && SoundFX.playUIClick) SoundFX.playUIClick();
};

window.spectatorCycle = function(dir) {
  if (typeof SpectatorDirector !== 'undefined' && SpectatorDirector.cycleTarget) {
    SpectatorDirector.cycleTarget(dir);
  }
  if (typeof SoundFX !== 'undefined' && SoundFX.playUIClick) SoundFX.playUIClick();
};

window.spectatorToggleMode = function() {
  if (typeof SpectatorDirector !== 'undefined' && SpectatorDirector.toggleMode) {
    SpectatorDirector.toggleMode();
  }
  if (typeof SoundFX !== 'undefined' && SoundFX.playUIClick) SoundFX.playUIClick();
};

window.leaveRoom = function() {
  if (typeof socket !== 'undefined' && socket) socket.emit('leaveRoom');
  if (typeof clearRoomClientState === 'function') clearRoomClientState();
  if (typeof setUIState === 'function') setUIState(UIState.ONLINE_MENU);
  if (typeof SoundFX !== 'undefined' && SoundFX.playUIClick) SoundFX.playUIClick();
};
`;

// Replace window export block
if (html.includes('window.UIState = UIState;\nwindow.setUIState = setUIState;\nwindow.copyRoomCode = copyRoomCode;')) {
  html = html.replace(
    'window.UIState = UIState;\nwindow.setUIState = setUIState;\nwindow.copyRoomCode = copyRoomCode;',
    windowHelpersBlock
  );
  console.log('Successfully replaced window exports in index.html');
} else {
  console.error('Could not find window.copyRoomCode target pattern in index.html');
}

// 2. Also expose SpectatorDirector on window where SpectatorDirector object is defined
if (html.includes('const SpectatorDirector = {')) {
  html = html.replace('const SpectatorDirector = {', 'window.SpectatorDirector = SpectatorDirector;\nconst SpectatorDirector = {');
  console.log('Successfully exposed SpectatorDirector on window');
}

// Write modified HTML back
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('client/index.html updated successfully');
