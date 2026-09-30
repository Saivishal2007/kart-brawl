
if (typeof THREE === 'undefined') document.write('<\/script>');


(function(){
"use strict";

/* ==========================================================================
   KART BRAWL 2.0 — CLIENT UI STATE ARCHITECTURE (PHASE 6.1)
   Decouples UI Screen State from Server-Authoritative Game State
   ========================================================================== */
const UIManager = {
  currentScreen: 'mainMenu',
  selectedTab: 'default',
  modalStack: [],
  toastQueue: [],

  screens: {
    mainMenu: 'mainMenuView',
    onlineMenu: 'onlineMenuView',
    createRoom: 'createRoomView',
    joinRoom: 'joinRoomView',
    lobby: 'lobbyPreviewView',
    soloSelect: 'soloSelectView',
    settings: 'settingsView',
    countdown: 'countdownOverlay',
    game: 'hud',
    results: 'overlay',
    death: 'deathScreen'
  },

  switchScreen(screenKey) {
    if (!this.screens[screenKey]) {
      console.warn(`[UIManager] Unknown screenKey: ${screenKey}`);
      return;
    }

    this.currentScreen = screenKey;
    const targetId = this.screens[screenKey];

    // Hide all registered screen overlays
    Object.values(this.screens).forEach(id => {
      const el = document.getElementById(id);
      if (el && id !== targetId) {
        el.style.display = 'none';
        el.classList.add('kb-screen-hidden');
      }
    });

    // Show target screen overlay with transition
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      targetEl.style.display = (screenKey === 'game') ? 'block' : 'flex';
      targetEl.classList.remove('kb-screen-hidden');
      targetEl.classList.add('kb-screen-transition');
    }

    console.log(`[UIManager] Switched screen to: ${screenKey}`);
  },

  showModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.add('active');
      this.modalStack.push(modalId);
    }
  },

  hideModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.remove('active');
      this.modalStack = this.modalStack.filter(id => id !== modalId);
    }
  },

  showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('kb-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `kb-toast kb-toast-${type}`;
    toast.textContent = message;

    if (type === 'danger') toast.style.borderColor = 'var(--kb-color-danger)';
    if (type === 'success') toast.style.borderColor = 'var(--kb-color-lime)';

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, duration);
  }
};

/* ---------------- SOCKET.IO MULTIPLAYER FOUNDATION (PHASE 1 - STEP 3 ROOMS) ---------------- */
let socket = null;
let myPlayerId = null;
let currentRoomId = null;
let isRoomHost = false;
let isMyPlayerReady = false;
let isReadyRequestInFlight = false;
let isStartRequestInFlight = false;
const remoteKarts = {};

function showLobbyNotice(msg, isError = false) {
  const el = document.getElementById('lobbyNoticeBanner');
  if (!el) return;
  el.style.display = 'block';
  el.style.borderColor = isError ? '#ff1744' : '#ffeb3b';
  el.style.color = isError ? '#ff1744' : '#ffeb3b';
  el.style.background = isError ? 'rgba(255,23,68,0.2)' : 'rgba(255,235,59,0.15)';
  el.textContent = msg;
  setTimeout(() => {
    if (el) el.style.display = 'none';
  }, 4000);
}

if (typeof io !== 'undefined') {
  socket = io();

  socket.on('connect', () => {
    myPlayerId = socket.id;
    console.log('Connected to Kart Brawl server!');
    const badge = document.getElementById('serverStatusBadge');
    if (badge) {
      badge.style.background = 'rgba(0,230,118,0.15)';
      badge.style.borderColor = '#00e676';
      badge.style.color = '#00e676';
      badge.textContent = '🟢 MULTIPLAYER SERVER ONLINE (PORT 3000)';
    }
  });

  socket.on('disconnect', () => {
    console.warn('⚠️ Disconnected from server.');
    showLobbyNotice('❌ Server connection lost. Attempting to reconnect...', true);
    const badge = document.getElementById('serverStatusBadge');
    if (badge) {
      badge.style.background = 'rgba(255,23,68,0.15)';
      badge.style.borderColor = '#ff1744';
      badge.style.color = '#ff1744';
      badge.textContent = '🔴 SERVER DISCONNECTED';
    }
  });

  socket.on('welcome', (data) => {
    console.log('Welcome Event Received:', data);
  });

  // --- Room System Event Handlers (Step 2.4 Ready System & Host Controls) ---
  socket.on('roomCreated', (data) => {
    currentRoomId = data.roomId;
    isRoomHost = true;
    isMyPlayerReady = false;
    isReadyRequestInFlight = false;
    isStartRequestInFlight = false;
    console.log(`🏠 ROOM CREATED! Room ID: ${data.roomId}`);
    
    const codeEl = document.getElementById('createRoomCodeDisplay');
    const lobbyCodeEl = document.getElementById('lobbyRoomCode');
    if (codeEl) codeEl.textContent = data.roomId;
    if (lobbyCodeEl) lobbyCodeEl.textContent = data.roomId;
    
    if (typeof setUIState === 'function') {
      setUIState(UIState.MULTIPLAYER_LOBBY);
    }
    
    if (data.spawn && typeof player !== 'undefined' && player) {
      player.pos.set(data.spawn.x, 0, data.spawn.z);
      player.yaw = data.spawn.yaw;
      player.updateMeshTransform();
    }
  });

  socket.on('roomJoined', (data) => {
    currentRoomId = data.roomId;
    isRoomHost = data.hostId === myPlayerId;
    isMyPlayerReady = false;
    isReadyRequestInFlight = false;
    isStartRequestInFlight = false;
    console.log(`🚪 ROOM JOINED! Room ID: ${data.roomId}`);

    const lobbyCodeEl = document.getElementById('lobbyRoomCode');
    if (lobbyCodeEl) lobbyCodeEl.textContent = data.roomId;

    if (typeof setUIState === 'function') {
      setUIState(UIState.MULTIPLAYER_LOBBY);
    }

    if (data.spawn && typeof player !== 'undefined' && player) {
      player.pos.set(data.spawn.x, 0, data.spawn.z);
      player.yaw = data.spawn.yaw;
      player.updateMeshTransform();
    }
  });

  socket.on('roomState', (data) => {
    currentRoomId = data.roomId;
    isRoomHost = data.hostId === myPlayerId;
    isReadyRequestInFlight = false;
    isStartRequestInFlight = false;

    const lobbyCodeEl = document.getElementById('lobbyRoomCode');
    const countEl = document.getElementById('lobbyPlayerCount');
    const statusEl = document.getElementById('lobbyServerStatus');
    const gridEl = document.getElementById('lobbySlotsGrid');
    const btnStartMatch = document.getElementById('btnLobbyStartMatch');
    const btnReady = document.getElementById('btnLobbyReady');

    if (lobbyCodeEl) lobbyCodeEl.textContent = data.roomId;
    if (countEl) countEl.textContent = `${data.playerCount} / ${data.maximumPlayers}`;

    let localReady = false;
    const playersArr = Array.isArray(data.players) ? data.players : [];

    if (gridEl) {
      let html = '';
      for (let i = 0; i < 6; i++) {
        const p = playersArr[i];
        if (p) {
          const isMe = p.id === myPlayerId;
          if (isMe) localReady = !!p.ready;
          html += `
            <div class="slot-card occupied ${isMe ? 'is-me' : ''}">
              <div class="slot-player-info">
                <span class="slot-num-badge">P${i+1}</span>
                <span>🎮 ${p.displayName} ${isMe ? '(You)' : ''}</span>
                ${p.isHost ? '<span class="host-tag">👑 HOST</span>' : ''}
              </div>
              <div class="slot-status-badge ${p.ready ? 'ready' : 'waiting'}">
                ${p.ready ? '✓ READY' : '⏳ WAITING'}
              </div>
            </div>
          `;
        } else {
          html += `
            <div class="slot-card empty">
              <div class="slot-player-info">
                <span class="slot-num-badge">P${i+1}</span>
                <span style="opacity:0.6;">EMPTY SLOT</span>
              </div>
            </div>
          `;
        }
      }
      gridEl.innerHTML = html;
    }

    isMyPlayerReady = localReady;
    if (btnReady) {
      if (isMyPlayerReady) {
        btnReady.innerHTML = '✓ READY (CLICK TO UNREADY)';
        btnReady.style.background = 'rgba(0,230,118,0.25)';
        btnReady.style.borderColor = '#00e676';
        btnReady.style.color = '#00e676';
      } else {
        btnReady.innerHTML = '🟢 READY UP';
        btnReady.style.background = 'rgba(0,0,0,0.65)';
        btnReady.style.borderColor = '#00e676';
        btnReady.style.color = '#fff';
      }
    }

    // Match Start Validation Logic
    const totalPlayers = playersArr.length;
    const allReady = totalPlayers >= 2 && playersArr.every(p => p.ready);

    if (statusEl) {
      if (totalPlayers < 2) {
        statusEl.textContent = '⏳ WAITING FOR PLAYERS (1/6)';
        statusEl.style.borderColor = '#ffeb3b';
        statusEl.style.color = '#ffeb3b';
        statusEl.style.background = 'rgba(255,235,59,0.15)';
      } else if (!allReady) {
        statusEl.textContent = '⏳ WAITING FOR ALL PLAYERS TO READY UP';
        statusEl.style.borderColor = '#ffeb3b';
        statusEl.style.color = '#ffeb3b';
        statusEl.style.background = 'rgba(255,235,59,0.15)';
      } else {
        statusEl.textContent = '🟢 ALL PLAYERS READY — CAN START';
        statusEl.style.borderColor = '#00e676';
        statusEl.style.color = '#00e676';
        statusEl.style.background = 'rgba(0,230,118,0.15)';
      }
    }

    if (btnStartMatch) {
      btnStartMatch.style.display = isRoomHost ? 'inline-flex' : 'none';
      if (isRoomHost) {
        if (allReady) {
          btnStartMatch.disabled = false;
          btnStartMatch.style.opacity = '1.0';
          btnStartMatch.style.cursor = 'pointer';
          btnStartMatch.innerHTML = '🚀 START MATCH';
        } else {
          btnStartMatch.disabled = true;
          btnStartMatch.style.opacity = '0.5';
          btnStartMatch.style.cursor = 'not-allowed';
          if (totalPlayers < 2) {
            btnStartMatch.innerHTML = '🚀 START MATCH (NEED 2+ PLAYERS)';
          } else {
            btnStartMatch.innerHTML = '🚀 START MATCH (ALL MUST BE READY)';
          }
        }
      }
    }

    if (data.status === 'COUNTDOWN' && typeof currentUIState !== 'undefined' && currentUIState !== UIState.COUNTDOWN && currentUIState !== UIState.GAME) {
      if (typeof setUIState === 'function') setUIState(UIState.COUNTDOWN);
    } else if (data.status === 'PLAYING' && typeof currentUIState !== 'undefined' && currentUIState !== UIState.GAME) {
      initMultiplayerGame(data.matchTime);
    } else if (data.status === 'WAITING' && typeof currentUIState !== 'undefined' && (currentUIState === UIState.COUNTDOWN || currentUIState === UIState.GAME)) {
      if (typeof setUIState === 'function') setUIState(UIState.MULTIPLAYER_LOBBY);
    }
  });

  socket.on('matchCountdown', (data) => {
    if (typeof setUIState === 'function' && currentUIState !== UIState.COUNTDOWN && currentUIState !== UIState.GAME) {
      setUIState(UIState.COUNTDOWN);
    }
    const numEl = document.getElementById('countdownNumber');
    if (numEl) {
      const count = data.count !== undefined ? data.count : 3;
      const textVal = count > 0 ? String(count) : 'GO!';
      if (numEl.textContent !== textVal) {
        numEl.textContent = textVal;
        numEl.style.animation = 'none';
        void numEl.offsetHeight;
        numEl.style.animation = 'countdownPop 0.8s ease-out infinite alternate';
        if (count > 0) {
          SoundFX.playCountdownBeep(count);
        } else {
          SoundFX.playCountdownGo();
        }
      }
    }
  });

  socket.on('matchStateChanged', (data) => {
    console.log(`⏱️ Match state changed: ${data.status}`);
    if (data.status === 'COUNTDOWN') {
      if (typeof setUIState === 'function') setUIState(UIState.COUNTDOWN);
    } else if (data.status === 'PLAYING') {
      initMultiplayerGame(data.matchTime);
    } else if (data.status === 'WAITING') {
      if (typeof setUIState === 'function' && (currentUIState === UIState.COUNTDOWN || currentUIState === UIState.GAME)) {
        setUIState(UIState.MULTIPLAYER_LOBBY);
        showLobbyNotice('⚠️ Match reset to lobby state.');
      }
    }
  });

  socket.on('gameStarted', (data) => {
    console.log('🚀 GAME STARTED event received!');
    initMultiplayerGame(data ? data.matchTime : 120);
  });

  socket.on('playerJoined', (data) => {
    showLobbyNotice(`🎮 ${data.displayName || 'A new player'} joined the room.`);
  });

  socket.on('playerLeft', (data) => {
    showLobbyNotice('🚪 A player left the room.');
  });

function cleanMatchStateForLobby() {
  lastSentInputStr = '';
  for (let k in keys) keys[k] = false;
  for (let t in touch) touch[t] = false;
  spacePressed = false;

  const killfeed = document.getElementById('killfeed');
  if (killfeed) killfeed.innerHTML = '';

  const banner = document.getElementById('eventBanner');
  if (banner) banner.style.display = 'none';

  const deathScreen = document.getElementById('deathScreen');
  if (deathScreen) deathScreen.style.display = 'none';

  const countdownOverlay = document.getElementById('countdownOverlay');
  if (countdownOverlay) countdownOverlay.style.display = 'none';
  const numEl = document.getElementById('countdownNumber');
  if (numEl) numEl.textContent = '3';
}

function clearRoomClientState() {
  cleanMatchStateForLobby();

  currentRoomId = null;
  isRoomHost = false;
  isMyPlayerReady = false;
  isReadyRequestInFlight = false;
  isStartRequestInFlight = false;

  for (const id in remoteKarts) {
    const rk = remoteKarts[id];
    if (rk.mesh) scene.remove(rk.mesh);
    const idx = karts.indexOf(rk);
    if (idx !== -1) karts.splice(idx, 1);
    delete remoteKarts[id];
  }

  for (const id in mpPowerupMeshes) {
    const item = mpPowerupMeshes[id];
    if (item.mesh) scene.remove(item.mesh);
    delete mpPowerupMeshes[id];
  }

  const codeEl = document.getElementById('createRoomCodeDisplay');
  const lobbyCodeEl = document.getElementById('lobbyRoomCode');
  if (codeEl) codeEl.textContent = '------';
  if (lobbyCodeEl) lobbyCodeEl.textContent = '------';
}

  socket.on('roomLeft', (data) => {
    console.log(`🚪 Left Room: ${data ? data.roomId : ''}`);
    clearRoomClientState();
    if (typeof setUIState === 'function') {
      setUIState(UIState.ONLINE_MENU);
    }
  });

  socket.on('hostChanged', (data) => {
    isRoomHost = data.newHostId === myPlayerId;
    console.log(`👑 Host transferred to: ${data.newHostId}`);
    if (isRoomHost) {
      showLobbyNotice('👑 You are now the room host!');
    }
    const btnStartMatch = document.getElementById('btnLobbyStartMatch');
    if (btnStartMatch) {
      btnStartMatch.style.display = isRoomHost ? 'inline-flex' : 'none';
    }
  });

  socket.on('startMatchFailed', (data) => {
    isStartRequestInFlight = false;
    console.warn('❌ Start Match Failed:', data.reason);
    showLobbyNotice(`❌ ${data.reason || 'Unable to start match.'}`, true);
  });

  socket.on('roomFull', (data) => {
    console.warn('❌ Room Full:', data.message);
    if (typeof showJoinError === 'function') {
      showJoinError(`❌ ${data.message || 'Room is full (Max 6 players).'}`);
    }
  });

  socket.on('roomNotFound', (data) => {
    console.warn('❌ Room Not Found:', data.message);
    if (typeof showJoinError === 'function') {
      showJoinError(`❌ ${data.message || 'Room not found.'}`);
    }
  });

  socket.on('gameAlreadyStarted', (data) => {
    console.warn('❌ Game Already Started:', data.message);
    if (typeof showJoinError === 'function') {
      showJoinError(`❌ ${data.message || 'That match has already started.'}`);
    }
  });

  socket.on('gameState', (data) => {
    if (!data || !Array.isArray(data.players)) return;

    if (data.matchTime !== undefined) {
      roundElapsed = ROUND_TIME - data.matchTime;
    }
    if (data.stormRadius !== undefined) {
      stormR = data.stormRadius;
    }
    if (Array.isArray(data.powerups) && typeof syncMultiplayerPowerups === 'function') {
      syncMultiplayerPowerups(data.powerups);
    }

    const activeServerIds = new Set();

    data.players.forEach(p => {
      activeServerIds.add(p.id);

      if (p.id === myPlayerId) {
        // Authoritative reconciliation for local player
        if (typeof player !== 'undefined' && player) {
          player.pos.x = p.x;
          player.pos.y = p.y;
          player.pos.z = p.z;
          player.yaw = p.yaw;
          player.speed = p.speed;
          player.inAir = !p.grounded;
          player.hp = p.hp;
          player.maxHp = p.maxHp;
          player.kills = p.kills;
          player.deaths = p.deaths;
          player.alive = p.alive;
          player.weapon = p.weapon || 'pea';
          player.ammo = p.ammo;
          if (p.nitroActive) player.nitroT = 0.5;
          player.updateMeshTransform();
        }
      } else {
        if (!remoteKarts[p.id]) {
          // Instantiate new remote Kart with synchronized 3D character avatar
          const spawnPos = { x: p.x, z: p.z };
          const name = p.displayName || ('PLAYER ' + p.id.substr(0, 4));
          const remoteKart = new Kart(name, 'tank', false, spawnPos, p.characterId || 'racer');
          remoteKart.isRemote = true;
          remoteKart.targetPos = new THREE.Vector3(p.x, p.y || 0, p.z);
          remoteKart.targetYaw = p.yaw;
          remoteKart.nitroActive = p.nitroActive;
          remoteKart.hp = p.hp;
          remoteKart.maxHp = p.maxHp;
          remoteKart.kills = p.kills;
          remoteKart.deaths = p.deaths;
          remoteKart.alive = p.alive;
          remoteKart.weapon = p.weapon || 'pea';
          remoteKart.ammo = p.ammo;
          remoteKarts[p.id] = remoteKart;
          karts.push(remoteKart);
          console.log(`Spawned Remote Player Kart: ${p.id}`);
        } else {
          // Update target position and combat properties for interpolation
          const rk = remoteKarts[p.id];
          rk.targetPos.set(p.x, p.y || 0, p.z);
          rk.targetYaw = p.yaw;
          rk.speed = p.speed;
          rk.nitroActive = p.nitroActive;
          rk.hp = p.hp;
          rk.maxHp = p.maxHp;
          rk.kills = p.kills;
          rk.deaths = p.deaths;
          rk.alive = p.alive;
          rk.weapon = p.weapon || 'pea';
          rk.ammo = p.ammo;
        }
      }
    });

    // Remove disconnected remote karts
    for (const id in remoteKarts) {
      if (!activeServerIds.has(id)) {
        const rk = remoteKarts[id];
        if (rk.mesh) scene.remove(rk.mesh);
        const idx = karts.indexOf(rk);
        if (idx !== -1) karts.splice(idx, 1);
        delete remoteKarts[id];
        console.log(`Removed Remote Player Kart: ${id}`);
      }
    }
  });

  // --- Authoritative Combat & Step 6 Event Listeners ---
  socket.on('weaponFired', (data) => {
    if (data.ownerId !== myPlayerId) {
      const rk = remoteKarts[data.ownerId];
      if (rk) {
        rk.weapon = data.weapon;
        fireWeapon(rk);
      }
    }
  });

  socket.on('playerDamaged', (data) => {
    const victim = (data.targetId === myPlayerId) ? player : remoteKarts[data.targetId];
    if (victim) {
      const isDirectHit = (data.dmg >= 25);
      spawnExplosion(victim.pos.clone(), 0xff1744, isDirectHit);
      if (data.targetId === myPlayerId) {
        const attacker = remoteKarts[data.attackerId];
        const attackerPos = attacker ? attacker.pos : null;
        triggerDamageTaken(attackerPos, data.dmg);
      }
      if (data.attackerId === myPlayerId && data.targetId !== myPlayerId) {
        triggerHitConfirmation(data.dmg, isDirectHit);
      }
    }
  });

  socket.on('playerDied', (data) => {
    if (typeof pushKillFeed === 'function') {
      pushKillFeed(`💥 ${data.killerName || 'The Void'} eliminated ${data.targetName}`);
    }
    if (data.killerId === myPlayerId && data.targetId !== myPlayerId) {
      SoundFX.playEliminationChime();
      if (typeof flashCenterMsg === 'function') {
        flashCenterMsg(`🎯 ELIMINATED ${data.targetName.toUpperCase()}! (+40 XP)`);
      }
      triggerHitConfirmation(100, true);
    }
    if (data.targetId === myPlayerId) {
      if (typeof showDeathScoreboard === 'function') {
        showDeathScoreboard(data.killerName || 'The Void');
      }
    }
  });

  socket.on('playerRespawned', (data) => {
    if (data.id === myPlayerId) {
      const deathScreen = document.getElementById('deathScreen');
      if (deathScreen) deathScreen.style.display = 'none';
      if (player) {
        player.pos.set(data.x, 0, data.z);
        player.hp = data.hp || 100;
        player.alive = true;
        player.updateMeshTransform();
      }
    }
  });

  socket.on('mineDetonated', (data) => {
    spawnExplosion(new THREE.Vector3(data.x, 0.4, data.z), 0xff2a5f, true);
  });

  // --- Step 6 Powerups, Events & Match State Handlers ---
  socket.on('powerupPickedUp', (data) => {
    if (typeof flashCenterMsg === 'function') {
      flashCenterMsg(`📦 ${data.playerName} picked up ${data.type.toUpperCase()}!`);
    }
    if (data.playerId === myPlayerId && typeof player !== 'undefined' && player) {
      if (data.type === 'rocket' || data.type === 'triple' || data.type === 'mine') {
        player.weapon = data.type;
        player.ammo = WEAPONS[data.type] ? WEAPONS[data.type].ammo : 5;
      } else if (data.type === 'nitro') {
        player.nitroT = 3.5;
      } else if (data.type === 'shield') {
        player.shieldT = 4.5;
      }
    }
  });

  socket.on('powerupRespawned', (data) => {
    if (typeof spawnExplosion === 'function') {
      spawnExplosion(new THREE.Vector3(data.x, 1.0, data.z), 0x00e5ff);
    }
  });

  socket.on('arenaEventStarted', (data) => {
    const banner = document.getElementById('eventBanner');
    if (banner) {
      banner.style.display = 'block';
      banner.textContent = `${data.name}: ${data.desc}`;
      setTimeout(() => { if (banner) banner.style.display = 'none'; }, 6000);
    }
    if (typeof flashCenterMsg === 'function') {
      flashCenterMsg(`ARENA EVENT: ${data.name}`);
    }
  });

  socket.on('arenaEventEnded', (data) => {
    const banner = document.getElementById('eventBanner');
    if (banner) banner.style.display = 'none';
  });

  socket.on('meteorImpact', (data) => {
    if (typeof spawnExplosion === 'function') {
      spawnExplosion(new THREE.Vector3(data.x, 0.5, data.z), 0xff9100);
    }
  });

  socket.on('matchCountdown', (data) => {
    const numEl = document.getElementById('countdownNumber');
    if (numEl) {
      numEl.textContent = data.count > 0 ? data.count : 'GO!';
    }
    if (typeof setUIState === 'function' && currentUIState !== UIState.COUNTDOWN && currentUIState !== UIState.GAME) {
      setUIState(UIState.COUNTDOWN);
    }
    if (typeof flashCenterMsg === 'function') {
      flashCenterMsg(`MATCH STARTING IN ${data.count}...`);
    }
  });

  socket.on('matchStateChanged', (data) => {
    console.log('Match State Changed:', data);
    if (data.status === 'COUNTDOWN') {
      const numEl = document.getElementById('countdownNumber');
      if (numEl) numEl.textContent = data.countdown || 3;
      if (typeof setUIState === 'function') setUIState(UIState.COUNTDOWN);
    } else if (data.status === 'PLAYING') {
      if (typeof setUIState === 'function') setUIState(UIState.GAME);
      if (typeof flashCenterMsg === 'function') flashCenterMsg('🏁 MATCH STARTED! BRAWL!');
    }
  });

  socket.on('matchEnded', (data) => {
    console.log('Match Ended:', data);
    if (typeof showMultiplayerEndScreen === 'function') {
      showMultiplayerEndScreen(data.standings || []);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected from Kart Brawl server!', reason);
    const statusEl = document.getElementById('lobbyServerStatus');
    if (statusEl) {
      statusEl.style.background = 'rgba(255,23,68,0.2)';
      statusEl.style.borderColor = '#ff1744';
      statusEl.style.color = '#ff1744';
      statusEl.textContent = '🔴 CONNECTION LOST';
    }
  });

  // --- Exposed Console Commands for Room Testing ---
  window.createRoom = function(displayName) {
    if (socket) socket.emit('createRoom', { displayName });
  };
  window.joinRoom = function(roomId, displayName) {
    if (socket) socket.emit('joinRoom', { roomId, displayName });
  };
  window.leaveRoom = function() {
    if (socket) socket.emit('leaveRoom');
  };
  window.setReady = function(ready = true) {
    if (socket) socket.emit('playerReady', { ready: !!ready });
  };
  window.startMatch = function() {
    if (socket) socket.emit('startMatch');
  };
}

let lastSentInputStr = '';
function sendPlayerInput() {
  if (currentUIState !== UIState.GAME || !socket || !socket.connected) return;
  const inp = {
    forward: !!(keys['KeyW'] || keys['ArrowUp'] || touch.fwd),
    backward: !!(keys['KeyS'] || keys['ArrowDown'] || touch.back),
    left: !!(keys['KeyA'] || keys['ArrowLeft'] || touch.left),
    right: !!(keys['KeyD'] || keys['ArrowRight'] || touch.right),
    jump: !!(keys['Space'] || spacePressed),
    nitro: !!(keys['ShiftLeft'] || keys['ShiftRight'] || touch.boost)
  };
  const str = JSON.stringify(inp);
  if (str !== lastSentInputStr) {
    lastSentInputStr = str;
    socket.emit('playerInput', inp);
  }
}




let currentQuality = 'HIGH';
function applyQualitySettings(quality) {
  currentQuality = quality || 'HIGH';
  let dprCap = 1.5;
  if (currentQuality === 'LOW') {
    dprCap = 1.0;
    renderer.shadowMap.enabled = false;
    if (typeof MAX_PARTICLES !== 'undefined') MAX_PARTICLES = 50;
  } else if (currentQuality === 'MEDIUM') {
    dprCap = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    if (typeof MAX_PARTICLES !== 'undefined') MAX_PARTICLES = 100;
  } else {
    dprCap = 1.5;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (typeof MAX_PARTICLES !== 'undefined') MAX_PARTICLES = 150;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  try { localStorage.setItem('kb_quality', currentQuality); } catch(e){}
}

/* ---------------- SETUP & SCENE ---------------- */
const canvas = document.getElementById('c');
let renderer, scene, camera, ambientLight, sun, hemiLight;

try {
  renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x4aa3ff);
  scene.fog = new THREE.FogExp2(0x75bbfd, 0.0035);

  camera = new THREE.PerspectiveCamera(65, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 16, 24);

  window.addEventListener('resize', ()=>{
    if (camera && renderer) {
      camera.aspect = window.innerWidth/window.innerHeight;
      camera.updateProjectionMatrix();
      applyQualitySettings(currentQuality);
    }
  });

  ambientLight = new THREE.AmbientLight(0xd0e5ff, 0.95);
  scene.add(ambientLight);

  sun = new THREE.DirectionalLight(0xfffaed, 1.4);
  sun.position.set(70, 110, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
  sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110;
  scene.add(sun);

  hemiLight = new THREE.HemisphereLight(0x70cfff, 0x448833, 0.55);
  scene.add(hemiLight);
} catch (e) {
  console.warn("WebGL Scene initialization warning:", e);
}

/* ---------------- PERSISTENT PROGRESSION & COSMETICS SYSTEM ---------------- */
const ProgressionSystem = {
  STORAGE_KEY: 'kart_brawl_profile_v2',
  data: {
    xp: 0,
    level: 1,
    unlockedTrails: ['default'],
    unlockedHorns: ['default'],
    unlockedEmotes: ['default'],
    selectedTrail: 'default',
    selectedHorn: 'default',
    selectedEmote: 'default'
  },
  LEVEL_REWARDS: {
    1: { type:'trail', id:'default', name:'Standard Exhaust Trail' },
    2: { type:'trail', id:'flame', name:'🔥 Flame Exhaust Trail' },
    3: { type:'horn', id:'beep', name:'🔔 BEEP BEEP HORN' },
    4: { type:'trail', id:'rainbow', name:'🌈 Rainbow Spark Trail' },
    5: { type:'horn', id:'boom', name:'💣 BOOM HORN' },
    6: { type:'trail', id:'galaxy', name:'🌌 Galaxy Aura Trail' },
    7: { type:'emote', id:'victory', name:'👑 Royal Victory Emote' },
    8: { type:'trail', id:'gold', name:'✨ Gold Sparkles Trail' }
  },
  COSMETICS: {
    trails: [
      { id:'default', name:'Standard Exhaust', icon:'💨', reqLvl:1 },
      { id:'flame', name:'🔥 Flame Exhaust', icon:'🔥', reqLvl:2 },
      { id:'rainbow', name:'🌈 Rainbow Sparks', icon:'🌈', reqLvl:4 },
      { id:'galaxy', name:'🌌 Galaxy Aura', icon:'🌌', reqLvl:6 },
      { id:'gold', name:'✨ Gold Sparkles', icon:'✨', reqLvl:8 }
    ],
    horns: [
      { id:'default', name:'🎺 Standard Honk', icon:'🎺', text:'🎺 HONK HONK!', reqLvl:1 },
      { id:'beep', name:'🔔 Beep Beep', icon:'🔔', text:'🔔 BEEP BEEP!', reqLvl:3 },
      { id:'boom', name:'💣 Boom Horn', icon:'💣', text:'💣 BOOM BOOM!', reqLvl:5 }
    ],
    emotes: [
      { id:'default', name:'💬 GG Emote', icon:'💬', text:'💬 GOOD GAME!', reqLvl:1 },
      { id:'victory', name:'👑 Royal Champion', icon:'👑', text:'👑 ROYAL VICTORY!', reqLvl:7 }
    ]
  },
  load(){
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if(raw) this.data = Object.assign(this.data, JSON.parse(raw));
    } catch(e){}
  },
  save(){
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    } catch(e){}
  },
  getXpForLevel(lvl){
    return lvl * 800;
  },
  addXp(amount){
    this.data.xp += amount;
    let req = this.getXpForLevel(this.data.level);
    let leveledUp = false;
    let newUnlocks = [];
    while(this.data.xp >= req){
      this.data.xp -= req;
      this.data.level++;
      leveledUp = true;
      const reward = this.LEVEL_REWARDS[this.data.level];
      if(reward){
        newUnlocks.push(reward);
        if(reward.type === 'trail' && !this.data.unlockedTrails.includes(reward.id)) this.data.unlockedTrails.push(reward.id);
        if(reward.type === 'horn' && !this.data.unlockedHorns.includes(reward.id)) this.data.unlockedHorns.push(reward.id);
        if(reward.type === 'emote' && !this.data.unlockedEmotes.includes(reward.id)) this.data.unlockedEmotes.push(reward.id);
      }
      req = this.getXpForLevel(this.data.level);
    }
    this.save();
    return { leveledUp, newLevel: this.data.level, newUnlocks };
  }
};
ProgressionSystem.load();

/* ---------------- SHARED REUSABLE GEOMETRIES, MATERIALS & SCRATCH VECTORS ---------------- */
const SHARED_SPHERE_GEO = new THREE.SphereGeometry(0.15, 6, 6);
const SHARED_SMOKE_GEO = new THREE.SphereGeometry(0.22, 6, 6);
const SHARED_ROCKET_RING_GEO = new THREE.TorusGeometry(0.5, 0.2, 8, 24);
const SHARED_SUPERNOVA_RING_GEO = new THREE.TorusGeometry(1, 0.5, 16, 64);

const SPARK_MAT_BLUE = new THREE.MeshBasicMaterial({color: 0x00e5ff});
const SPARK_MAT_ORANGE = new THREE.MeshBasicMaterial({color: 0xff9100});
const SPARK_MAT_PURPLE = new THREE.MeshBasicMaterial({color: 0xe040fb});
const SMOKE_MAT = new THREE.MeshBasicMaterial({color: 0x777777, transparent: true, opacity: 0.6});
const ROCKET_RING_MAT = new THREE.MeshBasicMaterial({color: 0xffeb3b, transparent: true, opacity: 0.9});
const SUPERNOVA_RING_MAT = new THREE.MeshBasicMaterial({color: 0xff4081, transparent: true, opacity: 0.95});

const EXPL_MAT_DEFAULT = new THREE.MeshBasicMaterial({color: 0xffaa00});
const EXPL_MAT_YELLOW = new THREE.MeshBasicMaterial({color: 0xffeb3b});
const EXPL_MAT_CYAN = new THREE.MeshBasicMaterial({color: 0x00e5ff});
const EXPL_MAT_PINK = new THREE.MeshBasicMaterial({color: 0xff4081});
const EXPL_MAT_GREEN = new THREE.MeshBasicMaterial({color: 0x00e676});

const ORIGIN_VEC = new THREE.Vector3(0,0,0);
const VEC_SCRATCH_1 = new THREE.Vector3();
const VEC_SCRATCH_2 = new THREE.Vector3();
const VEC_SCRATCH_3 = new THREE.Vector3();
const VEC_SCRATCH_4 = new THREE.Vector3();
const VEC_SCRATCH_5 = new THREE.Vector3();

/* ---------------- BACKGROUND CLOUDS & MOUNTAINS ---------------- */
const clouds = [];
function createCloud(x, y, z, scale){
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.9, flatShading:true});
  const parts = [
    {r:5, x:0, y:0, z:0}, {r:4, x:4, y:1, z:1}, {r:4.2, x:-4, y:0.8, z:-1},
    {r:3.2, x:2, y:3, z:0}, {r:3.5, x:-2.5, y:2.5, z:0.8}
  ];
  parts.forEach(p => {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(p.r, 1), mat);
    m.position.set(p.x, p.y, p.z);
    group.add(m);
  });
  group.position.set(x, y, z);
  group.scale.set(scale, scale, scale);
  scene.add(group);
  clouds.push({mesh:group, speed: 1.0 + Math.random()*1.2});
}
for(let i=0; i<24; i++){
  const ang = Math.random()*Math.PI*2;
  const r = 200 + Math.random()*200;
  createCloud(Math.cos(ang)*r, 45 + Math.random()*45, Math.sin(ang)*r, 1.8 + Math.random()*2.2);
}

// Mountain Ring
{
  const mountainGeo = new THREE.ConeGeometry(35, 65, 7);
  const mountainMat = new THREE.MeshStandardMaterial({color:0x3b82f6, roughness:0.9, flatShading:true});
  const snowMat = new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.8, flatShading:true});

  for(let i=0; i<20; i++){
    const ang = (i/20)*Math.PI*2;
    const r = 320 + Math.random()*40;
    const m = new THREE.Mesh(mountainGeo, mountainMat);
    m.position.set(Math.cos(ang)*r, 22, Math.sin(ang)*r);
    m.rotation.y = Math.random()*Math.PI;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(14, 24, 7), snowMat);
    cap.position.y = 21;
    m.add(cap);
    scene.add(m);
  }
}

// Ocean Body
{
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshStandardMaterial({color:0x0088ff, roughness:0.2, metalness:0.1})
  );
  ocean.rotation.x = -Math.PI/2;
  ocean.position.y = -30;
  scene.add(ocean);
}

/* ---------------- ARENA PLATFORM ---------------- */
const PLATFORM_R = 95;
let stormR = 85;
const STORM_START = 85, STORM_END = 14;
const ROUND_TIME = 180;
let roundElapsed = 0;

function createSmashKartsFloorTexture(){
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
  const ctx = cv.getContext('2d');
  
  const tileSize = 64;
  for(let x=0; x<1024; x+=tileSize){
    for(let y=0; y<1024; y+=tileSize){
      const isEven = ((x/tileSize) + (y/tileSize)) % 2 === 0;
      ctx.fillStyle = isEven ? '#0077ff' : '#0033cc';
      ctx.fillRect(x, y, tileSize, tileSize);
      
      ctx.lineWidth = 3;
      ctx.strokeStyle = isEven ? '#00d4ff' : '#001a99';
      ctx.strokeRect(x+2, y+2, tileSize-4, tileSize-4);

      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x+tileSize/2-4, y+tileSize/2-4, 8, 8);
    }
  }

  // Target Crosshair / Center Sector Grid
  ctx.strokeStyle = '#ffea00';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(512, 512, 120, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 234, 0, 0.4)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(512, 512, 280, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  for(let i=0; i<1024; i+=32){
    ctx.fillRect(i, 500, 16, 16);
    ctx.fillRect(i+16, 516, 16, 16);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  return tex;
}

function createHazardRimTexture(){
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffcc00'; ctx.fillRect(0,0,512,64);
  ctx.fillStyle = '#111111';
  for(let i=-64; i<512; i+=32){
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i+16, 0); ctx.lineTo(i+48, 64); ctx.lineTo(i+32, 64);
    ctx.fill();
  }
  ctx.fillStyle = '#ff1744'; ctx.fillRect(0,0,512,8); ctx.fillRect(0,56,512,8);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(32, 1);
  return tex;
}

const mainPlatform = new THREE.Mesh(
  new THREE.CylinderGeometry(PLATFORM_R, PLATFORM_R, 4, 96),
  new THREE.MeshStandardMaterial({map:createSmashKartsFloorTexture(), roughness:0.4, metalness:0.1})
);
mainPlatform.position.y = -2;
mainPlatform.receiveShadow = true;
scene.add(mainPlatform);

const rim = new THREE.Mesh(
  new THREE.TorusGeometry(PLATFORM_R, 0.8, 16, 120),
  new THREE.MeshStandardMaterial({map:createHazardRimTexture(), roughness:0.5})
);
rim.rotation.x = Math.PI/2; rim.position.y = 0.05;
scene.add(rim);

/* ---------------- 3D PHYSICAL SLOPED RAMPS ---------------- */
const ramps = [];

function createRamp(x, z, yaw, width=12, length=16, maxHeight=3.8){
  const group = new THREE.Group();
  
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(length, 0);
  shape.lineTo(length, maxHeight);
  shape.closePath();

  const extrudeSettings = { depth: width, bevelEnabled: false };
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.translate(0, 0, -width/2);

  const mat = new THREE.MeshStandardMaterial({color:0xff9100, roughness:0.3});
  const rampMesh = new THREE.Mesh(geo, mat);
  rampMesh.castShadow = true; rampMesh.receiveShadow = true;
  group.add(rampMesh);

  const slopeLen = Math.hypot(length, maxHeight);
  const stripGeo = new THREE.PlaneGeometry(slopeLen, width - 0.5);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ff9100'; ctx.fillRect(0,0,256,128);
  ctx.fillStyle = '#ffeb3b';
  for(let bx=20; bx<240; bx+=50){
    ctx.beginPath();
    ctx.moveTo(bx, 64); ctx.lineTo(bx+35, 110); ctx.lineTo(bx+35, 90);
    ctx.lineTo(bx+16, 64); ctx.lineTo(bx+35, 38); ctx.lineTo(bx+35, 18);
    ctx.fill();
  }
  const stripTex = new THREE.CanvasTexture(cv);
  const stripMat = new THREE.MeshBasicMaterial({map:stripTex, side:THREE.DoubleSide});
  const stripMesh = new THREE.Mesh(stripGeo, stripMat);
  
  const slopeAngle = Math.atan2(maxHeight, length);
  stripMesh.rotation.z = slopeAngle;
  stripMesh.position.set(length/2, maxHeight/2 + 0.05, 0);
  group.add(stripMesh);

  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  scene.add(group);

  ramps.push({
    mesh: group,
    pos: new THREE.Vector3(x, 0, z),
    yaw, width, length, maxHeight
  });
}

createRamp(-40, 0, 0, 12, 16, 3.8);
createRamp(40, 0, Math.PI, 12, 16, 3.8);
createRamp(0, -40, Math.PI/2, 12, 16, 3.8);
createRamp(0, 40, -Math.PI/2, 12, 16, 3.8);

/* SPEED BOOST PADS */
const boostPads = [];
const boostTextures = [];
function createBoostPad(x, z, yaw){
  const group = new THREE.Group();
  const padGeo = new THREE.PlaneGeometry(6, 9);
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 192;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ff9100'; ctx.fillRect(0,0,128,192);
  ctx.fillStyle = '#ffeb3b';
  for(let y=30; y<180; y+=50){
    ctx.beginPath();
    ctx.moveTo(64, y); ctx.lineTo(110, y+40); ctx.lineTo(90, y+40);
    ctx.lineTo(64, y+18); ctx.lineTo(38, y+40); ctx.lineTo(18, y+40);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapT = THREE.RepeatWrapping;
  boostTextures.push(tex);
  const padMat = new THREE.MeshBasicMaterial({map:tex, side:THREE.DoubleSide});
  const padMesh = new THREE.Mesh(padGeo, padMat);
  padMesh.rotation.x = -Math.PI/2;
  group.add(padMesh);
  group.position.set(x, 0.08, z);
  group.rotation.y = yaw;
  scene.add(group);
  
  const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  boostPads.push({pos: new THREE.Vector3(x,0,z), dir});
}

createBoostPad(-25, 25, Math.PI/4); createBoostPad(25, -25, -Math.PI*3/4);
createBoostPad(-25, -25, -Math.PI/4); createBoostPad(25, 25, Math.PI*3/4);
createBoostPad(0, -60, Math.PI/2); createBoostPad(0, 60, -Math.PI/2);
createBoostPad(-60, 0, 0); createBoostPad(60, 0, Math.PI);

/* OBSTACLES */
const obstacles = [];
function createCrate(x, z){
  const geo = new THREE.BoxGeometry(2.6, 2.6, 2.6);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#d7ccc8'; ctx.fillRect(0,0,128,128);
  ctx.fillStyle = '#8d6e63'; ctx.fillRect(6,6,116,116);
  ctx.lineWidth = 10; ctx.strokeStyle = '#5d4037';
  ctx.strokeRect(5,5,118,118);
  ctx.beginPath(); ctx.moveTo(5,5); ctx.lineTo(123,123); ctx.stroke();
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.MeshStandardMaterial({map:tex, roughness:0.7});
  const crate = new THREE.Mesh(geo, mat);
  crate.position.set(x, 1.3, z);
  crate.rotation.y = Math.random()*Math.PI;
  crate.castShadow = true; crate.receiveShadow = true;
  scene.add(crate);
  obstacles.push({mesh:crate, pos: new THREE.Vector3(x,1.3,z), r: 1.8});
}

function createTireStack(x, z){
  const group = new THREE.Group();
  const tireGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.7, 16);
  const colors = [0x212121, 0xd50000, 0xffd600, 0x212121];
  for(let i=0; i<3; i++){
    const mat = new THREE.MeshStandardMaterial({color:colors[i%colors.length], roughness:0.8});
    const t = new THREE.Mesh(tireGeo, mat);
    t.position.y = 0.35 + i*0.65;
    t.castShadow = true;
    group.add(t);
  }
  group.position.set(x, 0, z);
  scene.add(group);
  obstacles.push({mesh:group, pos: new THREE.Vector3(x, 1.0, z), r: 1.6});
}

for(let i=0; i<16; i++){
  const ang = (i/16)*Math.PI*2;
  const r = 45 + Math.random()*25;
  if(i%2===0) createCrate(Math.cos(ang)*r, Math.sin(ang)*r);
  else createTireStack(Math.cos(ang)*r, Math.sin(ang)*r);
}

// Storm Ring & Wall
const stormRing = new THREE.Mesh(
  new THREE.TorusGeometry(stormR, 0.6, 12, 100),
  new THREE.MeshBasicMaterial({color:0xff1744, transparent:true, opacity:0.95})
);
stormRing.rotation.x = Math.PI/2; stormRing.position.y = 0.25;
scene.add(stormRing);

const stormWall = new THREE.Mesh(
  new THREE.CylinderGeometry(stormR, stormR, 14, 64, 1, true),
  new THREE.MeshBasicMaterial({color:0xff0044, transparent:true, opacity:0.18, side:THREE.DoubleSide})
);
stormWall.position.y = 6.8;
scene.add(stormWall);

/* ---------------- WEAPON DEFINITIONS ---------------- */
const WEAPONS = {
  pea:   {name:'PEA BLASTER', color:0xffffff, dmg:8,  speed:52, cooldown:.22, ammo:Infinity, splash:0, knock:3.5, size:.25},
  rocket:{name:'ROCKET',      color:0xffeb3b, dmg:35, speed:38, cooldown:.65, ammo:4,        splash:7.2, knock:16, size:.50},
  triple:{name:'TRIPLE SHOT', color:0x00e5ff, dmg:10, speed:46, cooldown:.26, ammo:12,        splash:0, knock:5.5, size:.28},
  mine:  {name:'MINE',        color:0xff2a5f, dmg:40, speed:0,  cooldown:.6,  ammo:3,          splash:6.2, knock:18, size:.58},
};
const PICKUP_TYPES = ['rocket','triple','shield','nitro','mine'];
const PICKUP_COLORS = {rocket:0xffeb3b, triple:0x00e5ff, shield:0xe040fb, nitro:0x00e676, mine:0xff2a5f};

/* ---------------- KART CLASSES & ABILITIES DEFINITIONS ---------------- */
const KART_CLASSES = {
  tank: {
    key: 'tank', name: 'TANK', icon: '🦏', color: 0xff3d00, colorHex: '#ff3d00',
    maxHp: 125, accelMult: 1.0, topSpeedMult: 1.0, knockMult: 2.0, knockRecv: 0.5, dmgRecv: 1.0,
    abilityName: 'Massive Knockback', desc: '+100% Attack Knockback, 50% Reduced Impulse Taken, +25 HP Max Health.'
  },
  flash: {
    key: 'flash', name: 'FLASH', icon: '⚡', color: 0xffea00, colorHex: '#ffea00',
    maxHp: 100, accelMult: 1.8, topSpeedMult: 1.3, knockMult: 1.0, knockRecv: 1.0, dmgRecv: 1.0,
    abilityName: 'Extreme Acceleration', desc: '1.8x Acceleration Rate, +30% Top Speed, Rapid Momentum Gain.'
  },
  guardian: {
    key: 'guardian', name: 'GUARDIAN', icon: '🛡️', color: 0x00e5ff, colorHex: '#00e5ff',
    maxHp: 100, accelMult: 1.0, topSpeedMult: 1.0, knockMult: 1.0, knockRecv: 1.0, dmgRecv: 0.75,
    abilityName: 'Aegis Shield', desc: 'Starts shielded & recharges 3s Invulnerability Barrier every 12s. Takes -25% Dmg.'
  },
  magnet: {
    key: 'magnet', name: 'MAGNET', icon: '🧲', color: 0xe040fb, colorHex: '#e040fb',
    maxHp: 100, accelMult: 1.05, topSpeedMult: 1.05, knockMult: 1.0, knockRecv: 1.0, dmgRecv: 1.0,
    abilityName: 'Item Vacuum', desc: 'Passively pulls nearby item crates within 25m directly to the kart.'
  },
  bomber: {
    key: 'bomber', name: 'BOMBER', icon: '💣', color: 0xff1744, colorHex: '#ff1744',
    maxHp: 100, accelMult: 1.0, topSpeedMult: 1.0, knockMult: 1.0, knockRecv: 1.0, dmgRecv: 1.0,
    abilityName: 'Mine Master', desc: '+50% Explosive Splash Radius & auto-drops explosive mines on Jump / Nitro.'
  },
  ghost: {
    key: 'ghost', name: 'GHOST', icon: '👻', color: 0x00e676, colorHex: '#00e676',
    maxHp: 100, accelMult: 1.1, topSpeedMult: 1.1, knockMult: 1.0, knockRecv: 1.0, dmgRecv: 1.0, isGhost: true,
    abilityName: 'Phase Shift', desc: 'Phases directly through karts & immune to storm damage for 3s upon entry.'
  }
};
let selectedKartClass = 'tank';

/* ---------------- CENTRAL CHARACTER REGISTRY (PHASE 6.3) ---------------- */
const CharacterRegistry = {
  characters: [
    {
      id: 'racer',
      name: 'BLAZE VANCE',
      shortDescription: 'Fast, confident street racer who dominates straightaways with sharp instinct and pure speed.',
      style: 'STREET RACER',
      rarity: 'RARE',
      accent: '#00f3ff',
      reqLvl: 1,
      portrait: '🏎️',
      modelPath: 'assets/characters/racer/model.gltf',
      preferredKartClass: 'SPEEDSTER',
      emotes: ['👋 WAVE', '🔥 NITRO TAUNT', '🏆 CHEER'],
      headColor: 0x00f3ff,
      bodyColor: 0x112233
    },
    {
      id: 'tank',
      name: 'TITAN KRUSH',
      shortDescription: 'Armored heavy competitor built to withstand massive knockback and smash through obstacle lines.',
      style: 'HEAVY SMASHER',
      rarity: 'COMMON',
      accent: '#ff6a00',
      reqLvl: 1,
      portrait: '🦏',
      modelPath: 'assets/characters/tank/model.gltf',
      preferredKartClass: 'TANK',
      emotes: ['💪 FLEX', '🛡️ SHIELD UP', '💥 ROAR'],
      headColor: 0xff6a00,
      bodyColor: 0x221100
    },
    {
      id: 'tech',
      name: 'CYBER NOVA',
      shortDescription: 'Futuristic hacker and engineer who manipulates energy shields and magnetic propulsion fields.',
      style: 'CYBERNETIC ENGINEER',
      rarity: 'EPIC',
      accent: '#a100ff',
      reqLvl: 3,
      portrait: '🤖',
      modelPath: 'assets/characters/tech/model.gltf',
      preferredKartClass: 'HOVER',
      emotes: ['⚡ OVERCHARGE', '📡 SCAN', '👾 GLITCH'],
      headColor: 0xa100ff,
      bodyColor: 0x1a0033
    },
    {
      id: 'wildcard',
      name: 'JESTER JACK',
      shortDescription: 'Chaotic and unpredictable arcade brawler with wild tricks and sudden explosive maneuvers.',
      style: 'CHAOTIC TRICKSTER',
      rarity: 'RARE',
      accent: '#ffe600',
      reqLvl: 2,
      portrait: '🃏',
      modelPath: 'assets/characters/wildcard/model.gltf',
      preferredKartClass: 'ROCKET',
      emotes: ['🤡 LAUGH', '🃏 SPIN', '💥 BOMB SHAKE'],
      headColor: 0xffe600,
      bodyColor: 0x333300
    },
    {
      id: 'ghost',
      name: 'PHANTOM SHADE',
      shortDescription: 'Mysterious neon racer who drifts seamlessly like a shadow across the momentum arena.',
      style: 'NEON PHANTOM',
      rarity: 'LEGENDARY',
      accent: '#00ff66',
      reqLvl: 5,
      portrait: '👻',
      modelPath: 'assets/characters/ghost/model.gltf',
      preferredKartClass: 'SPEEDSTER',
      emotes: ['✨ VANISH', '👁️ GLOW', '💀 SHADOW FADE'],
      headColor: 0x00ff66,
      bodyColor: 0x002211
    },
    {
      id: 'bomber',
      name: 'BOOMER BAXTER',
      shortDescription: 'Explosive demolition specialist who loves mines, splash rockets, and heavy pyrotechnics.',
      style: 'DEMOLITION EXPERT',
      rarity: 'COMMON',
      accent: '#ff0055',
      reqLvl: 1,
      portrait: '💣',
      modelPath: 'assets/characters/bomber/model.gltf',
      preferredKartClass: 'TANK',
      emotes: ['💣 FUSE', '🔥 BLAST', '😎 DUST OFF'],
      headColor: 0xff0055,
      bodyColor: 0x330011
    },
    {
      id: 'guardian',
      name: 'AEGIS PRIME',
      shortDescription: 'Noble defensive protector wielding heavy forcefields and disciplined arena tactics.',
      style: 'ARENA GUARDIAN',
      rarity: 'RARE',
      accent: '#00e5ff',
      reqLvl: 4,
      portrait: '🛡️',
      modelPath: 'assets/characters/guardian/model.gltf',
      preferredKartClass: 'BALANCE',
      emotes: ['🛡️ SALUTE', '⚡ GUARD', '👑 COMMAND'],
      headColor: 0x00e5ff,
      bodyColor: 0x001122
    },
    {
      id: 'rookie',
      name: 'PIXEL PETE',
      shortDescription: 'Young, energetic arcade rookie eager to prove himself in the 6-player multiplayer arena.',
      style: 'ARCADE ROOKIE',
      rarity: 'COMMON',
      accent: '#ffe600',
      reqLvl: 1,
      portrait: '🎮',
      modelPath: 'assets/characters/rookie/model.gltf',
      preferredKartClass: 'BALANCE',
      emotes: ['🎮 BUTTON MASH', '👍 THUMBS UP', '🚀 HIGH FIVE'],
      headColor: 0xffcc00,
      bodyColor: 0x222211
    }
  ],

  getCharacter(id) {
    return this.characters.find(c => c.id === id) || this.characters[0];
  },

  getSelectedCharacterId() {
    return localStorage.getItem('kb_selected_character') || 'racer';
  },

  setSelectedCharacterId(id) {
    if (this.getCharacter(id)) {
      localStorage.setItem('kb_selected_character', id);
    }
  }
};

/* ---------------- 3D CHARACTER MODEL FACTORY (PHASE 6.4) ---------------- */
const CharacterModelFactory = {
  createAvatar(characterId, opts = {}) {
    const char = (typeof CharacterRegistry !== 'undefined' && CharacterRegistry.getCharacter) ? CharacterRegistry.getCharacter(characterId) : null;
    const group = new THREE.Group();
    group.name = `char_avatar_${characterId}`;

    const headColor = char ? char.headColor : 0x00f3ff;
    const bodyColor = char ? char.bodyColor : 0x112233;
    const accentHex = char ? char.accent : '#00f3ff';
    const accentColor = new THREE.Color(accentHex);

    const torsoMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.3, metalness: 0.4 });

    let torsoGeo;
    if (characterId === 'tank' || characterId === 'bomber') {
      torsoGeo = new THREE.BoxGeometry(0.65, 0.55, 0.48);
    } else {
      torsoGeo = new THREE.CylinderGeometry(0.28, 0.22, 0.52, 12);
    }
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 0.26;
    torso.castShadow = true;
    group.add(torso);

    const pauldronMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.2, metalness: 0.6 });

    if (characterId === 'tank' || characterId === 'guardian') {
      const leftP = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.28), pauldronMat);
      leftP.position.set(-0.4, 0.42, 0);
      const rightP = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.28), pauldronMat);
      rightP.position.set(0.4, 0.42, 0);
      group.add(leftP); group.add(rightP);
    }

    const headMat = new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.2, metalness: 0.5 });

    let headGeo;
    if (characterId === 'rookie') {
      headGeo = new THREE.SphereGeometry(0.32, 16, 16);
    } else if (characterId === 'tank') {
      headGeo = new THREE.BoxGeometry(0.48, 0.46, 0.48);
    } else {
      headGeo = new THREE.SphereGeometry(0.26, 16, 16);
    }
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.68;
    head.castShadow = true;
    group.add(head);

    const visorMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.8
    });

    let visorGeo;
    if (characterId === 'racer' || characterId === 'ghost') {
      visorGeo = new THREE.BoxGeometry(0.36, 0.09, 0.14);
    } else if (characterId === 'tech') {
      visorGeo = new THREE.BoxGeometry(0.4, 0.16, 0.16);
    } else {
      visorGeo = new THREE.SphereGeometry(0.18, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    }
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.70, 0.17);
    visor.rotation.x = 0.2;
    group.add(visor);

    if (characterId === 'guardian') {
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.32), pauldronMat);
      crest.position.set(0, 0.92, -0.05);
      group.add(crest);
    } else if (characterId === 'tech') {
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28), pauldronMat);
      antenna.position.set(0.2, 0.90, 0);
      group.add(antenna);
    } else if (characterId === 'wildcard') {
      const peak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 4), pauldronMat);
      peak.position.set(0, 0.94, -0.08);
      peak.rotation.z = -0.3;
      group.add(peak);
    } else if (characterId === 'bomber') {
      const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 8), pauldronMat);
      fuse.position.set(0, 0.88, -0.14);
      group.add(fuse);
    }

    if (opts.scale) group.scale.setScalar(opts.scale);
    return group;
  }
};

/* ---------------- KART FACTORY ---------------- */
function makeKartMesh(colorHex, isGhost=false, characterId='racer'){
  const g = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color:colorHex, roughness:0.2, metalness:0.3,
    transparent: isGhost, opacity: isGhost ? 0.6 : 1.0
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.7), bodyMat);
  body.position.y = 0.55; body.castShadow = !isGhost; body.receiveShadow = true;
  g.add(body);

  const cabMat = new THREE.MeshStandardMaterial({
    color:0x212121, roughness:0.1,
    transparent: isGhost, opacity: isGhost ? 0.6 : 1.0
  });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 1.2), cabMat);
  cab.position.set(0, 1.0, -0.1); cab.castShadow = !isGhost;
  g.add(cab);

  // Seat 3D Character Avatar inside Driver Cockpit
  const driverAvatar = CharacterModelFactory.createAvatar(characterId, { scale: 0.95 });
  driverAvatar.position.set(0, 0.75, -0.1);
  g.add(driverAvatar);

  const cannon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 1.2, 12),
    new THREE.MeshStandardMaterial({color:0x37474f, metalness:0.9, roughness:0.2, transparent:isGhost, opacity:isGhost?0.6:1.0})
  );
  cannon.rotation.x = Math.PI/2; cannon.position.set(0, 0.68, 1.6);
  g.add(cannon);

  const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.4, 18);
  const wheelMat = new THREE.MeshStandardMaterial({color:0x111115, roughness:0.9, transparent:isGhost, opacity:isGhost?0.6:1.0});
  const hubMat = new THREE.MeshStandardMaterial({color:0xffffff, transparent:isGhost, opacity:isGhost?0.6:1.0});
  const wPos = [[-0.9,0.48,1.0],[0.9,0.48,1.0],[-0.9,0.48,-1.0],[0.9,0.48,-1.0]];

  wPos.forEach(p=>{
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI/2; w.position.set(p[0],p[1],p[2]); w.castShadow = !isGhost;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.42,12), hubMat);
    hub.rotation.z = Math.PI/2; hub.position.set(p[0],p[1],p[2]);
    g.add(w); g.add(hub);
  });

  return g;
}

function makeShieldMesh(){
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(1.85, 20, 16),
    new THREE.MeshBasicMaterial({color:0xe040fb, transparent:true, opacity:0.4, wireframe:true})
  );
  m.visible = false;
  return m;
}

function makeAuraMesh(){
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 16, 16),
    new THREE.MeshBasicMaterial({color:0x00e5ff, transparent:true, opacity:0.25, wireframe:true})
  );
  m.visible = false;
  return m;
}

/* ---------------- KART CLASS ---------------- */
class Kart {
  constructor(name, classKey, isPlayer, spawn){
    this.name = name;
    this.classKey = classKey || 'tank';
    this.classData = KART_CLASSES[this.classKey] || KART_CLASSES.tank;
    this.color = this.classData.color;
    this.isPlayer = isPlayer;
    this.isGhost = !!this.classData.isGhost;

    this.mesh = makeKartMesh(this.color, this.isGhost);
    this.shield = makeShieldMesh();
    this.aura = makeAuraMesh();
    this.mesh.add(this.shield);
    this.mesh.add(this.aura);
    scene.add(this.mesh);

    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.yaw = Math.random()*Math.PI*2;
    this.speed = 0;
    this.maxHp = this.classData.maxHp;
    this.hp = this.maxHp;
    this.alive = true;
    this.weapon = 'pea';
    this.ammo = Infinity;
    this.storedPowerup = null;
    this.personality = 'brawler';
    this.cooldownT = 0;
    this.shieldT = (this.classKey === 'guardian') ? 3.0 : 0;
    this.nitroT = 0;
    this.kills = 0;
    this.deaths = 0;
    this.respawnT = 0;
    this.falling = false;
    this.fallVel = 0;
    this.damageDealt = 0;
    this.boostCount = 0;

    // Class specific ability timers
    this.guardianTimer = 12.0;
    this.bomberMineCooldown = 0;
    this.ghostStormImmunity = 0;
    this.slowTimer = 0;

    // Drifting & Mini-Turbo States
    this.isDrifting = false;
    this.driftDir = 0;
    this.driftTime = 0;
    this.driftStage = 0;

    // Momentum & Super Attack States
    this.momentum = 0;
    this.superReady = false;

    // Smooth Physics & Jump States
    this.knockVel = new THREE.Vector3(0,0,0);
    this.jumpVel = 0;
    this.inAir = false;

    // AI Target & Navigation
    this.target = null;
    this.targetTimer = 0;
    this.aiWander = new THREE.Vector3();
    this.aiWanderT = 0;
    
    this.updateMeshTransform();
  }

  triggerHorn(){
    if(!this.alive) return;
    const hornId = ProgressionSystem.data.selectedHorn || 'default';
    const item = ProgressionSystem.COSMETICS.horns.find(h => h.id === hornId) || ProgressionSystem.COSMETICS.horns[0];
    flashCenterMsg(item.text);
  }

  triggerEmote(){
    if(!this.alive) return;
    const emoteId = ProgressionSystem.data.selectedEmote || 'default';
    const item = ProgressionSystem.COSMETICS.emotes.find(e => e.id === emoteId) || ProgressionSystem.COSMETICS.emotes[0];
    flashCenterMsg(item.text);
  }

  hasPowerup(){
    return this.storedPowerup !== null || (this.weapon !== 'pea' && this.ammo > 0) || this.shieldT > 0 || this.nitroT > 0;
  }

  usePowerup(){
    if(!this.storedPowerup || !this.alive) return;
    const type = this.storedPowerup;
    this.storedPowerup = null;
    if(type === 'shield'){
      this.shieldT = 5;
      triggerShieldEMP(this);
    } else if(type === 'nitro'){
      this.nitroT = 5;
      if(this.isPlayer) Haptics.vibrateNitro();
    } else {
      this.weapon = type;
      this.ammo = WEAPONS[type].ammo;
    }
    if(this.isPlayer) flashCenterMsg(type==='shield'?'🛡️ SHIELD ACTIVATED':type==='nitro'?'🔥 NITRO BOOST':WEAPONS[type].name+' EQUIPPED');
  }

  updateMeshTransform(){
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);

    // Smooth knockback body pitch & roll tilt decay
    const knockMag = this.knockVel ? Math.hypot(this.knockVel.x, this.knockVel.z) : 0;
    const pitchTilt = (this.speed / 45) * 0.08 + (knockMag > 0.5 ? Math.sin(performance.now() * 0.02) * Math.min(0.35, knockMag * 0.025) : 0);
    const rollTilt = (this.isDrifting ? this.driftDir * 0.18 : 0) + (knockMag > 0.5 ? Math.cos(performance.now() * 0.02) * Math.min(0.35, knockMag * 0.025) : 0);

    this.mesh.rotation.x = pitchTilt;
    this.mesh.rotation.y = this.yaw;
    this.mesh.rotation.z = rollTilt;
  }

  updateAbilities(dt){
    if(!this.alive) return;

    // 1. Guardian periodic shield recharge
    if(this.classKey === 'guardian'){
      this.guardianTimer -= dt;
      if(this.guardianTimer <= 0){
        this.guardianTimer = 12.0;
        this.shieldT = 3.0;
        triggerShieldEMP(this);
        if(this.isPlayer) flashCenterMsg('🛡️ AEGIS SHIELD RECHARGED!');
      }
    }

    // 2. Magnet item vacuum
    if(this.classKey === 'magnet'){
      pickups.forEach(p => {
        if(p.active && !this.hasPowerup()){
          const dist = this.pos.distanceTo(p.mesh.position);
          if(dist < 25.0 && dist > 1.2){
            const pullDir = new THREE.Vector3().subVectors(this.pos, p.mesh.position).normalize();
            p.mesh.position.addScaledVector(pullDir, 18.0 * dt);
            p.pos.copy(p.mesh.position);
          }
        }
      });
    }

    // 3. Bomber mine drop cooldown
    if(this.classKey === 'bomber' && this.bomberMineCooldown > 0){
      this.bomberMineCooldown -= dt;
    }

    // 4. Ghost storm immunity timer
    if(this.classKey === 'ghost' && this.ghostStormImmunity > 0){
      this.ghostStormImmunity -= dt;
    }
  }

  respawn(){
    const safePos = getSafeSpawnPosition(this);
    this.pos.copy(safePos);
    this.yaw = Math.random()*Math.PI*2;
    this.speed = 0; this.hp = this.maxHp; this.alive = true; this.falling = false; this.fallVel = 0;
    this.weapon = 'pea'; this.ammo = Infinity;
    this.shieldT = (this.classKey === 'guardian') ? 3.0 : 0;
    this.nitroT = 0;
    this.momentum = 0; this.superReady = false;
    this.knockVel.set(0,0,0); this.jumpVel = 0; this.inAir = false;
    this.target = null; this.targetTimer = 0;
    this.guardianTimer = 12.0; this.bomberMineCooldown = 0; this.ghostStormImmunity = 0; this.slowTimer = 0;
    this.isDrifting = false; this.driftDir = 0; this.driftTime = 0; this.driftStage = 0;
    this.mesh.visible = true;
    this.updateMeshTransform();

    if(this.isPlayer){
      if(this.classKey !== selectedKartClass){
        scene.remove(this.mesh);
        this.classKey = selectedKartClass;
        this.classData = KART_CLASSES[selectedKartClass] || KART_CLASSES.tank;
        this.color = this.classData.color;
        this.isGhost = !!this.classData.isGhost;
        this.mesh = makeKartMesh(this.color, this.isGhost);
        this.shield = makeShieldMesh();
        this.aura = makeAuraMesh();
        this.mesh.add(this.shield);
        this.mesh.add(this.aura);
        scene.add(this.mesh);
        this.maxHp = this.classData.maxHp;
        this.hp = this.maxHp;

        const badge = document.getElementById('kartClassBadge');
        if(badge){
          badge.innerHTML = `${this.classData.icon} ${this.classData.name}: ${this.classData.abilityName}`;
        }
        flashCenterMsg(`RESPAWNED AS ${this.classData.icon} ${this.classData.name}!`);
      }
      document.getElementById('deathScreen').style.display = 'none';
    }
  }

  die(killerName){
    this.alive = false; this.deaths++;
    this.mesh.visible = false;
    this.respawnT = 3;
    spawnExplosion(this.pos.clone().add(new THREE.Vector3(0,0.6,0)), this.color);
    pushKillFeed(`${killerName} eliminated ${this.classData.icon} ${this.name}`);

    if(this.isPlayer){
      showDeathScoreboard(killerName);
    }
  }

  takeDamage(dmg, knockDir, knockMag, killerName){
    if(!this.alive || this.shieldT > 0) return;

    // Guardian -25% damage taken
    if(this.classKey === 'guardian'){
      dmg *= 0.75;
    }

    // Ghost storm immunity
    if(killerName === 'The Storm' && this.classKey === 'ghost' && this.ghostStormImmunity > 0){
      return;
    }

    // Tank takes 50% reduced knockback
    if(this.classKey === 'tank' && knockMag > 0){
      knockMag *= 0.5;
    }

    this.hp -= dmg;
    if(killerName && killerName !== this.name){
      const attacker = karts.find(k => k.name === killerName);
      if(attacker) attacker.damageDealt += dmg;
    }

    if(knockDir && knockMag > 0){
      this.knockVel.addScaledVector(knockDir, knockMag * 0.7);
    }

    if(!this.isPlayer && killerName && killerName !== this.name){
      const attacker = karts.find(k => k.name === killerName);
      if(attacker && attacker.alive && Math.random() < 0.75){
        this.target = attacker;
        this.targetTimer = 4 + Math.random()*3;
      }
    }

    if(this.hp <= 0){
      this.hp = 0;
      if(killerName && killerName !== this.name){
        const k = karts.find(k => k.name === killerName);
        if(k) k.kills++;
      }
      this.die(killerName || 'The Storm');
    }
  }

  unleashSuperNova(){
    if(this.momentum < 100 || !this.alive) return;
    this.momentum = 0;
    this.superReady = false;
    this.shieldT = 2.0;

    spawnSuperNovaBlast(this.pos.clone(), this);
    if(this.isPlayer) flashCenterMsg('💥 SHORT-RANGE SUPER NOVA! (-50 HP)');
    else pushKillFeed(`${this.classData.icon} ${this.name} unleashed SUPER NOVA!`);
  }
}

/* ---------------- SMART MULTI-CANDIDATE SAFE RESPAWN SYSTEM ---------------- */
function getSafeSpawnPosition(kart){
  let bestCandidate = new THREE.Vector3(0, 0, 0);
  let highestScore = -Infinity;

  const maxSpawnR = Math.min(stormR * 0.75, PLATFORM_R * 0.75);

  for(let i = 0; i < 10; i++){
    const ang = Math.random() * Math.PI * 2;
    const r = (0.15 + Math.random() * 0.85) * maxSpawnR;
    const cand = new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r);

    let score = 100.0;

    // 1. Enemy Proximity Penalty
    karts.forEach(other => {
      if(!other.alive || other === kart) return;
      const d = cand.distanceTo(other.pos);
      if(d < 22){
        score -= (22 - d) * 4.5;
      }
    });

    // 2. Mine Proximity Penalty
    mines.forEach(m => {
      const d = cand.distanceTo(m.pos);
      if(d < 16){
        score -= (16 - d) * 5.5;
      }
    });

    // 3. Incoming Projectile Proximity Penalty
    projectiles.forEach(p => {
      const d = cand.distanceTo(p.pos);
      if(d < 18){
        score -= (18 - d) * 3.5;
      }
    });

    // 4. Storm Edge Distance Penalty
    const distFromCenter = Math.hypot(cand.x, cand.z);
    const marginToStorm = stormR - distFromCenter;
    if(marginToStorm < 12){
      score -= (12 - marginToStorm) * 5.0;
    }

    // 5. Obstacle Overlap Penalty
    obstacles.forEach(ob => {
      if(cand.distanceTo(ob.pos) < ob.r + 2.2){
        score -= 60.0;
      }
    });

    if(score > highestScore){
      highestScore = score;
      bestCandidate.copy(cand);
    }
  }

  return bestCandidate;
}

/* ---------------- SCREEN SHAKE SYSTEM (DISABLED PER USER REQUEST) ---------------- */
function addScreenShake(amount){
  // Screen shake disabled for smooth gameplay
}

/* ---------------- DRIFT SPARK PARTICLES ---------------- */
function spawnDriftSparks(kartPos, yaw, colorHex){
  let mat = SPARK_MAT_BLUE;
  if(colorHex === 0xff9100) mat = SPARK_MAT_ORANGE;
  else if(colorHex === 0xe040fb) mat = SPARK_MAT_PURPLE;

  VEC_SCRATCH_1.set(Math.sin(yaw), 0, Math.cos(yaw));
  VEC_SCRATCH_2.set(Math.cos(yaw), 0, -Math.sin(yaw));

  // Left tire spark
  VEC_SCRATCH_3.copy(kartPos).addScaledVector(VEC_SCRATCH_1, -1.2).addScaledVector(VEC_SCRATCH_2, 0.7);
  VEC_SCRATCH_3.y += 0.3;
  const mL = new THREE.Mesh(SHARED_SPHERE_GEO, mat);
  mL.position.copy(VEC_SCRATCH_3);
  scene.add(mL);
  particles.push({mesh:mL, vel:new THREE.Vector3((Math.random()-0.5)*4, Math.random()*5+2, (Math.random()-0.5)*4), life:0, maxLife:0.2});

  // Right tire spark
  VEC_SCRATCH_4.copy(kartPos).addScaledVector(VEC_SCRATCH_1, -1.2).addScaledVector(VEC_SCRATCH_2, -0.7);
  VEC_SCRATCH_4.y += 0.3;
  const mR = new THREE.Mesh(SHARED_SPHERE_GEO, mat);
  mR.position.copy(VEC_SCRATCH_4);
  scene.add(mR);
  particles.push({mesh:mR, vel:new THREE.Vector3((Math.random()-0.5)*4, Math.random()*5+2, (Math.random()-0.5)*4), life:0, maxLife:0.2});
}

/* ---------------- SHIELD DEFENSIVE COUNTERPLAY (EMP SHOCKWAVE) ---------------- */
function triggerShieldEMP(kart){
  spawnSuperNovaBlast(kart.pos.clone(), kart);
  karts.forEach(other => {
    if(other === kart || !other.alive) return;
    const d = kart.pos.distanceTo(other.pos);
    if(d < 6.5){
      VEC_SCRATCH_1.subVectors(other.pos, kart.pos).setY(0).normalize();
      other.knockVel.addScaledVector(VEC_SCRATCH_1, 24);
    }
  });
  if(kart.isPlayer) flashCenterMsg('🛡️ SHIELD EMP SHOCKWAVE!');
}

/* ---------------- SHORT-RANGE SUPER NOVA SHOCKWAVE BLAST EFFECT ---------------- */
const superNovas = [];
function spawnSuperNovaBlast(centerPos, ownerKart){
  const ringMesh = new THREE.Mesh(SHARED_SUPERNOVA_RING_GEO, new THREE.MeshBasicMaterial({color: 0xff4081, transparent: true, opacity: 0.95}));
  ringMesh.rotation.x = Math.PI/2;
  ringMesh.position.copy(centerPos).setY(0.5);
  scene.add(ringMesh);

  spawnExplosion(centerPos, 0xff4081);
  VEC_SCRATCH_1.copy(centerPos).add(new THREE.Vector3(1,0,1));
  spawnExplosion(VEC_SCRATCH_1, 0xffeb3b);

  // SHORT RANGE SUPER NOVA (maxRadius = 8.0m, 50 HP / Half Health Damage!)
  superNovas.push({
    mesh: ringMesh, pos: centerPos, owner: ownerKart.name, ownerKart: ownerKart,
    radius: 1, maxRadius: 8.0, speed: 28, life: 0, maxLife: 0.45,
    hitKarts: new Set()
  });
}

function updateSuperNovas(dt){
  for(let i=superNovas.length-1; i>=0; i--){
    const sn = superNovas[i];
    sn.life += dt;
    sn.radius += sn.speed * dt;
    sn.mesh.scale.setScalar(sn.radius);
    sn.mesh.material.opacity = 0.95 * (1 - sn.life/sn.maxLife);

    // Short-Range Collision Check (within 8.0m radius of activator)
    karts.forEach(k => {
      if(!k.alive || k.name === sn.owner) return;
      const d = k.pos.distanceTo(sn.pos);
      if(d <= 8.0 && !sn.hitKarts.has(k.name)){
        sn.hitKarts.add(k.name);
        const knockDir = new THREE.Vector3().subVectors(k.pos, sn.pos).setY(0).normalize();
        let knockMag = 32;
        if(sn.ownerKart && sn.ownerKart.classKey === 'tank') knockMag *= 2.0;
        k.takeDamage(50, knockDir, knockMag, sn.owner);
      }
    });

    if(sn.life >= sn.maxLife){
      scene.remove(sn.mesh);
      superNovas.splice(i, 1);
    }
  }
}

/* ---------------- DYNAMIC 30-SECOND ARENA EVENTS SYSTEM ---------------- */
let eventTimer = 30.0;
let currentEvent = null;
let currentEventT = 0;
let overchargeActive = false;

const ARENA_EVENTS = [
  { id:'tornado', name:'🌪️ TORNADO VORTEX', desc:'A wild Tornado moves across the arena flinging karts into the air!' },
  { id:'meteor', name:'☄️ METEOR SHOWER', desc:'Fiery meteors rain down across impact target zones!' },
  { id:'arenashift', name:'🚧 ARENA SHIFT', desc:'Dynamic jump ramps elevate for high-flying stunt jumps!' },
  { id:'overcharge', name:'⚡ OVERCHARGE', desc:'Boost pads supercharged! 2.5x Hyper Speed & Instant Momentum!' },
  { id:'goldenrush', name:'💰 GOLDEN RUSH', desc:'10 Rare Golden Powerup Crates rain down across the safe zone!' }
];

function showEventBanner(text, duration=5.0){
  const banner = document.getElementById('eventBanner');
  if(!banner) return;
  banner.textContent = text;
  banner.style.display = 'block';
  setTimeout(() => { if(banner) banner.style.display = 'none'; }, duration * 1000);
}

// 1. Tornado Funnel
let tornadoGroup = null;
let tornadoPos = new THREE.Vector3();
let tornadoVel = new THREE.Vector3();

function createTornadoMesh(){
  const g = new THREE.Group();
  for(let i=0; i<6; i++){
    const r = 1.2 + i*1.4;
    const geo = new THREE.CylinderGeometry(r, r*0.6, 2.2, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({color:0xffeb3b, transparent:true, opacity:0.45, side:THREE.DoubleSide, wireframe:true});
    const m = new THREE.Mesh(geo, mat);
    m.position.y = i * 2.2;
    g.add(m);
  }
  g.visible = false;
  scene.add(g);
  return g;
}

// 2. Meteor Shower Targets & Meteors
const meteorTargets = [];
const activeMeteors = [];

function startTornadoEvent(){
  if(!tornadoGroup) tornadoGroup = createTornadoMesh();
  const side = Math.random() < 0.5 ? -1 : 1;
  tornadoPos.set(side * 60, 0, (Math.random()-0.5)*60);
  tornadoVel.set(-side * 9.0, 0, (Math.random()-0.5)*5);
  tornadoGroup.position.copy(tornadoPos);
  tornadoGroup.visible = true;
}

function startMeteorShowerEvent(){
  for(let i=0; i<6; i++){
    const ang = Math.random()*Math.PI*2;
    const r = Math.random()*Math.min(stormR*0.7, PLATFORM_R*0.7);
    const targetPos = new THREE.Vector3(Math.cos(ang)*r, 0.1, Math.sin(ang)*r);
    
    const targetMesh = new THREE.Mesh(SHARED_ROCKET_RING_GEO, new THREE.MeshBasicMaterial({color:0xff1744, transparent:true, opacity:0.85}));
    targetMesh.rotation.x = Math.PI/2;
    targetMesh.position.copy(targetPos);
    scene.add(targetMesh);

    meteorTargets.push({mesh: targetMesh, pos: targetPos, timer: 2.5});
  }
}

function startArenaShiftEvent(){
  ramps.forEach(rmp => {
    rmp.mesh.scale.set(1, 2.2, 1);
  });
}

function startOverchargeEvent(){
  overchargeActive = true;
}

function startGoldenRushEvent(){
  for(let i=0; i<10; i++){
    spawnPickup();
  }
}

function triggerRandomArenaEvent(){
  const ev = ARENA_EVENTS[Math.floor(Math.random() * ARENA_EVENTS.length)];
  currentEvent = ev.id;
  currentEventT = 15.0;
  showEventBanner(`⚡ EVENT: ${ev.name}!`, 5.0);
  flashCenterMsg(`${ev.name}: ${ev.desc}`);

  if(ev.id === 'tornado') startTornadoEvent();
  else if(ev.id === 'meteor') startMeteorShowerEvent();
  else if(ev.id === 'arenashift') startArenaShiftEvent();
  else if(ev.id === 'overcharge') startOverchargeEvent();
  else if(ev.id === 'goldenrush') startGoldenRushEvent();
}

function updateArenaEvents(dt){
  eventTimer -= dt;
  if(eventTimer <= 0){
    eventTimer = 30.0;
    triggerRandomArenaEvent();
  }

  if(currentEventT > 0){
    currentEventT -= dt;
    if(currentEvent === 'tornado' && tornadoGroup && tornadoGroup.visible){
      tornadoGroup.rotation.y += 8.0 * dt;
      tornadoPos.addScaledVector(tornadoVel, dt);
      tornadoGroup.position.copy(tornadoPos);

      karts.forEach(k => {
        if(!k.alive) return;
        const d = k.pos.distanceTo(tornadoPos);
        if(d < 13.0){
          k.jumpVel = 18;
          k.inAir = true;
          VEC_SCRATCH_1.subVectors(k.pos, tornadoPos).setY(0).normalize();
          k.knockVel.addScaledVector(VEC_SCRATCH_1, 26);
          if(k.isPlayer) flashCenterMsg('🌪️ CAUGHT IN TORNADO VORTEX!');
        }
      });
    }

    if(currentEventT <= 0){
      if(tornadoGroup) tornadoGroup.visible = false;
      if(overchargeActive) overchargeActive = false;
      ramps.forEach(rmp => rmp.mesh.scale.set(1, 1, 1));
      currentEvent = null;
    }
  }

  for(let i=meteorTargets.length-1; i>=0; i--){
    const mt = meteorTargets[i];
    mt.timer -= dt;
    mt.mesh.rotation.z += dt*4;
    mt.mesh.scale.setScalar(1 + Math.sin(performance.now()*0.01)*0.2);
    if(mt.timer <= 0){
      scene.remove(mt.mesh);
      meteorTargets.splice(i, 1);

      const meteorMesh = new THREE.Mesh(SHARED_SPHERE_GEO, EXPL_MAT_DEFAULT);
      meteorMesh.scale.setScalar(5.0);
      meteorMesh.position.copy(mt.pos).setY(55);
      scene.add(meteorMesh);
      activeMeteors.push({mesh: meteorMesh, targetPos: mt.pos, speed: 65});
    }
  }

  for(let i=activeMeteors.length-1; i>=0; i--){
    const am = activeMeteors[i];
    am.mesh.position.y -= am.speed * dt;
    if(am.mesh.position.y <= 0.5){
      spawnExplosion(am.targetPos, 0xff3d00);
      karts.forEach(k => {
        if(!k.alive) return;
        const d = k.pos.distanceTo(am.targetPos);
        if(d < 9.0){
          VEC_SCRATCH_1.subVectors(k.pos, am.targetPos).setY(0).normalize();
          k.takeDamage(45, VEC_SCRATCH_1, 30, 'Meteor Shower');
        }
      });
      scene.remove(am.mesh);
      activeMeteors.splice(i, 1);
    }
  }
}

/* ---------------- DEATH SCOREBOARD & MID-GAME KART SELECTION ---------------- */
function renderDeathKartSelectionGrid(){
  const container = document.getElementById('deathKartGrid');
  if(!container) return;
  container.innerHTML = Object.values(KART_CLASSES).map(c => `
    <div class="kart-card ${c.key === selectedKartClass ? 'selected' : ''}" data-key="${c.key}">
      <div class="kart-head"><span class="kart-icon">${c.icon}</span> <span>${c.name}</span></div>
      <div class="kart-ability">${c.abilityName}</div>
    </div>
  `).join('');

  container.querySelectorAll('.kart-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.kart-card').forEach(el => el.classList.remove('selected'));
      card.classList.add('selected');
      selectedKartClass = card.getAttribute('data-key');
    });
  });
}

function showDeathScoreboard(killerName){
  const deathScreen = document.getElementById('deathScreen');
  document.getElementById('killerNameText').textContent = killerName || 'The Storm';
  deathScreen.style.display = 'flex';

  const pickerNote = document.getElementById('deathClassPickerNote');
  const deathGrid = document.getElementById('deathKartGrid');

  // Allow kart re-selection every 3 deaths (3, 6, 9...)
  if(player.deaths > 0 && player.deaths % 3 === 0){
    if(pickerNote) pickerNote.style.display = 'block';
    if(deathGrid){
      deathGrid.style.display = 'grid';
      renderDeathKartSelectionGrid();
    }
  } else {
    if(pickerNote) pickerNote.style.display = 'none';
    if(deathGrid) deathGrid.style.display = 'none';
  }

  const sorted = karts.slice().sort((a,b) => b.kills - a.kills);
  const el = document.getElementById('deathScoreboard');
  el.innerHTML = sorted.map((k,i) => `<div><span style="color:#${k.color.toString(16).padStart(6,'0')}">${i===0 ? '🏆 ' : ''}${k.classData.icon} ${k.name}</span><span>${k.kills} K / ${k.deaths} D</span></div>`).join('');
}

/* ---------------- WORLD & KARTS SETUP ---------------- */
const karts = [];
const BOT_PROFILES = [
  { name: 'BRAWLER-MAX', classKey: 'tank', personality: 'brawler' },
  { name: 'VIXEN-FOX', classKey: 'flash', personality: 'vixen' },
  { name: 'TURBO-9', classKey: 'guardian', personality: 'turbo' },
  { name: 'PHANTOM-X', classKey: 'ghost', personality: 'phantom' },
  { name: 'BOOMER-BRAWL', classKey: 'bomber', personality: 'brawler' },
  { name: 'SNEAKY-VIX', classKey: 'magnet', personality: 'vixen' },
  { name: 'TURBO-SPEED', classKey: 'flash', personality: 'turbo' }
];

let player = new Kart('YOU', selectedKartClass, true, {x:0, z:28});
karts.push(player);

for(let i=0; i<7; i++){
  const ang = (i/7)*Math.PI*2 + Math.PI/4;
  const prof = BOT_PROFILES[i];
  const bot = new Kart(prof.name, prof.classKey, false, {x:Math.cos(ang)*45, z:Math.sin(ang)*45});
  bot.personality = prof.personality;
  karts.push(bot);
}

const projectiles = [];
const mines = [];
const pickups = [];
const particles = [];

let cachedPickupTex = null;
function getPickupDecalTexture(){
  if(!cachedPickupTex){
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffab00'; ctx.fillRect(0,0,128,128);
    ctx.fillStyle = '#ffffff'; ctx.font = '900 90px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', 64, 64);
    cachedPickupTex = new THREE.CanvasTexture(cv);
  }
  return cachedPickupTex;
}

function makePickupMesh(type){
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffeb3b, emissive: 0xffa000, emissiveIntensity: 0.5, roughness: 0.3
  });
  const m = new THREE.Mesh(geo, mat); m.castShadow = true;
  g.add(m);

  const decMat = new THREE.MeshBasicMaterial({map:getPickupDecalTexture(), transparent:true});
  const decMesh = new THREE.Mesh(new THREE.BoxGeometry(1.42, 1.42, 1.42), decMat);
  g.add(decMesh);

  // Powerup Spawn Platform Ring
  const baseRingGeo = new THREE.RingGeometry(0.8, 1.4, 16);
  const baseRingMat = new THREE.MeshBasicMaterial({color: 0xffab00, side: THREE.DoubleSide, transparent: true, opacity: 0.7});
  const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
  baseRing.rotation.x = Math.PI/2;
  baseRing.position.y = -0.9;
  g.add(baseRing);

  // Vertical Light Beacon Column
  const beaconGeo = new THREE.CylinderGeometry(0.08, 0.08, 12, 8);
  const beaconMat = new THREE.MeshBasicMaterial({color: 0xffeb3b, transparent: true, opacity: 0.25});
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.y = 5.0;
  g.add(beacon);

  return g;
}

function spawnPickup(){
  const type = PICKUP_TYPES[Math.floor(Math.random()*PICKUP_TYPES.length)];
  const ang = Math.random()*Math.PI*2;
  const r = Math.random()*Math.min(stormR*0.8, PLATFORM_R*0.8);
  const pos = new THREE.Vector3(Math.cos(ang)*r, 1.0, Math.sin(ang)*r);
  const mesh = makePickupMesh(type);
  mesh.position.copy(pos);
  scene.add(mesh);
  pickups.push({mesh, type, pos, active:true});
}
for(let i=0; i<18; i++) spawnPickup();

/* ---------------- HAPTIC FEEDBACK SYSTEM (STEP 3.5) ---------------- */
const Haptics = {
  isEnabled() {
    const toggleHaptics = document.getElementById('toggleHaptics');
    if (toggleHaptics && toggleHaptics.textContent === 'DISABLED') return false;
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  },

  vibrate(pattern) {
    if (!this.isEnabled()) return;
    try {
      navigator.vibrate(pattern);
    } catch(e) {}
  },

  vibrateFire() { this.vibrate(15); },
  vibrateDamage() { this.vibrate([40, 30, 60]); },
  vibrateExplosion() { this.vibrate([30, 20, 50]); },
  vibratePowerup() { this.vibrate(25); },
  vibrateNitro() { this.vibrate([15, 10, 15]); },
  vibrateElimination() { this.vibrate([50, 40, 80]); },
  vibrateMatchStart() { this.vibrate([30, 20, 30, 20, 60]); }
};

/* ---------------- PROCEDURAL WEB AUDIO SYNTHESIZER (STEP 3.5) ---------------- */
const SoundFX = {
  ctx: null,
  masterGain: null,
  sfxGain: null,
  musicGain: null,
  engineOsc: null,
  engineGainNode: null,
  musicInterval: null,
  lastFireT: 0,
  lastStormWarnT: 0,

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();

      this.masterGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);

      this.updateVolumes();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  },

  updateVolumes() {
    if (!this.ctx) return;
    const toggleAudio = document.getElementById('toggleAudio');
    const toggleSfx = document.getElementById('toggleSfx');
    const toggleMusic = document.getElementById('toggleMusic');

    const masterOn = (!toggleAudio || toggleAudio.textContent !== 'DISABLED');
    const sfxOn = (!toggleSfx || toggleSfx.textContent !== 'DISABLED');
    const musicOn = (!toggleMusic || toggleMusic.textContent !== 'DISABLED');

    this.masterGain.gain.setValueAtTime(masterOn ? 0.8 : 0.0, this.ctx.currentTime);
    this.sfxGain.gain.setValueAtTime(sfxOn ? 1.0 : 0.0, this.ctx.currentTime);
    this.musicGain.gain.setValueAtTime(musicOn ? 0.35 : 0.0, this.ctx.currentTime);
  },

  isEnabled() {
    this.init();
    const toggleAudio = document.getElementById('toggleAudio');
    const toggleSfx = document.getElementById('toggleSfx');
    if (toggleAudio && toggleAudio.textContent === 'DISABLED') return false;
    if (toggleSfx && toggleSfx.textContent === 'DISABLED') return false;
    return !!this.ctx;
  },

  updateEngine(speed, isNitro) {
    if (!this.isEnabled()) {
      this.stopEngine();
      return;
    }
    const now = this.ctx.currentTime;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGainNode = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(60, now);
      this.engineGainNode.gain.setValueAtTime(0.01, now);
      this.engineOsc.connect(this.engineGainNode);
      this.engineGainNode.connect(this.sfxGain);
      this.engineOsc.start(now);
    }
    const baseFreq = 50 + Math.min(speed * 2.8, 140) + (isNitro ? 45 : 0);
    const targetGain = Math.min(0.04 + speed * 0.002, 0.12);
    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.08);
    this.engineGainNode.gain.setTargetAtTime(targetGain, now, 0.08);
  },

  stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch(e) {}
      this.engineOsc = null;
      this.engineGainNode = null;
    }
  },

  playPeaFire() {
    if (!this.isEnabled()) return;
    const now = this.ctx.currentTime;
    if (now - this.lastFireT < 0.07) return;
    this.lastFireT = now;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.08);
    Haptics.vibrateFire();
  },

  playRocketFire() {
    if (!this.isEnabled()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.3);
    Haptics.vibrateFire();
  },

  playTripleFire() {
    if (!this.isEnabled()) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(750 + i * 120, now + i * 0.04);
      osc.frequency.exponentialRampToValueAtTime(250, now + i * 0.04 + 0.07);
      gain.gain.setValueAtTime(0.15, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.04 + 0.07);
      osc.connect(gain); gain.connect(this.sfxGain);
      osc.start(now + i * 0.04); osc.stop(now + i * 0.04 + 0.07);
    }
    Haptics.vibrateFire();
  },

  playMineDeploy() {
    if (!this.isEnabled()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.12);
    Haptics.vibrateFire();
  },

  playExplosion() {
    if (!this.isEnabled()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.45);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.45);
    Haptics.vibrateExplosion();
  },

  playHitPing() {
    if (!this.isEnabled()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(2000, now + 0.06);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.06);
  },

  playDamageHurt() {
    if (!this.isEnabled()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.15);
    Haptics.vibrateDamage();
  },

  playShieldBlock() {
    if (!this.isEnabled()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.15);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.15);
  },

  playEliminationChime() {
    if (!this.isEnabled()) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.2, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.06 + 0.12);
      osc.connect(gain); gain.connect(this.sfxGain);
      osc.start(now + idx * 0.06); osc.stop(now + idx * 0.06 + 0.12);
    });
    Haptics.vibrateElimination();
  },

  playPowerupPickup() {
    if (!this.isEnabled()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.12);
    Haptics.vibratePowerup();
  },

  playStormWarning() {
    if (!this.isEnabled()) return;
    const now = this.ctx.currentTime;
    if (now - this.lastStormWarnT < 1.5) return;
    this.lastStormWarnT = now;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.25);
  },

  playCountdownBeep(num) {
    if (!this.isEnabled()) return;
    const now = this.ctx.currentTime;
    const freqs = {3: 440, 2: 554.37, 1: 659.25};
    const freq = freqs[num] || 440;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.18);
    Haptics.vibrate(20);
  },

  playCountdownGo() {
    if (!this.isEnabled()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.35);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.35);
    Haptics.vibrateMatchStart();
  },

  playUIClick() {
    if (!this.isEnabled()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.03);
    Haptics.vibrate(10);
  },

  startMusic() {
    if (this.musicInterval) return;
    this.init();
    const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
    let noteIdx = 0;
    this.musicInterval = setInterval(() => {
      const toggleMusic = document.getElementById('toggleMusic');
      if (toggleMusic && toggleMusic.textContent === 'DISABLED') return;
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(notes[noteIdx % notes.length], now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain); gain.connect(this.musicGain);
      osc.start(now); osc.stop(now + 0.2);
      noteIdx++;
    }, 400);
  },

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
};

/* ---------------- UNIFIED OBJECT-POOLED EFFECT SYSTEM (STEP 3.3) ---------------- */
const MAX_PARTICLES = 150;
const particlePool = [];
const activeParticles = [];

function initEffectSystem() {
  if (particlePool.length > 0 || typeof scene === 'undefined' || !scene) return;
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const mesh = new THREE.Mesh(SHARED_SPHERE_GEO, new THREE.MeshBasicMaterial({color: 0xffaa00}));
    mesh.visible = false;
    scene.add(mesh);
    particlePool.push({
      mesh,
      vel: new THREE.Vector3(),
      life: 0,
      maxLife: 0.4,
      isRing: false,
      isLight: false,
      active: false
    });
  }
}

function spawnParticleFromPool(pos, vel, colorHex, maxLife = 0.4, scaleMultiplier = 1.0) {
  initEffectSystem();
  let node = particlePool.find(p => !p.active);
  if (!node) {
    if (activeParticles.length > 0) {
      node = activeParticles.shift();
    } else {
      return null;
    }
  }

  node.active = true;
  node.mesh.visible = true;
  node.mesh.position.copy(pos);
  node.vel.copy(vel);
  node.life = 0;
  node.maxLife = maxLife;
  node.isRing = false;
  node.isLight = false;
  node.mesh.scale.setScalar(scaleMultiplier);

  if (colorHex !== undefined) {
    node.mesh.material.color.setHex(colorHex);
  }

  if (!activeParticles.includes(node)) {
    activeParticles.push(node);
  }
  return node;
}

function spawnMuzzleFlash(spawnPos, colorHex = 0xffeb3b) {
  for (let i = 0; i < 4; i++) {
    const vel = new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4 + 1, (Math.random() - 0.5) * 6);
    spawnParticleFromPool(spawnPos, vel, colorHex, 0.12, 0.6);
  }
}

function spawnExplosion(pos, colorHex = 0xffeb3b, isDirectHit = false) {
  SoundFX.playExplosion();

  const particleCount = isDirectHit ? 16 : 10;
  const speedMult = isDirectHit ? 16 : 10;

  for (let i = 0; i < particleCount; i++) {
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * speedMult,
      Math.random() * speedMult * 0.7 + 2,
      (Math.random() - 0.5) * speedMult
    );
    spawnParticleFromPool(pos, vel, colorHex, 0.35 + Math.random() * 0.2, isDirectHit ? 1.4 : 1.0);
  }

  // Shockwave Ring
  if (typeof SHARED_ROCKET_RING_GEO !== 'undefined') {
    const ringMat = new THREE.MeshBasicMaterial({color: colorHex || 0xffeb3b, transparent: true, opacity: 0.85});
    const ring = new THREE.Mesh(SHARED_ROCKET_RING_GEO, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(pos);
    scene.add(ring);

    particles.push({
      mesh: ring,
      vel: new THREE.Vector3(),
      life: 0,
      maxLife: isDirectHit ? 0.45 : 0.3,
      isRing: true
    });
  }
}

function updateParticlesPooled(dt) {
  const camPos = (typeof camera !== 'undefined' && camera) ? camera.position : ORIGIN_VEC;

  for (let i = activeParticles.length - 1; i >= 0; i--) {
    const pt = activeParticles[i];
    pt.life += dt;

    pt.vel.y -= 18 * dt;
    pt.mesh.position.addScaledVector(pt.vel, dt);

    const distToCam = pt.mesh.position.distanceTo(camPos);
    const distScale = Math.min(1.5, Math.max(0.6, 1.0 + (distToCam - 20) * 0.015));
    const lifeRatio = Math.max(0, 1 - pt.life / pt.maxLife);
    pt.mesh.scale.setScalar(lifeRatio * distScale);

    if (pt.life >= pt.maxLife) {
      pt.active = false;
      pt.mesh.visible = false;
      activeParticles.splice(i, 1);
    }
  }

  // Update legacy/ring/smoke particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.life += dt;
    if (pt.isRing) {
      const s = 1 + (pt.life / pt.maxLife) * (pt.maxLife > 0.4 ? 12 : 8);
      pt.mesh.scale.setScalar(s);
      pt.mesh.material.opacity = 0.9 * (1 - pt.life / pt.maxLife);
    } else {
      pt.vel.y -= 18 * dt;
      pt.mesh.position.addScaledVector(pt.vel, dt);
      pt.mesh.scale.setScalar(Math.max(0, 1 - pt.life / pt.maxLife));
    }
    if (pt.life >= pt.maxLife) {
      scene.remove(pt.mesh);
      particles.splice(i, 1);
    }
  }

  if (typeof clouds !== 'undefined' && Array.isArray(clouds)) {
    clouds.forEach(c => {
      c.mesh.position.x += c.speed * dt;
      if (c.mesh.position.x > 350) c.mesh.position.x = -350;
    });
  }
}

/* ---------------- HIT & DAMAGE CONFIRMATION HELPERS ---------------- */
let hitMarkerTimer = 0;
function triggerHitConfirmation(dmg, isDirectHit = false) {
  SoundFX.playHitPing();
  const el = document.getElementById('hitMarker');
  if (el) {
    el.style.opacity = '1';
    el.style.transform = `translate(-50%, -50%) scale(${isDirectHit ? 1.3 : 1.0})`;
    hitMarkerTimer = 0.18;
  }
  if (typeof triggerCamShake === 'function') {
    triggerCamShake(isDirectHit ? 0.4 : 0.25, 0.15);
  }
}

let damageVignetteTimer = 0;
function triggerDamageTaken(attackerPos, dmg) {
  SoundFX.playDamageHurt();
  const el = document.getElementById('damageVignette');
  if (el) {
    el.style.opacity = '0.85';
    damageVignetteTimer = 0.35;
  }
  if (typeof triggerCamShake === 'function') {
    triggerCamShake(0.6, 0.25);
  }

  const ind = document.getElementById('damageIndicator');
  if (ind && typeof player !== 'undefined' && player && attackerPos) {
    const relX = attackerPos.x - player.pos.x;
    const relZ = attackerPos.z - player.pos.z;
    const angleToAttacker = Math.atan2(relX, relZ);
    const relYaw = angleToAttacker - player.yaw;
    const deg = (relYaw * 180 / Math.PI) + 180;
    ind.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
    ind.style.opacity = '1';
    setTimeout(() => { if (ind) ind.style.opacity = '0'; }, 500);
  }
}

function updateCombatOverlays(dt) {
  if (hitMarkerTimer > 0) {
    hitMarkerTimer -= dt;
    if (hitMarkerTimer <= 0) {
      const el = document.getElementById('hitMarker');
      if (el) el.style.opacity = '0';
    }
  }
  if (damageVignetteTimer > 0) {
    damageVignetteTimer -= dt;
    if (damageVignetteTimer <= 0) {
      const el = document.getElementById('damageVignette');
      if (el) el.style.opacity = '0';
    }
  }
}

function pushKillFeed(text){
  const el = document.getElementById('killfeed');
  const line = document.createElement('div');
  line.className = 'kfline'; line.textContent = text;
  el.appendChild(line);
  while(el.children.length > 4) el.removeChild(el.firstChild);
  setTimeout(()=>{
    line.style.transition = 'opacity .5s'; line.style.opacity = '0';
    setTimeout(()=>line.remove(), 500);
  }, 3500);
}

/* ---------------- INPUT HANDLING ---------------- */
const keys = {};
let spacePressed = false;

function dropBomberMine(kart){
  if(!kart || kart.classKey !== 'bomber' || kart.bomberMineCooldown > 0 || !kart.alive) return;
  kart.bomberMineCooldown = 3.5;
  const fwd = new THREE.Vector3(Math.sin(kart.yaw), 0, Math.cos(kart.yaw));
  const mpos = kart.pos.clone().sub(fwd.clone().multiplyScalar(2.0)).add(new THREE.Vector3(0, 0.35, 0));
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.3, 16),
    new THREE.MeshStandardMaterial({color:0xff2a5f, emissive:0xaa0022, emissiveIntensity:0.6})
  );
  mesh.position.copy(mpos);
  scene.add(mesh);
  mines.push({mesh, pos:mpos, owner:kart.name, ownerKart:kart, dmg:40, splash:9.0, knock:18, armT:0.6, life:22});
  if(kart.isPlayer) flashCenterMsg('💣 MINE DROPPED!');
}

function performAction(k){
  if(!k || !k.alive || currentUIState !== UIState.GAME) return;
  if(k.storedPowerup !== null){
    k.usePowerup();
  } else {
    fireWeapon(k);
    if(k.isPlayer && socket && socket.connected){
      socket.emit('fireWeapon', { weapon: k.weapon });
    }
  }
}

window.addEventListener('keydown', e => { 
  if (e.code === 'Escape') {
    if (currentUIState === UIState.MULTIPLAYER_LOBBY || currentUIState === UIState.COUNTDOWN) {
      // Do not leave room on Escape key in lobby; user must use Leave Room button
      return;
    }
    if (currentUIState !== UIState.MAIN_MENU && currentUIState !== UIState.GAME) {
      setUIState(UIState.MAIN_MENU);
    }
  }
  if (currentUIState !== UIState.GAME) return;

  if(e.code === 'Space' && !spacePressed){
    spacePressed = true;
    if(player && player.alive && !player.inAir){
      player.jumpVel = 14;
      player.inAir = true;
      if(player.classKey === 'bomber') dropBomberMine(player);
    }
  }
  if((e.code === 'KeyQ' || e.code === 'KeyR') && player && player.alive){
    player.unleashSuperNova();
  }
  if((e.code === 'KeyF' || e.code === 'KeyE') && player && player.alive){
    performAction(player);
  }
  if(e.code === 'KeyH' && player && player.alive){
    player.triggerHorn();
  }
  if(e.code === 'KeyG' && player && player.alive){
    player.triggerEmote();
  }
  keys[e.code] = true; 
});

window.addEventListener('keyup', e => { 
  if(e.code === 'Space') spacePressed = false;
  keys[e.code] = false; 
});

window.addEventListener('mousedown', e => {
  if (currentUIState !== UIState.GAME) return;
  if(player && player.alive){
    if(e.button === 0) performAction(player);
    else if(e.button === 2) player.unleashSuperNova();
  }
});
window.addEventListener('contextmenu', e => e.preventDefault());

const powerupSlotEl = document.getElementById('powerupSlot');
if(powerupSlotEl){
  powerupSlotEl.addEventListener('click', () => {
    if(player && player.alive) performAction(player);
  });
}

const touch = {fwd:false, back:false, left:false, right:false, fire:false, boost:false, super:false};
function bindTouch(id, key){
  const el = document.getElementById(id);
  const set = v => e => { e.preventDefault(); touch[key] = v; };
  el.addEventListener('touchstart', set(true), {passive:false});
  el.addEventListener('touchend', set(false), {passive:false});
  el.addEventListener('touchcancel', set(false), {passive:false});
  el.addEventListener('mousedown', set(true));
  window.addEventListener('mouseup', set(false));
}
bindTouch('btnFwd','fwd'); bindTouch('btnBack','back');
bindTouch('btnLeft','left'); bindTouch('btnRight','right');
bindTouch('btnFire','fire'); bindTouch('btnBoost','boost');
bindTouch('btnSuper','super');
if('ontouchstart' in window){ document.getElementById('touchControls').style.display = 'block'; }

/* ---------------- WEAPON FIRE LOGIC ---------------- */
function fireWeapon(k){
  const def = WEAPONS[k.weapon];
  if(k.cooldownT > 0) return;
  if(k.weapon !== 'pea' && k.ammo <= 0){ k.weapon = 'pea'; k.ammo = Infinity; }
  
  const momTier = k.momentum >= 67 ? 2 : k.momentum >= 34 ? 1 : 0;
  const cdMult = momTier === 2 ? 0.7 : momTier === 1 ? 0.85 : 1.0;
  k.cooldownT = def.cooldown * cdMult;

  const fwd = new THREE.Vector3(Math.sin(k.yaw), 0, Math.cos(k.yaw));
  const spawnPos = k.pos.clone().addScaledVector(fwd, 1.6).add(new THREE.Vector3(0, 0.6, 0));

  // Visual Muzzle Flash
  spawnMuzzleFlash(spawnPos, WEAPONS[k.weapon] ? WEAPONS[k.weapon].color : 0xffeb3b);

  if(k.weapon === 'mine'){
    SoundFX.playMineDeploy();
    k.ammo--;
    const back = fwd.clone().multiplyScalar(-1.6);
    const mpos = k.pos.clone().add(back).add(new THREE.Vector3(0, 0.35, 0));
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.3, 16),
      new THREE.MeshStandardMaterial({color:0xff2a5f, emissive:0xaa0022, emissiveIntensity:0.6})
    );
    mesh.position.copy(mpos);
    scene.add(mesh);
    
    let splashRad = def.splash;
    if(k.classKey === 'bomber') splashRad *= 1.5;

    mines.push({mesh, pos:mpos, owner:k.name, ownerKart:k, dmg:def.dmg, splash:splashRad, knock:def.knock, armT:0.8, life:22});
    if(k.ammo <= 0){ k.weapon = 'pea'; k.ammo = Infinity; }
    return;
  }

  if (k.weapon === 'rocket') {
    SoundFX.playRocketFire();
  } else if (k.weapon === 'triple') {
    SoundFX.playTripleFire();
  } else {
    SoundFX.playPeaFire();
  }

  // Triple Shot: 5-pellet shotgun spread in 30 degree arc!
  const angles = k.weapon === 'triple' ? [-0.3, -0.15, 0, 0.15, 0.3] : [0];
  angles.forEach(off => {
    const dir = fwd.clone().applyAxisAngle(new THREE.Vector3(0,1,0), off);
    const geo = new THREE.SphereGeometry(def.size, 8, 8);
    const mat = new THREE.MeshStandardMaterial({color:def.color, emissive:def.color, emissiveIntensity:0.9});
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(spawnPos);
    scene.add(mesh);

    let splashRad = def.splash;
    if(k.classKey === 'bomber' && splashRad > 0) splashRad *= 1.5;

    projectiles.push({
      mesh, pos:spawnPos.clone(), vel:dir.multiplyScalar(def.speed), owner:k.name, ownerKart:k,
      dmg:def.dmg, splash:splashRad, knock:def.knock, life:2.4, type:k.weapon
    });
  });

  if(k.weapon !== 'pea'){
    k.ammo--;
    if(k.ammo <= 0){ k.weapon = 'pea'; k.ammo = Infinity; }
  }
}

/* ---------------- TACTICAL PERSONALITY-DRIVEN AI SYSTEM ---------------- */
function updateAI(bot, dt){
  if(!bot.alive) return;

  const ptype = bot.personality || 'brawler';

  // 1. Stored Powerup Usage per Personality
  if(bot.storedPowerup){
    if(ptype === 'brawler'){
      const d = bot.target ? bot.pos.distanceTo(bot.target.pos) : 999;
      if(d < 25 || bot.storedPowerup === 'nitro' || bot.storedPowerup === 'shield'){
        bot.usePowerup();
      }
    } else if(ptype === 'vixen'){
      if(bot.hp < bot.maxHp * 0.65 || bot.storedPowerup === 'nitro' || (bot.target && bot.pos.distanceTo(bot.target.pos) < 15)){
        bot.usePowerup();
      }
    } else if(ptype === 'turbo'){
      bot.usePowerup();
    } else if(ptype === 'phantom'){
      if(bot.storedPowerup === 'mine'){
        if(bot.target && bot.pos.distanceTo(bot.target.pos) < 15) bot.usePowerup();
      } else {
        bot.usePowerup();
      }
    }
  }

  // AI Short-Range Super Nova Trigger
  if(bot.momentum >= 100){
    const nearbyOpponent = karts.find(k => k.alive && k !== bot && k.pos.distanceTo(bot.pos) <= 8.5);
    if(nearbyOpponent){
      bot.unleashSuperNova();
    }
  }

  bot.targetTimer -= dt;
  const isTargetInvalid = !bot.target || !bot.target.alive || bot.target === bot;

  if(isTargetInvalid || bot.targetTimer <= 0){
    const candidates = karts.filter(k => k.alive && k !== bot);
    if(candidates.length > 0){
      if(ptype === 'brawler'){
        candidates.sort((a,b) => a.pos.distanceTo(bot.pos) - b.pos.distanceTo(bot.pos));
        bot.target = candidates[0];
      } else if(ptype === 'phantom'){
        const playerCand = candidates.find(c => c.isPlayer);
        bot.target = playerCand || candidates[Math.floor(Math.random() * candidates.length)];
      } else {
        bot.target = candidates[Math.floor(Math.random() * candidates.length)];
      }
      bot.targetTimer = 3.5 + Math.random() * 4.5;
    } else {
      bot.target = null;
    }
  }

  let destination = bot.target ? bot.target.pos.clone() : ORIGIN_VEC.clone();
  const distToTarget = bot.target ? bot.pos.distanceTo(bot.target.pos) : 999;

  // Personality-driven navigation behavior
  if(ptype === 'turbo' && boostPads.length > 0){
    let bestPad = boostPads[0], bestD = bestPad.pos.distanceTo(bot.pos);
    for(let i=1; i<boostPads.length; i++){
      const d = boostPads[i].pos.distanceTo(bot.pos);
      if(d < bestD){ bestD = d; bestPad = boostPads[i]; }
    }
    destination.copy(bestPad.pos);
  } else if(ptype === 'vixen'){
    if(!bot.hasPowerup()){
      let bestPickup = null, bestD = 9999;
      for(let i=0; i<pickups.length; i++){
        if(!pickups[i].active) continue;
        const d = pickups[i].pos.distanceTo(bot.pos);
        if(d < bestD){ bestD = d; bestPickup = pickups[i]; }
      }
      if(bestPickup) destination.copy(bestPickup.pos);
    }
    if(bot.hp < bot.maxHp * 0.60){
      karts.forEach(k => {
        if(k !== bot && k.alive && bot.pos.distanceTo(k.pos) < 18){
          VEC_SCRATCH_1.subVectors(bot.pos, k.pos).normalize().multiplyScalar(12);
          destination.add(VEC_SCRATCH_1);
        }
      });
    }
  } else if(ptype === 'phantom' && bot.target){
    const targetFwd = new THREE.Vector3(Math.sin(bot.target.yaw), 0, Math.cos(bot.target.yaw));
    destination.copy(bot.target.pos).addScaledVector(targetFwd, -8.0);
    if(bot.classKey === 'bomber' && distToTarget < 12 && bot.bomberMineCooldown <= 0){
      dropBomberMine(bot);
    }
  }

  const distFromCenter = Math.hypot(bot.pos.x, bot.pos.z);
  if(distFromCenter > stormR * 0.85){
    destination.copy(ORIGIN_VEC);
  }

  obstacles.forEach(ob => {
    if(bot.pos.distanceTo(ob.pos) < 3.5){
      VEC_SCRATCH_1.subVectors(bot.pos, ob.pos).normalize().multiplyScalar(5);
      destination.add(VEC_SCRATCH_1);
    }
  });

  VEC_SCRATCH_2.subVectors(destination, bot.pos);
  const desiredYaw = Math.atan2(VEC_SCRATCH_2.x, VEC_SCRATCH_2.z);
  let diff = desiredYaw - bot.yaw;
  while(diff > Math.PI) diff -= Math.PI*2;
  while(diff < -Math.PI) diff += Math.PI*2;

  bot.yaw += Math.max(-1.3, Math.min(1.3, diff*3.6)) * dt * 2.2;
  bot.speed += (distToTarget > 6 ? 1 : 0.3) * dt * 18 * bot.classData.accelMult;
  bot.speed = Math.min(bot.speed, (16.5 + (bot.nitroT > 0 ? 9 : 0)) * bot.classData.topSpeedMult);

  if(bot.target && distToTarget < 35 && Math.abs(diff) < 0.55 && bot.cooldownT <= 0){
    if(Math.random() < (ptype === 'brawler' ? 0.90 : 0.70)) fireWeapon(bot);
  }
}

/* ---------------- PHYSICS & GAME STATE ---------------- */
function integrateKart(k, dt, isPlayerControlled){
  if(!k.alive) return;

  if (k.isRemote) {
    if (k.targetPos) {
      k.pos.lerp(k.targetPos, Math.min(1.0, dt * 18.0));
    }
    if (k.targetYaw !== undefined) {
      let diff = k.targetYaw - k.yaw;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      k.yaw += diff * Math.min(1.0, dt * 18.0);
    }
    k.updateMeshTransform();
    return;
  }

  // Process class passive/active abilities
  k.updateAbilities(dt);

  if (isPlayerControlled && k.isPlayer) {
    SoundFX.updateEngine(k.speed, k.nitroT > 0);
    const distFromCenter = Math.hypot(k.pos.x, k.pos.z);
    if (distFromCenter > stormR) {
      SoundFX.playStormWarning();
    }
  }

  const fwdInput = isPlayerControlled ? ((keys['KeyW']||keys['ArrowUp']||touch.fwd) ? 1 : ((keys['KeyS']||keys['ArrowDown']||touch.back) ? -1 : 0)) : 1;
  const turnInput = isPlayerControlled ? ((keys['KeyA']||keys['ArrowLeft']||touch.left) ? 1 : ((keys['KeyD']||keys['ArrowRight']||touch.right) ? -1 : 0)) : 0;
  const boosting = isPlayerControlled ? (keys['ShiftLeft']||keys['ShiftRight']||touch.boost) : false;
  const spaceHeld = isPlayerControlled ? (keys['Space'] || touch.boost) : false;

  if(isPlayerControlled && touch.super) k.unleashSuperNova();

  // --- 3-STAGE DRIFTING & MINI-TURBO MECHANIC ---
  if(spaceHeld && turnInput !== 0 && Math.abs(k.speed) > 4.5 && !k.inAir && !k.falling){
    if(!k.isDrifting){
      k.isDrifting = true;
      k.driftDir = turnInput;
      k.jumpVel = 5.5; // Small initial drift hop!
      k.inAir = true;
      k.driftTime = 0;
      k.driftStage = 0;
    }
  }

  if(k.isDrifting){
    if(!spaceHeld || Math.abs(k.speed) < 2.5 || k.falling){
      // RELEASE DRIFT -> UNLEASH MINI-TURBO!
      if(k.driftStage === 3){
        k.speed += 24 * k.classData.topSpeedMult;
        k.nitroT = 2.5;
        k.momentum = Math.min(100, k.momentum + 40);
        if(k.isPlayer) flashCenterMsg('🔥 ULTRA MINI-TURBO!');
      } else if(k.driftStage === 2){
        k.speed += 17 * k.classData.topSpeedMult;
        k.nitroT = 1.5;
        k.momentum = Math.min(100, k.momentum + 25);
        if(k.isPlayer) flashCenterMsg('🔥 SUPER MINI-TURBO!');
      } else if(k.driftStage === 1){
        k.speed += 11 * k.classData.topSpeedMult;
        k.nitroT = 0.8;
        k.momentum = Math.min(100, k.momentum + 15);
        if(k.isPlayer) flashCenterMsg('🔥 MINI-TURBO!');
      }
      k.isDrifting = false;
      k.driftTime = 0;
      k.driftStage = 0;
      k.driftDir = 0;
    } else {
      // CHARGE DRIFT & EMIT COLORFUL SPARKS
      k.driftTime += dt;
      let sparkColor = 0;
      if(k.driftTime >= 2.4){
        k.driftStage = 3;
        sparkColor = 0xe040fb; // Stage 3 Gold/Purple
      } else if(k.driftTime >= 1.4){
        k.driftStage = 2;
        sparkColor = 0xff9100; // Stage 2 Orange
      } else if(k.driftTime >= 0.6){
        k.driftStage = 1;
        sparkColor = 0x00e5ff; // Stage 1 Blue
      } else {
        k.driftStage = 0;
      }

      if(sparkColor !== 0 && Math.random() < 0.75){
        spawnDriftSparks(k.pos, k.yaw, sparkColor);
      }

      // Sharper power-slide steering during drift
      k.yaw += (turnInput * 1.5 + k.driftDir * 1.3) * dt * 2.2;
    }
  }

  const momTier = k.momentum >= 67 ? 2 : k.momentum >= 34 ? 1 : 0;
  const speedBonus = momTier === 2 ? 6.0 : momTier === 1 ? 3.0 : 0.0;

  let maxSpeed = (17.5 + speedBonus + (k.nitroT > 0 ? 10 : 0) + (boosting ? 4.5 : 0)) * k.classData.topSpeedMult;
  
  // Sticky sludge slowdown from mines
  if(k.slowTimer > 0){
    k.slowTimer -= dt;
    maxSpeed *= 0.4;
  }

  const accel = 26 * k.classData.accelMult;
  if(fwdInput !== 0) k.speed += fwdInput*accel*dt;
  else k.speed *= (1 - Math.min(1, dt*2.5));
  k.speed = Math.max(-9.5 * k.classData.topSpeedMult, Math.min(maxSpeed, k.speed));

  if(Math.abs(k.speed) > 0.2 && !k.isDrifting){
    k.yaw += turnInput * dt * 2.6 * Math.min(1, Math.abs(k.speed)/6+0.3);
  }

  if(Math.abs(k.speed) > 12){
    k.momentum = Math.min(100, k.momentum + 10 * dt);
  }
  if(Math.abs(turnInput) > 0.5 && Math.abs(k.speed) > 10){
    k.momentum = Math.min(100, k.momentum + 15 * dt);
  }

  const fwd = new THREE.Vector3(Math.sin(k.yaw), 0, Math.cos(k.yaw));
  
  k.pos.addScaledVector(fwd, k.speed*dt);
  k.pos.addScaledVector(k.knockVel, dt);
  k.knockVel.multiplyScalar(1 - Math.min(1, dt*5.0));

  // Nitro exhaust flame trail
  if(k.nitroT > 0 && Math.random() < 0.6){
    VEC_SCRATCH_1.copy(k.pos).addScaledVector(fwd, -1.4);
    VEC_SCRATCH_1.y += 0.4;
    spawnExplosion(VEC_SCRATCH_1, 0x00e676);
  }

  // Custom equipped cosmetic exhaust trail
  if(k.isPlayer && Math.abs(k.speed) > 4 && Math.random() < 0.45){
    const tr = ProgressionSystem.data.selectedTrail || 'default';
    if(tr !== 'default'){
      let trColor = 0x00e5ff;
      if(tr === 'flame') trColor = 0xff3d00;
      else if(tr === 'rainbow') trColor = [0xff1744, 0xffea00, 0x00e676, 0x00e5ff, 0xe040fb][Math.floor(Math.random()*5)];
      else if(tr === 'galaxy') trColor = 0xe040fb;
      else if(tr === 'gold') trColor = 0xffeb3b;

      VEC_SCRATCH_1.copy(k.pos).addScaledVector(fwd, -1.3);
      VEC_SCRATCH_1.y += 0.35;
      const tm = new THREE.Mesh(SHARED_SPHERE_GEO, new THREE.MeshBasicMaterial({color: trColor}));
      tm.position.copy(VEC_SCRATCH_1);
      scene.add(tm);
      particles.push({mesh:tm, vel:new THREE.Vector3((Math.random()-0.5)*2, Math.random()*2, (Math.random()-0.5)*2), life:0, maxLife:0.3});
    }
  }

  let onRamp = false;
  let rampTargetY = 0;

  ramps.forEach(rmp => {
    VEC_SCRATCH_1.copy(k.pos);
    const localPos = rmp.mesh.worldToLocal(VEC_SCRATCH_1);

    if(localPos.x >= -0.5 && localPos.x <= rmp.length + 1.0 && Math.abs(localPos.z) <= rmp.width/2 + 0.8){
      onRamp = true;
      const clampedX = Math.max(0, Math.min(localPos.x, rmp.length));
      rampTargetY = (clampedX / rmp.length) * rmp.maxHeight;

      if(localPos.x >= rmp.length * 0.85 && k.speed > 4 && !k.inAir){
        k.jumpVel = 15;
        k.inAir = true;
        k.speed += 6;
        k.momentum = Math.min(100, k.momentum + 15);
        if(k.classKey === 'bomber') dropBomberMine(k);
      }
    }
  });

  if(k.inAir){
    k.pos.y += k.jumpVel * dt;
    k.jumpVel -= 32 * dt;
    if(k.pos.y <= (onRamp ? rampTargetY : 0)){
      k.pos.y = onRamp ? rampTargetY : 0;
      k.inAir = false;
      k.jumpVel = 0;
    }
  } else if(onRamp){
    k.pos.y += (rampTargetY - k.pos.y) * Math.min(1, dt * 16.0);
  } else {
    k.pos.y += (0 - k.pos.y) * Math.min(1, dt * 16.0);
  }

  boostPads.forEach(bp => {
    if(k.pos.distanceTo(bp.pos) < 3.2){
      const dot = fwd.dot(bp.dir);
      const padMult = overchargeActive ? 2.5 : 1.0;
      if(dot > 0.3){
        k.speed = Math.max(k.speed, 26 * padMult * k.classData.topSpeedMult);
        k.nitroT = overchargeActive ? 3.0 : 1.6;
        k.momentum = Math.min(100, k.momentum + (overchargeActive ? 40 : 25));
        if(k.classKey === 'bomber') dropBomberMine(k);
        if(overchargeActive && k.isPlayer) flashCenterMsg('⚡ HYPER OVERCHARGE BOOST!');
      } else if(dot < -0.3){
        k.speed = Math.min(k.speed, 4.0);
        k.speed *= (1 - Math.min(1, dt * 6.0));
        k.momentum = Math.max(0, k.momentum - 20 * dt);
      }
    }
  });

  if(!k.isGhost){
    obstacles.forEach(ob => {
      VEC_SCRATCH_1.subVectors(k.pos, ob.pos);
      const len = VEC_SCRATCH_1.length();
      if(len < ob.r + 1.1){
        VEC_SCRATCH_1.setY(0).normalize();
        k.pos.addScaledVector(VEC_SCRATCH_1, (ob.r + 1.1 - len) * 0.5);
        k.speed *= -0.2;
        k.momentum = Math.max(0, k.momentum - 15);
      }
    });
  }

  if(k.cooldownT > 0) k.cooldownT -= dt;
  if(k.shieldT > 0) k.shieldT -= dt;
  if(k.nitroT > 0) k.nitroT -= dt;
  
  k.shield.visible = k.shieldT > 0;
  if(k.shieldT > 0){ k.shield.rotation.y += dt*2.5; }

  if(k.momentum >= 100){
    k.aura.visible = true;
    k.aura.material.color.setHex(0xff4081);
    k.aura.rotation.y += dt*4.0;
  } else if(k.momentum >= 67){
    k.aura.visible = true;
    k.aura.material.color.setHex(0xffd600);
    k.aura.rotation.y += dt*2.5;
  } else if(k.momentum >= 34){
    k.aura.visible = true;
    k.aura.material.color.setHex(0x00e5ff);
    k.aura.rotation.y += dt*1.5;
  } else {
    k.aura.visible = false;
  }

  const distFromCenter = Math.hypot(k.pos.x, k.pos.z);
  if(distFromCenter > PLATFORM_R || k.falling){
    k.falling = true;
    k.fallVel -= 25*dt;
    k.pos.y += k.fallVel*dt;
    if(k.pos.y < -18){
      k.hp = 0;
      k.die('The Void');
    }
  }

  if(distFromCenter > stormR && !k.falling){
    if(k.classKey === 'ghost' && k.ghostStormImmunity > 0){
      // Ghost is currently immune to storm damage
    } else {
      if(k.classKey === 'ghost' && k.ghostStormImmunity <= 0){
        k.ghostStormImmunity = 3.0; // 3s storm immunity granted
      } else {
        k.takeDamage(15*dt, null, 0, 'The Storm');
        k.momentum = Math.max(0, k.momentum - 20*dt);
      }
    }
  }

  k.updateMeshTransform();
}

function resolveKartCollisions(){
  for(let i=0; i<karts.length; i++){
    for(let j=i+1; j<karts.length; j++){
      const a = karts[i], b = karts[j];
      if(!a.alive || !b.alive || a.falling || b.falling) continue;
      if(a.isGhost || b.isGhost) continue;
      VEC_SCRATCH_1.subVectors(a.pos, b.pos);
      const dist = VEC_SCRATCH_1.length();
      const minDist = 2.6;
      if(dist > 0 && dist < minDist){
        VEC_SCRATCH_1.normalize();
        const overlap = (minDist - dist) * 0.4;
        a.pos.addScaledVector(VEC_SCRATCH_1, overlap);
        b.pos.addScaledVector(VEC_SCRATCH_1, -overlap);
        const relSpeed = Math.abs(a.speed) + Math.abs(b.speed);
        if(relSpeed > 10){
          a.knockVel.addScaledVector(VEC_SCRATCH_1, relSpeed*0.12);
          b.knockVel.addScaledVector(VEC_SCRATCH_1, -relSpeed*0.12);

          // Nitro Ramming Impact Attack
          if(a.nitroT > 0 && Math.abs(a.speed) > 14){
            VEC_SCRATCH_2.copy(VEC_SCRATCH_1).negate();
            b.takeDamage(25, VEC_SCRATCH_2, 22, a.name);
            if(a.isPlayer) flashCenterMsg('💥 NITRO RAMMING IMPACT! (-25 HP)');
          }
          if(b.nitroT > 0 && Math.abs(b.speed) > 14){
            a.takeDamage(25, VEC_SCRATCH_1, 22, b.name);
            if(b.isPlayer) flashCenterMsg('💥 NITRO RAMMING IMPACT! (-25 HP)');
          }
        }
      }
    }
  }
}

function updateProjectiles(dt){
  for(let i=projectiles.length-1; i>=0; i--){
    const p = projectiles[i];
    p.pos.addScaledVector(p.vel, dt);
    p.mesh.position.copy(p.pos);
    p.life -= dt;

    // Rocket missile smoke trail
    if(p.type === 'rocket' && Math.random() < 0.7){
      spawnParticleFromPool(p.pos.clone(), new THREE.Vector3((Math.random()-0.5)*2, Math.random()*2, (Math.random()-0.5)*2), 0xff9100, 0.25, 0.5);
    }

    let hit = false;
    if(Math.hypot(p.pos.x, p.pos.z) > PLATFORM_R+5 || p.pos.y < -8) hit = true;

    if (!currentRoomId) {
      for(const k of karts){
        if(!k.alive || k.name === p.owner) continue;

        VEC_SCRATCH_1.copy(k.pos); VEC_SCRATCH_1.y += 0.6;
        if(k.shieldT > 0 && p.pos.distanceTo(VEC_SCRATCH_1) < 2.0){
          hit = true;
          triggerShieldEMP(k);
          if (p.ownerKart && p.ownerKart.isPlayer) {
            triggerHitConfirmation(0, false);
          }
          break;
        }

        if(p.pos.distanceTo(VEC_SCRATCH_1) < 1.45){
          hit = true;
          applyHit(p, k);
          if (p.ownerKart && p.ownerKart.isPlayer) {
            triggerHitConfirmation(p.dmg, p.type === 'rocket');
          }
          if (k.isPlayer) {
            triggerDamageTaken(p.pos, p.dmg);
          }
          break;
        }
      }
    }
    if(hit || p.life <= 0){
      scene.remove(p.mesh);
      projectiles.splice(i,1);
    }
  }
}

function applyHit(p, k){
  VEC_SCRATCH_1.subVectors(k.pos, p.pos).setY(0).normalize();
  const isDirectHit = (p.type === 'rocket');
  spawnExplosion(p.pos, WEAPONS[p.type] ? WEAPONS[p.type].color : 0xffeb3b, isDirectHit);

  let knockMag = p.knock;
  if(p.ownerKart && p.ownerKart.classKey === 'tank') knockMag *= 2.0;

  k.takeDamage(p.dmg, VEC_SCRATCH_1, knockMag, p.owner);

  if(p.splash > 0){
    karts.forEach(other => {
      if(other === k || !other.alive) return;
      const dd = other.pos.distanceTo(p.pos);
      if(dd < p.splash){
        const d2 = new THREE.Vector3().subVectors(other.pos, p.pos).setY(0).normalize();
        let sKnock = p.knock * 0.5;
        if(p.ownerKart && p.ownerKart.classKey === 'tank') sKnock *= 2.0;
        other.takeDamage(p.dmg*0.5, d2, sKnock, p.owner);
      }
    });
  }
}

function updateMines(dt){
  if (currentRoomId) return;

  for(let i=mines.length-1; i>=0; i--){
    const m = mines[i];
    m.armT -= dt; m.life -= dt;
    m.mesh.rotation.y += dt*1.8;

    let explode = false;
    if(m.armT <= 0){
      for(const k of karts){
        if(!k.alive || k.name === m.owner) continue;
        if(k.pos.distanceTo(m.pos) < 1.75){ explode = true; break; }
      }
    }
    if(explode || m.life <= 0){
      if(explode){
        spawnExplosion(m.pos.clone(), 0xff2a5f);
        karts.forEach(k => {
          if(!k.alive) return;
          const dd = k.pos.distanceTo(m.pos);
          if(dd < m.splash + 1.5){
            const d2 = new THREE.Vector3().subVectors(k.pos, m.pos).setY(0).normalize();
            let mKnock = m.knock;
            if(m.ownerKart && m.ownerKart.classKey === 'tank') mKnock *= 2.0;
            k.takeDamage(m.dmg, d2, mKnock, m.owner);
            k.slowTimer = 3.0; // 3 second sticky sludge slowdown
            if(k.isPlayer) flashCenterMsg('⚠️ MINE TRAP SLOWDOWN!');
          }
        });
      }
      scene.remove(m.mesh);
      mines.splice(i,1);
    }
  }
}

function updatePickups(dt){
  if (currentRoomId) return;

  pickups.forEach(p => {
    if(!p.active) return;
    p.mesh.rotation.y += dt*1.8;
    p.mesh.position.y = 1.0 + Math.sin(performance.now()*0.004 + p.pos.x)*0.2;

    for(const k of karts){
      if(!k.alive) continue;
      if(k.pos.distanceTo(p.pos) < 2.0){
        if(k.hasPowerup()){ continue; }

        applyPickup(k, p.type);
        p.active = false;
        scene.remove(p.mesh);
        setTimeout(() => {
          const idx = pickups.indexOf(p);
          if(idx >= 0) pickups.splice(idx,1);
          spawnPickup();
        }, 5500);
        break;
      }
    }
  });
}

function applyPickup(k, type){
  if(k.storedPowerup !== null) return;
  k.storedPowerup = type;
  if(k.isPlayer) flashCenterMsg(`📦 STORED ${type.toUpperCase()} POWERUP! [PRESS F TO USE]`);
}

function updateParticles(dt){
  updateParticlesPooled(dt);
  updateCombatOverlays(dt);
}

let centerMsgT = 0;
function flashCenterMsg(text){
  const el = document.getElementById('center-msg');
  el.textContent = text;
  el.style.opacity = 1;
  centerMsgT = 1.4;
}

let cameraShakeT = 0;
let cameraShakeMag = 0;
function triggerCamShake(magnitude = 0.4, duration = 0.25) {
  const toggleCamShake = document.getElementById('toggleCamShake');
  if (toggleCamShake && toggleCamShake.textContent === 'DISABLED') return;
  cameraShakeMag = magnitude;
  cameraShakeT = duration;
}

/* ---------------- CAMERA FOLLOW (SMOOTH & RESPONSIVE FEEDBACK) ---------------- */
const camTarget = new THREE.Vector3();
function updateCamera(dt){
  if (!player) return;

  // Dynamic FOV speed pulse (65° -> 72°)
  const speedRatio = Math.min(1.0, Math.abs(player.speed) / 45.0);
  const targetFov = 65 + speedRatio * 7 + (player.nitroT > 0 ? 4 : 0);
  camera.fov += (targetFov - camera.fov) * Math.min(1.0, dt * 10.0);
  camera.updateProjectionMatrix();

  VEC_SCRATCH_1.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  VEC_SCRATCH_2.copy(player.pos).addScaledVector(VEC_SCRATCH_1, -9.0);
  VEC_SCRATCH_2.y += 5.2;

  // Camera shake application
  if (cameraShakeT > 0) {
    cameraShakeT -= dt;
    VEC_SCRATCH_2.x += (Math.random() - 0.5) * cameraShakeMag;
    VEC_SCRATCH_2.y += (Math.random() - 0.5) * cameraShakeMag;
    VEC_SCRATCH_2.z += (Math.random() - 0.5) * cameraShakeMag;
  }

  camera.position.lerp(VEC_SCRATCH_2, 1 - Math.pow(0.001, dt));

  VEC_SCRATCH_3.copy(player.pos);
  VEC_SCRATCH_3.y += 1.2;
  camTarget.lerp(VEC_SCRATCH_3, 1 - Math.pow(0.0005, dt));
  camera.lookAt(camTarget);
}

/* ---------------- 2D RADAR MINIMAP RENDERING ---------------- */
let domMinimapCanvas = null;
let domMinimapCtx = null;

function drawMinimap(){
  if(!domMinimapCanvas){
    domMinimapCanvas = document.getElementById('minimapCanvas');
    if(domMinimapCanvas) domMinimapCtx = domMinimapCanvas.getContext('2d');
  }
  if(!domMinimapCanvas || !domMinimapCtx) return;
  const cv = domMinimapCanvas;
  const ctx = domMinimapCtx;
  const w = cv.width, h = cv.height, cx = w/2, cy = h/2, r = w/2 - 4;
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(10, 20, 35, 0.85)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.clip();

  const mapScale = (r - 6) / PLATFORM_R;

  // Platform boundary
  ctx.beginPath(); ctx.arc(cx, cy, PLATFORM_R * mapScale, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();

  // Storm ring boundary
  ctx.beginPath(); ctx.arc(cx, cy, stormR * mapScale, 0, Math.PI*2);
  ctx.strokeStyle = '#ff1744'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255, 23, 68, 0.12)'; ctx.fill();

  // Boost pads
  boostPads.forEach(bp => {
    const px = cx + bp.pos.x * mapScale;
    const py = cy + bp.pos.z * mapScale;
    ctx.fillStyle = '#ff9100';
    ctx.fillRect(px-2, py-2, 4, 4);
  });

  // Pickups
  pickups.forEach(p => {
    if(!p.active) return;
    const px = cx + p.pos.x * mapScale;
    const py = cy + p.pos.z * mapScale;
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI*2); ctx.fill();
  });

  // Karts
  karts.forEach(k => {
    if(!k.alive) return;
    const px = cx + k.pos.x * mapScale;
    const py = cy + k.pos.z * mapScale;
    if(k.isPlayer){
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(k.yaw);
      ctx.fillStyle = '#00e676';
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = '#ff1744';
      ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI*2); ctx.fill();
    }
  });

  ctx.restore();
}

/* ---------------- HUD UPDATE & DOM CACHING ---------------- */
let hpbar = null, mombar = null, momText = null, superBadge = null, btnSuper = null, timerEl = null, stormlabel = null;
let domRankEl = null, domAbilEl = null, domWCardBox = null, domWIconEl = null, domWNameEl = null, domWAmmoEl = null;
let domSpeedoVal = null, domSpeedoBar = null, domDriftBox = null, domSlotEl = null, domSlotText = null, domRespawnTimer = null, domCenterMsg = null;
let hudFrameCount = 0;

function initHUDCache(){
  hpbar = document.getElementById('hpbar');
  mombar = document.getElementById('mombar');
  momText = document.getElementById('momText');
  superBadge = document.getElementById('superBadge');
  btnSuper = document.getElementById('btnSuper');
  timerEl = document.getElementById('timer');
  stormlabel = document.getElementById('stormlabel');

  domRankEl = document.getElementById('rankBadge');
  domAbilEl = document.getElementById('abilityStatusBadge');
  domWCardBox = document.getElementById('weaponCardBox');
  domWIconEl = document.getElementById('wCardIcon');
  domWNameEl = document.getElementById('wCardName');
  domWAmmoEl = document.getElementById('wCardAmmo');
  domSpeedoVal = document.getElementById('speedoVal');
  domSpeedoBar = document.getElementById('speedoBar');
  domDriftBox = document.getElementById('driftMeterBox');
  domSlotEl = document.getElementById('powerupSlot');
  domSlotText = document.getElementById('powerupSlotText');
  domRespawnTimer = document.getElementById('respawnTimer');
  domCenterMsg = document.getElementById('center-msg');
}

function fmtTime(s){
  s = Math.max(0, s);
  const m = Math.floor(s/60), r = Math.floor(s%60);
  return m + ':' + String(r).padStart(2,'0');
}

function updateHUD(dt){
  if(!hpbar) initHUDCache();
  hudFrameCount++;

  const hpRatio = Math.max(0, player.hp / player.maxHp) * 100;
  if(hpbar) {
    hpbar.style.width = hpRatio + '%';
    hpbar.style.background = hpRatio > 50 
      ? 'linear-gradient(90deg,#00e676,#00b0ff)' 
      : hpRatio > 25 
        ? 'linear-gradient(90deg,#ffeb3b,#ff9100)' 
        : 'linear-gradient(90deg,#ff4081,#ff1744)';
  }

  const momPct = Math.round(player.momentum);
  if(mombar) {
    mombar.style.width = momPct + '%';
    if(momPct >= 100){
      mombar.style.background = 'linear-gradient(90deg,#ff4081,#ff9100,#ffeb3b)';
      if(momText) momText.textContent = 'MOMENTUM: 100% (SUPER NOVA READY!)';
      if(superBadge) superBadge.style.display = 'inline-block';
      if(btnSuper) btnSuper.style.display = 'flex';
    } else if(momPct >= 67){
      mombar.style.background = 'linear-gradient(90deg,#ffd600,#ff9100)';
      if(momText) momText.textContent = `MOMENTUM: ${momPct}% (CHARGED)`;
      if(superBadge) superBadge.style.display = 'none';
      if(btnSuper) btnSuper.style.display = 'none';
    } else if(momPct >= 34){
      mombar.style.background = 'linear-gradient(90deg,#00e5ff,#00e676)';
      if(momText) momText.textContent = `MOMENTUM: ${momPct}% (BOOSTED)`;
      if(superBadge) superBadge.style.display = 'none';
      if(btnSuper) btnSuper.style.display = 'none';
    } else {
      mombar.style.background = 'linear-gradient(90deg,#00b0ff,#00e5ff)';
      if(momText) momText.textContent = `MOMENTUM: ${momPct}%`;
      if(superBadge) superBadge.style.display = 'none';
      if(btnSuper) btnSuper.style.display = 'none';
    }
  }

  // 1. Real-Time Rank & Kills Badge (Throttled once every 6 frames for performance)
  if(hudFrameCount % 6 === 0 && domRankEl){
    const sorted = karts.slice().sort((a,b) => b.kills - a.kills);
    const placeIdx = sorted.findIndex(k => k.isPlayer);
    const ord = placeIdx === 0 ? '1st' : (placeIdx === 1 ? '2nd' : (placeIdx === 2 ? '3rd' : `${placeIdx+1}th`));
    domRankEl.textContent = `🏆 ${ord} / ${karts.length} · ⚔️ ${player.kills} KILLS`;
  }

  // 2. Ability Status / Cooldown Badge
  if(domAbilEl){
    if(player.classKey === 'guardian'){
      domAbilEl.textContent = player.shieldT > 0 ? '🛡️ AEGIS SHIELD ACTIVE' : `🛡️ SHIELD RECHARGE: ${Math.ceil(player.guardianTimer)}s`;
    } else if(player.classKey === 'bomber'){
      domAbilEl.textContent = player.bomberMineCooldown > 0 ? `💣 MINE RECHARGE: ${Math.ceil(player.bomberMineCooldown)}s` : '💣 MINE READY [SPACE]';
    } else {
      domAbilEl.textContent = `${player.classData.icon} ${player.classData.name} ACTIVE`;
    }
  }

  // 3. Stylized Weapon Card Box
  const wIcons = { pea:'🔫', rocket:'🚀', triple:'⚡', shield:'🛡️', nitro:'🔥', mine:'💣' };
  if(domWCardBox && domWNameEl && domWAmmoEl){
    const currW = WEAPONS[player.weapon] || WEAPONS.pea;
    if(domWIconEl) domWIconEl.textContent = wIcons[player.weapon] || '🔫';
    domWNameEl.textContent = currW.name;
    domWAmmoEl.textContent = player.weapon === 'pea' ? 'AMMO: ∞' : `AMMO: x${player.ammo}`;
    domWCardBox.style.borderColor = '#' + currW.color.toString(16).padStart(6, '0');
  }

  // 4. Digital Speedometer & Gauge Bar
  const speedKmh = Math.round(Math.abs(player.speed) * 4.2);
  if(domSpeedoVal && domSpeedoBar){
    domSpeedoVal.textContent = `⚡ ${speedKmh} KM/H`;
    const maxKmh = 26 * player.classData.topSpeedMult * 4.2;
    domSpeedoBar.style.width = Math.min(100, (speedKmh / maxKmh)*100) + '%';
  }

  // 5. Drift Stage Meter Box
  if(domDriftBox){
    if(player.isDrifting){
      domDriftBox.style.display = 'block';
      if(player.driftStage === 3){
        domDriftBox.textContent = '🔥 STAGE 3: PURPLE MINI-TURBO READY!';
        domDriftBox.style.borderColor = '#e040fb'; domDriftBox.style.color = '#e040fb';
      } else if(player.driftStage === 2){
        domDriftBox.textContent = '🔥 STAGE 2: ORANGE MINI-TURBO READY!';
        domDriftBox.style.borderColor = '#ff9100'; domDriftBox.style.color = '#ff9100';
      } else {
        domDriftBox.textContent = '🔥 STAGE 1: BLUE MINI-TURBO READY!';
        domDriftBox.style.borderColor = '#00e5ff'; domDriftBox.style.color = '#00e5ff';
      }
    } else {
      domDriftBox.style.display = 'none';
    }
  }

  // 6. Powerup Slot
  if(domSlotEl && domSlotText){
    if(player.storedPowerup){
      domSlotEl.style.display = 'block';
      domSlotText.textContent = player.storedPowerup.toUpperCase();
    } else {
      domSlotEl.style.display = 'none';
    }
  }

  const timeLeft = ROUND_TIME - roundElapsed;
  if(timerEl) timerEl.textContent = fmtTime(timeLeft);
  if(stormlabel) stormlabel.textContent = 'Safe Zone: ' + Math.round(stormR) + 'm';

  if(!player.alive && player.respawnT > 0 && domRespawnTimer){
    domRespawnTimer.textContent = `RESPAWNING IN ${Math.ceil(player.respawnT)}...`;
  }

  if(centerMsgT > 0){
    centerMsgT -= dt;
    if(centerMsgT <= 0 && domCenterMsg) domCenterMsg.style.opacity = 0;
  }

  // 7. 2D Radar Minimap
  drawMinimap();
}

/* ---------------- GAME OVER & PROGRESSION ---------------- */
let gameOver = false;
function endRound(){
  gameOver = true;
  const deathScreen = document.getElementById('deathScreen');
  if (deathScreen) deathScreen.style.display = 'none';

  if (typeof setUIState === 'function') {
    setUIState(UIState.RESULTS);
  }

  const winnerBanner = document.getElementById('winnerBanner');
  const accoladesBar = document.getElementById('accoladesBar');
  if (winnerBanner) winnerBanner.style.display = 'none';
  if (accoladesBar) accoladesBar.style.display = 'none';

  const btnReturnToLobby = document.getElementById('btnReturnToLobby');
  const btnResultsLeave = document.getElementById('btnResultsLeave');
  const playAgainBtn = document.getElementById('playAgain');
  if (btnReturnToLobby) btnReturnToLobby.style.display = 'none';
  if (btnResultsLeave) btnResultsLeave.style.display = 'none';
  if (playAgainBtn) playAgainBtn.style.display = 'inline-block';

  const sorted = karts.slice().sort((a,b) => b.kills - a.kills);

  const placeIdx = sorted.findIndex(k => k.isPlayer);
  const placeXp = placeIdx === 0 ? 500 : (placeIdx === 1 ? 300 : (placeIdx === 2 ? 150 : 50));
  const killsXp = player.kills * 40;
  const boostsXp = Math.min(200, player.boostCount * 15);
  const damageXp = Math.round(player.damageDealt * 0.5);
  const totalXp = placeXp + killsXp + boostsXp + damageXp;

  const xpResult = ProgressionSystem.addXp(totalXp);

  const el = document.getElementById('finalScores');
  let xpHtml = `
    <div style="background:rgba(0,0,0,0.6);border:2px solid #ffeb3b;border-radius:14px;padding:14px;margin-bottom:14px;text-align:left;">
      <div style="font-size:18px;font-weight:900;color:#ffeb3b;margin-bottom:8px;">🏆 MATCH COMPLETE - XP GAINED</div>
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:14px;"><span>Placement (${placeIdx+1}${placeIdx===0?'st':placeIdx===1?'nd':placeIdx===2?'rd':'th'})</span><span style="color:#00e5ff;font-weight:900;">+${placeXp} XP</span></div>
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:14px;"><span>Kills (${player.kills})</span><span style="color:#00e5ff;font-weight:900;">+${killsXp} XP</span></div>
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:14px;"><span>Pad Boosts (${player.boostCount})</span><span style="color:#00e5ff;font-weight:900;">+${boostsXp} XP</span></div>
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:14px;"><span>Damage Dealt (${Math.round(player.damageDealt)})</span><span style="color:#00e5ff;font-weight:900;">+${damageXp} XP</span></div>
      <div style="border-top:1px solid rgba(255,255,255,0.2);margin-top:6px;padding-top:6px;display:flex;justify-content:space-between;font-weight:900;font-size:16px;"><span>TOTAL XP GAINED:</span><span style="color:#ffeb3b">+${totalXp} XP</span></div>
      ${xpResult.leveledUp ? `<div style="margin-top:8px;background:linear-gradient(90deg,#ff4081,#ff9100);color:#fff;padding:6px 12px;border-radius:10px;font-weight:900;text-align:center;">🎉 LEVEL UP! LEVEL ${xpResult.newLevel}!</div>` : ''}
      <div style="margin-top:10px;font-size:13px;font-weight:900;color:#00e5ff;">LEVEL ${ProgressionSystem.data.level} (${ProgressionSystem.data.xp} / ${ProgressionSystem.getXpForLevel(ProgressionSystem.data.level)} XP)</div>
      <div style="width:100%;height:10px;background:rgba(255,255,255,0.2);border-radius:5px;overflow:hidden;margin-top:4px;"><div style="height:100%;width:${Math.min(100, (ProgressionSystem.data.xp/ProgressionSystem.getXpForLevel(ProgressionSystem.data.level))*100)}%;background:linear-gradient(90deg,#00e5ff,#ffeb3b);"></div></div>
    </div>
  `;

  let leaderboardHtml = sorted.map((k,i) => `<div><span>${i===0 ? '🏆 ' : ''}${k.classData.icon} ${k.name}</span><span>${k.kills} kills</span></div>`).join('');
  el.innerHTML = xpHtml + leaderboardHtml;
}

function showMultiplayerEndScreen(standings) {
  gameOver = true;
  const deathScreen = document.getElementById('deathScreen');
  if (deathScreen) deathScreen.style.display = 'none';

  if (typeof setUIState === 'function') {
    setUIState(UIState.RESULTS);
  }

  const winnerBanner = document.getElementById('winnerBanner');
  const winnerNameText = document.getElementById('winnerNameText');
  const accoladesBar = document.getElementById('accoladesBar');
  const accKillsVal = document.getElementById('accKillsVal');
  const accDmgVal = document.getElementById('accDmgVal');

  if (standings && standings.length > 0) {
    if (winnerBanner && winnerNameText) {
      winnerBanner.style.display = 'block';
      winnerNameText.textContent = standings[0].displayName || 'PLAYER';
    }
    if (accoladesBar && accKillsVal && accDmgVal) {
      accoladesBar.style.display = 'flex';
      const maxKillsPlayer = standings.slice().sort((a,b) => b.kills - a.kills || b.damageDealt - a.damageDealt)[0];
      const maxDmgPlayer = standings.slice().sort((a,b) => b.damageDealt - a.damageDealt || b.kills - a.kills)[0];

      accKillsVal.textContent = maxKillsPlayer ? `${maxKillsPlayer.displayName} (${maxKillsPlayer.kills})` : '-';
      accDmgVal.textContent = maxDmgPlayer ? `${maxDmgPlayer.displayName} (${maxDmgPlayer.damageDealt})` : '-';
    }
  }

  const btnReturnToLobby = document.getElementById('btnReturnToLobby');
  const btnResultsLeave = document.getElementById('btnResultsLeave');
  const playAgainBtn = document.getElementById('playAgain');
  if (btnReturnToLobby) btnReturnToLobby.style.display = 'inline-block';
  if (btnResultsLeave) btnResultsLeave.style.display = 'inline-block';
  if (playAgainBtn) playAgainBtn.style.display = 'none';

  const myStandingIdx = standings.findIndex(s => s.id === myPlayerId);
  const placeIdx = myStandingIdx >= 0 ? myStandingIdx : standings.length;

  const placeXp = placeIdx === 0 ? 500 : (placeIdx === 1 ? 300 : (placeIdx === 2 ? 150 : 50));
  const killsXp = (player ? player.kills : 0) * 40;
  const boostsXp = Math.min(200, (player ? player.boostCount || 0 : 0) * 15);
  const damageXp = Math.round((player ? player.damageDealt || 0 : 0) * 0.5);
  const totalXp = placeXp + killsXp + boostsXp + damageXp;

  const xpResult = ProgressionSystem.addXp(totalXp);

  const el = document.getElementById('finalScores');
  if (!el) return;

  let xpHtml = `
    <div style="background:rgba(0,0,0,0.6);border:2px solid #ffeb3b;border-radius:14px;padding:14px;margin-bottom:14px;text-align:left;">
      <div style="font-size:18px;font-weight:900;color:#ffeb3b;margin-bottom:8px;">🏆 MULTIPLAYER MATCH COMPLETE - XP GAINED</div>
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:14px;"><span>Placement (${placeIdx+1}${placeIdx===0?'st':placeIdx===1?'nd':placeIdx===2?'rd':'th'})</span><span style="color:#00e5ff;font-weight:900;">+${placeXp} XP</span></div>
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:14px;"><span>Kills (${player ? player.kills : 0})</span><span style="color:#00e5ff;font-weight:900;">+${killsXp} XP</span></div>
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:14px;"><span>Pad Boosts (${player ? player.boostCount || 0 : 0})</span><span style="color:#00e5ff;font-weight:900;">+${boostsXp} XP</span></div>
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:14px;"><span>Damage Dealt (${Math.round(player ? player.damageDealt || 0 : 0)})</span><span style="color:#00e5ff;font-weight:900;">+${damageXp} XP</span></div>
      <div style="border-top:1px solid rgba(255,255,255,0.2);margin-top:6px;padding-top:6px;display:flex;justify-content:space-between;font-weight:900;font-size:16px;"><span>TOTAL XP GAINED:</span><span style="color:#ffeb3b">+${totalXp} XP</span></div>
      ${xpResult.leveledUp ? `<div style="margin-top:8px;background:linear-gradient(90deg,#ff4081,#ff9100);color:#fff;padding:6px 12px;border-radius:10px;font-weight:900;text-align:center;">🎉 LEVEL UP! LEVEL ${xpResult.newLevel}!</div>` : ''}
      <div style="margin-top:10px;font-size:13px;font-weight:900;color:#00e5ff;">LEVEL ${ProgressionSystem.data.level} (${ProgressionSystem.data.xp} / ${ProgressionSystem.getXpForLevel(ProgressionSystem.data.level)} XP)</div>
      <div style="width:100%;height:10px;background:rgba(255,255,255,0.2);border-radius:5px;overflow:hidden;margin-top:4px;"><div style="height:100%;width:${Math.min(100, (ProgressionSystem.data.xp/ProgressionSystem.getXpForLevel(ProgressionSystem.data.level))*100)}%;background:linear-gradient(90deg,#00e5ff,#ffeb3b);"></div></div>
    </div>
  `;

  let leaderboardHtml = standings.map((s, i) => `<div><span>${i===0 ? '🏆 ' : ''}${s.displayName} ${s.id === myPlayerId ? '(YOU)' : ''}</span><span>${s.kills} kills · ${s.deaths} d · ${s.damageDealt} dmg</span></div>`).join('');
  el.innerHTML = xpHtml + leaderboardHtml;
}

const mpPowerupMeshes = {};
function syncMultiplayerPowerups(serverPowerups) {
  if (!Array.isArray(serverPowerups)) return;

  if (pickups.length > 0 && currentRoomId) {
    pickups.forEach(p => { if (p.mesh) scene.remove(p.mesh); });
    pickups.length = 0;
  }

  serverPowerups.forEach(sp => {
    let item = mpPowerupMeshes[sp.id];
    if (!item) {
      const mesh = makePickupMesh(sp.type);
      mesh.position.set(sp.x, 1.0, sp.z);
      scene.add(mesh);
      item = { mesh, active: sp.active, type: sp.type };
      mpPowerupMeshes[sp.id] = item;
    }

    item.active = sp.active;
    item.mesh.visible = sp.active;
    item.mesh.rotation.y += 0.03;
    item.mesh.position.y = 1.0 + Math.sin(performance.now() * 0.004 + sp.x) * 0.2;
  });
}

/* ---------------- GAME LOOP & RENDERER ---------------- */
const clock = new THREE.Clock();
let started = false;

function initSoloGame() {
  currentRoomId = null;
  roundElapsed = 0;
  stormR = 85;
  gameOver = false;

  // Clear existing karts
  karts.forEach(k => {
    if (k && k.mesh) scene.remove(k.mesh);
  });
  for (const id in remoteKarts) delete remoteKarts[id];

  karts.length = 0;
  player = new Kart('YOU', selectedKartClass, true, {x:0, z:28});
  karts.push(player);

  for(let i=0; i<7; i++){
    const ang = (i/7)*Math.PI*2 + Math.PI/4;
    const prof = BOT_PROFILES[i];
    const bot = new Kart(prof.name, prof.classKey, false, {x:Math.cos(ang)*45, z:Math.sin(ang)*45});
    bot.personality = prof.personality;
    karts.push(bot);
  }

  // Clear projectiles & mines
  projectiles.forEach(p => { if (p.mesh) scene.remove(p.mesh); });
  projectiles.length = 0;
  mines.forEach(m => { if (m.mesh) scene.remove(m.mesh); });
  mines.length = 0;

  const badge = document.getElementById('kartClassBadge');
  if(badge){
    badge.innerHTML = `${player.classData.icon} ${player.classData.name}: ${player.classData.abilityName}`;
  }

  setUIState(UIState.GAME);
  started = true;
  clock.getDelta();
}

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.1);

  // Environmental animations
  boostTextures.forEach(t => { t.offset.y -= dt * 1.8; });
  clouds.forEach(c => {
    if (c.mesh) {
      c.mesh.position.x += c.speed * dt * 0.5;
      if (c.mesh.position.x > 350) c.mesh.position.x = -350;
    }
  });

  // Universal Storm Visual Scaling & Pulsing (Solo & Multiplayer)
  if (typeof stormRing !== 'undefined' && stormRing) {
    stormRing.scale.set(stormR / 85, 1, stormR / 85);
    stormRing.rotation.z += dt * 0.4;
    if (stormRing.material) stormRing.material.opacity = 0.8 + Math.sin(performance.now() * 0.006) * 0.15;
  }
  if (typeof stormWall !== 'undefined' && stormWall) {
    stormWall.scale.set(stormR / 85, 1, stormR / 85);
    stormWall.rotation.y -= dt * 0.15;
  }

  // Floating & Rotating Powerup Mystery Boxes
  pickups.forEach((p, idx) => {
    if (p.active && p.mesh) {
      p.mesh.rotation.y += dt * 2.0;
      p.mesh.position.y = 1.0 + Math.sin(performance.now() * 0.003 + idx * 0.7) * 0.25;
    }
  });

  if (currentUIState === UIState.GAME && started && !gameOver) {
    if (!currentRoomId) {
      // Solo offline mode simulation
      roundElapsed += dt;

      const elapsedRatio = roundElapsed / ROUND_TIME;
      stormR = Math.max(12, 85 * (1 - elapsedRatio * 0.85));

      if (player && !player.alive) {
        player.respawnT -= dt;
        if (player.respawnT <= 0) player.respawn();
      }

      karts.forEach(k => {
        if (!k.isPlayer) {
          if (!k.alive) {
            k.respawnT -= dt;
            if (k.respawnT <= 0) k.respawn();
          } else {
            updateAI(k, dt);
          }
        }
        integrateKart(k, dt, k.isPlayer);
      });

      resolveKartCollisions();
      updateProjectiles(dt);
      updateMines(dt);
      updatePickups(dt);
      updateParticles(dt);
      updateSuperNovas(dt);
      updateArenaEvents(dt);

      if (roundElapsed >= ROUND_TIME) {
        endRound();
      }
    } else {
      // Multiplayer client update
      karts.forEach(k => {
        integrateKart(k, dt, k.isPlayer);
      });
      updateProjectiles(dt);
      updateParticles(dt);
      updateSuperNovas(dt);
      sendPlayerInput();
    }

    updateCamera(dt);
    updateHUD(dt);
  } else {
    if (camera) camera.rotation.y += 0.002 * dt * 60;
  }

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

function initMultiplayerGame(matchTime) {
  if (typeof setUIState === 'function' && currentUIState !== UIState.GAME) {
    setUIState(UIState.GAME);
  }

  // Clear inputs cleanly to avoid stuck keys
  for (let k in keys) keys[k] = false;
  for (let t in touch) touch[t] = false;
  spacePressed = false;

  const mTime = (matchTime !== undefined) ? matchTime : 120;
  roundElapsed = ROUND_TIME - mTime;
  started = true;
  gameOver = false;

  const deathScreen = document.getElementById('deathScreen');
  const overlay = document.getElementById('overlay');
  const countdownOverlay = document.getElementById('countdownOverlay');
  if (deathScreen) deathScreen.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
  if (countdownOverlay) countdownOverlay.style.display = 'none';

  if (player) {
    player.updateMeshTransform();
  }

  if (player && typeof camTarget !== 'undefined' && camTarget) {
    VEC_SCRATCH_3.copy(player.pos);
    VEC_SCRATCH_3.y += 1.2;
    camTarget.copy(VEC_SCRATCH_3);
    camera.lookAt(camTarget);
  }

  clock.getDelta();
}

document.getElementById('playAgain').addEventListener('click', () => location.reload());

let selectedCharTempId = CharacterRegistry.getSelectedCharacterId();

function renderCharacterRoster() {
  const grid = document.getElementById('charRosterGrid');
  if (!grid) return;

  const currentLevel = ProgressionSystem.data.level || 1;

  grid.innerHTML = CharacterRegistry.characters.map(char => {
    const isUnlocked = currentLevel >= char.reqLvl;
    const isSelected = char.id === selectedCharTempId;
    const rarityClass = `kb-rarity-${char.rarity.toLowerCase()}`;

    return `
      <div class="kb-char-card ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}" data-char-id="${char.id}">
        <div class="kb-char-card-portrait" style="border-color: ${char.accent};">
          ${isUnlocked ? char.portrait : '🔒'}
        </div>
        <div class="kb-char-card-info">
          <div class="kb-char-card-name">${char.name}</div>
          <div class="kb-char-card-style">${char.style}</div>
          <div class="kb-rarity-badge ${rarityClass}">${char.rarity}</div>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.kb-char-card').forEach(card => {
    card.addEventListener('click', () => {
      const charId = card.getAttribute('data-char-id');
      const charObj = CharacterRegistry.getCharacter(charId);
      if (!charObj) return;

      selectedCharTempId = charId;
      renderCharacterRoster();
      updateCharacterDetails(charObj);
    });
  });
}

let stageRenderer = null;
let stageScene = null;
let stageCamera = null;
let stageCharGroup = null;
let stageSpotlight = null;
let isStageDragging = false;
let previousMouseX = 0;

function initCharStagePreview() {
  const container = document.getElementById('charPreviewStage');
  if (!container || stageRenderer) return;

  const width = container.clientWidth || 300;
  const height = container.clientHeight || 300;

  stageScene = new THREE.Scene();
  stageCamera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
  stageCamera.position.set(0, 0.9, 2.6);
  stageCamera.lookAt(0, 0.5, 0);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
  stageScene.add(ambientLight);

  stageSpotlight = new THREE.SpotLight(0x00f3ff, 2.5);
  stageSpotlight.position.set(2, 4, 3);
  stageSpotlight.angle = Math.PI / 4;
  stageSpotlight.penumbra = 0.5;
  stageScene.add(stageSpotlight);

  stageCharGroup = new THREE.Group();
  stageScene.add(stageCharGroup);

  stageRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  stageRenderer.setSize(width, height);
  stageRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(stageRenderer.domElement);

  const dom = stageRenderer.domElement;
  dom.style.cursor = 'grab';
  dom.addEventListener('mousedown', (e) => {
    isStageDragging = true;
    previousMouseX = e.clientX;
    dom.style.cursor = 'grabbing';
  });
  window.addEventListener('mouseup', () => {
    isStageDragging = false;
    if (dom) dom.style.cursor = 'grab';
  });
  window.addEventListener('mousemove', (e) => {
    if (isStageDragging && stageCharGroup) {
      const deltaX = e.clientX - previousMouseX;
      stageCharGroup.rotation.y += deltaX * 0.01;
      previousMouseX = e.clientX;
    }
  });

  dom.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isStageDragging = true;
      previousMouseX = e.touches[0].clientX;
    }
  }, { passive: true });
  window.addEventListener('touchend', () => { isStageDragging = false; });
  window.addEventListener('touchmove', (e) => {
    if (isStageDragging && stageCharGroup && e.touches.length === 1) {
      const deltaX = e.touches[0].clientX - previousMouseX;
      stageCharGroup.rotation.y += deltaX * 0.01;
      previousMouseX = e.touches[0].clientX;
    }
  }, { passive: true });

  function animateStage() {
    requestAnimationFrame(animateStage);
    if (typeof currentUIState !== 'undefined' && currentUIState === UIState.CHARACTER_SELECT) {
      if (!isStageDragging && stageCharGroup) {
        stageCharGroup.rotation.y += 0.008;
      }
      if (stageRenderer && stageScene && stageCamera) {
        stageRenderer.render(stageScene, stageCamera);
      }
    }
  }
  animateStage();
}

function updateStagePreviewCharacter(charObj) {
  if (!stageScene || !stageCharGroup) return;

  while (stageCharGroup.children.length > 0) {
    stageCharGroup.remove(stageCharGroup.children[0]);
  }

  const avatar = CharacterModelFactory.createAvatar(charObj.id, { scale: 1.35 });
  stageCharGroup.add(avatar);
  stageCharGroup.rotation.y = 0;

  if (stageSpotlight) {
    stageSpotlight.color.set(charObj.accent);
  }
}

function updateCharacterDetails(charObj) {
  const nameEl = document.getElementById('charDetailName');
  const styleEl = document.getElementById('charDetailStyle');
  const descEl = document.getElementById('charDetailDesc');
  const preferredEl = document.getElementById('charDetailPreferred');
  const rarityBadge = document.getElementById('charDetailRarityBadge');
  const emotesList = document.getElementById('charEmotesList');
  const unlockBox = document.getElementById('charUnlockBox');
  const reqLvlVal = document.getElementById('charReqLvlVal');
  const confirmBtn = document.getElementById('btnConfirmCharacter');
  const pedestalGlow = document.getElementById('stagePedestalGlow');

  if (nameEl) nameEl.textContent = charObj.name;
  if (styleEl) {
    styleEl.textContent = `${charObj.style} PERSONALITY`;
    styleEl.style.color = charObj.accent;
  }
  if (descEl) descEl.textContent = charObj.shortDescription;
  if (preferredEl) preferredEl.textContent = `🏎️ PREFERRED CLASS: ${charObj.preferredKartClass}`;

  if (rarityBadge) {
    rarityBadge.textContent = charObj.rarity;
    rarityBadge.className = `kb-rarity-badge kb-rarity-${charObj.rarity.toLowerCase()}`;
  }

  if (emotesList) {
    emotesList.innerHTML = charObj.emotes.map(e => `<span class="kb-emote-chip">${e}</span>`).join('');
  }

  const currentLevel = ProgressionSystem.data.level || 1;
  const isUnlocked = currentLevel >= charObj.reqLvl;

  if (unlockBox && reqLvlVal) {
    if (!isUnlocked) {
      unlockBox.style.display = 'block';
      reqLvlVal.textContent = charObj.reqLvl;
    } else {
      unlockBox.style.display = 'none';
    }
  }

  if (confirmBtn) {
    if (!isUnlocked) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = `🔒 UNLOCKS AT LVL ${charObj.reqLvl}`;
    } else {
      confirmBtn.disabled = false;
      confirmBtn.textContent = `CONFIRM ${charObj.name} 🚀`;
    }
  }

  if (pedestalGlow) {
    pedestalGlow.style.background = `radial-gradient(ellipse at center, ${charObj.accent} 0%, transparent 70%)`;
  }

  updateStagePreviewCharacter(charObj);
}

function initCharacterSelectUI() {
  selectedCharTempId = CharacterRegistry.getSelectedCharacterId();
  renderCharacterRoster();
  initCharStagePreview();
  const charObj = CharacterRegistry.getCharacter(selectedCharTempId);
  updateCharacterDetails(charObj);
}

/* ---------------- GARAGE & PROFILE UI ---------------- */
let currentGarageTab = 'trails';

/* ---------------- CLIENT UI STATE MANAGER (PHASE 2 STEP 2.3) ---------------- */
const UIState = {
  MAIN_MENU: 'MAIN_MENU',
  ONLINE_MENU: 'ONLINE_MENU',
  CREATE_ROOM: 'CREATE_ROOM',
  JOIN_ROOM: 'JOIN_ROOM',
  MULTIPLAYER_LOBBY: 'MULTIPLAYER_LOBBY',
  COUNTDOWN: 'COUNTDOWN',
  SOLO_SELECT: 'SOLO_SELECT',
  GARAGE: 'GARAGE',
  CHARACTER_SELECT: 'CHARACTER_SELECT',
  SETTINGS: 'SETTINGS',
  RESULTS: 'RESULTS',
  GAME: 'GAME'
};

let currentUIState = UIState.MAIN_MENU;

function updateStartScreenLvl(){
  const lvlEl = document.getElementById('menuLvlVal');
  if(lvlEl) lvlEl.textContent = ProgressionSystem.data.level;

  const nameDisplay = document.getElementById('menuPlayerNameDisplay');
  const name = localStorage.getItem('kb_player_name') || 'KartPlayer';
  if(nameDisplay) nameDisplay.textContent = name;

  const avatarEl = document.getElementById('menuAvatar');
  if(avatarEl) avatarEl.textContent = name.substring(0, 2).toUpperCase();

  const xpFill = document.getElementById('menuXpFill');
  const xpText = document.getElementById('menuXpText');
  const reqXp = ProgressionSystem.getXpForLevel(ProgressionSystem.data.level);
  const curXp = ProgressionSystem.data.xp || 0;
  const pct = Math.min(100, Math.max(0, (curXp / reqXp) * 100));
  if(xpFill) xpFill.style.width = pct + '%';
  if(xpText) xpText.textContent = `${curXp} / ${reqXp} XP`;
}

function getPlayerName() {
  const input = document.getElementById('playerNameInput');
  let val = input ? input.value.trim() : '';
  if (!val) val = localStorage.getItem('kb_player_name') || 'KartPlayer';
  return val;
}

function initPlayerNameInput() {
  const input = document.getElementById('playerNameInput');
  if (input) {
    input.value = localStorage.getItem('kb_player_name') || 'KartPlayer';
  }
}

function clearJoinError() {
  const err = document.getElementById('joinErrorMsg');
  if (err) { err.style.display = 'none'; err.textContent = ''; }
}

function showJoinError(msg) {
  const err = document.getElementById('joinErrorMsg');
  if (err) {
    err.style.display = 'block';
    err.textContent = msg;
  }
}

function copyRoomCode(code, btnId) {
  if (!code) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.getElementById(btnId);
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '✓ COPIED!';
        setTimeout(() => { btn.innerHTML = orig; }, 2000);
      }
    });
  }
}

function setUIState(state) {
  currentUIState = state;

  const mainMenu = document.getElementById('mainMenu');
  const onlineView = document.getElementById('onlineMenuView');
  const createView = document.getElementById('createRoomView');
  const joinView = document.getElementById('joinRoomView');
  const lobbyView = document.getElementById('lobbyPreviewView');
  const countdownOverlay = document.getElementById('countdownOverlay');
  const soloView = document.getElementById('soloSelectView');
  const garageModal = document.getElementById('garageModal');
  const charSelectView = document.getElementById('characterSelectView');
  const settingsView = document.getElementById('settingsView');
  const hud = document.getElementById('hud');
  const touchControls = document.getElementById('touchControls');
  const overlay = document.getElementById('overlay');

  const allScreens = [
    mainMenu, onlineView, createView, joinView, lobbyView,
    countdownOverlay, soloView, garageModal, charSelectView,
    settingsView, hud, touchControls
  ];

  allScreens.forEach(el => {
    if (el) {
      el.style.display = 'none';
      el.classList.add('kb-screen-hidden');
    }
  });
  if (overlay && state !== UIState.RESULTS) {
    overlay.style.display = 'none';
    overlay.classList.add('kb-screen-hidden');
  }

  let targetEl = null;
  if (state === UIState.MAIN_MENU) {
    targetEl = mainMenu;
    updateStartScreenLvl();
  } else if (state === UIState.ONLINE_MENU) {
    targetEl = onlineView;
    initPlayerNameInput();
  } else if (state === UIState.CREATE_ROOM) {
    targetEl = createView;
  } else if (state === UIState.JOIN_ROOM) {
    targetEl = joinView;
    clearJoinError();
  } else if (state === UIState.MULTIPLAYER_LOBBY) {
    targetEl = lobbyView;
  } else if (state === UIState.COUNTDOWN) {
    targetEl = countdownOverlay;
  } else if (state === UIState.SOLO_SELECT) {
    targetEl = soloView;
    renderKartSelectionGrid();
  } else if (state === UIState.GARAGE) {
    targetEl = garageModal;
    renderGarageUI();
  } else if (state === UIState.CHARACTER_SELECT) {
    targetEl = charSelectView;
    initCharacterSelectUI();
  } else if (state === UIState.SETTINGS) {
    targetEl = settingsView;
  } else if (state === UIState.RESULTS) {
    targetEl = overlay;
  } else if (state === UIState.GAME) {
    if (hud) {
      hud.style.display = 'block';
      hud.classList.remove('kb-screen-hidden');
    }
    if ('ontouchstart' in window && touchControls) {
      touchControls.style.display = 'block';
      touchControls.classList.remove('kb-screen-hidden');
    }
  }

  if (targetEl) {
    targetEl.style.display = (state === UIState.GAME) ? 'block' : 'flex';
    targetEl.classList.remove('kb-screen-hidden');
  }
}

/* ---------------- COSMETICS REGISTRY & EQUIPMENT SYSTEM (PHASE 6.5) ---------------- */
const CosmeticsRegistry = {
  skins: [
    { id: 'default', name: 'Default Neon', icon: '🎨', colorHex: null, reqLvl: 1, rarity: 'COMMON', desc: 'Factory standard high-contrast neon coat.' },
    { id: 'cyber', name: 'Cyber Chrome', icon: '⚡', colorHex: 0x00f3ff, reqLvl: 2, rarity: 'RARE', desc: 'Electrified chrome plating with cyan glowing accents.' },
    { id: 'gold', name: 'Golden Champion', icon: '✨', colorHex: 0xffd700, reqLvl: 4, rarity: 'LEGENDARY', desc: 'Pure 24K gold finish awarded to elite brawlers.' },
    { id: 'flame', name: 'Flame Burst', icon: '🔥', colorHex: 0xff3d00, reqLvl: 3, rarity: 'EPIC', desc: 'Thermal volcanic orange coat with heat vents.' },
    { id: 'stealth', name: 'Stealth Matte', icon: '🕶️', colorHex: 0x111115, reqLvl: 5, rarity: 'LEGENDARY', desc: 'Ultra-low radar matte shadow coating.' }
  ],
  wheels: [
    { id: 'standard', name: 'Standard Racing', icon: '🛞', reqLvl: 1, rarity: 'COMMON', desc: 'High-grip arcade slick tires.' },
    { id: 'neon', name: 'Neon Glow Discs', icon: '💿', reqLvl: 2, rarity: 'RARE', desc: 'Luminescent rim covers.' },
    { id: 'chrome', name: 'Chrome Spoke', icon: '⚙️', reqLvl: 3, rarity: 'EPIC', desc: 'Reinforced titanium alloy spokes.' },
    { id: 'offroad', name: 'Offroad Tread', icon: '🏔️', reqLvl: 4, rarity: 'LEGENDARY', desc: 'Heavy-duty spiked arena tires.' }
  ],
  trails: [
    { id: 'default', name: 'Standard Exhaust', icon: '💨', reqLvl: 1, rarity: 'COMMON', desc: 'Clean twin turbo exhaust puff.' },
    { id: 'flame', name: 'Flame Exhaust', icon: '🔥', reqLvl: 2, rarity: 'RARE', desc: 'Thermal boost flame trail.' },
    { id: 'rainbow', name: 'Rainbow Sparks', icon: '🌈', reqLvl: 4, rarity: 'EPIC', desc: 'Multi-spectrum energy discharge.' },
    { id: 'galaxy', name: 'Galaxy Aura', icon: '🌌', reqLvl: 6, rarity: 'LEGENDARY', desc: 'Cosmic star particle cloud.' },
    { id: 'gold', name: 'Gold Sparkles', icon: '✨', reqLvl: 8, rarity: 'LEGENDARY', desc: 'Golden stardust trail.' }
  ],
  emotes: [
    { id: 'default', name: 'Wave', icon: '👋', text: '👋 WAVE!', reqLvl: 1, rarity: 'COMMON', desc: 'Friendly arena greeting.' },
    { id: 'taunt', name: 'Nitro Taunt', icon: '🔥', text: '🔥 EAT MY DUST!', reqLvl: 2, rarity: 'RARE', desc: 'High-octane challenge.' },
    { id: 'victory', name: 'Victory Cheer', icon: '🏆', text: '🏆 VICTORY IS MINE!', reqLvl: 4, rarity: 'EPIC', desc: 'Royal champion flex.' },
    { id: 'gg', name: 'Good Game', icon: '💬', text: '💬 GOOD GAME!', reqLvl: 1, rarity: 'COMMON', desc: 'Sportsmanship salute.' },
    { id: 'flex', name: 'Heavy Flex', icon: '💪', text: '💪 CAN\'T STOP THIS!', reqLvl: 3, rarity: 'RARE', desc: 'Armored dominance display.' }
  ]
};

const EquipmentSystem = {
  KEYS: {
    character: 'kb_equipped_character',
    kartClass: 'kb_equipped_kart_class',
    skin: 'kb_equipped_skin',
    wheels: 'kb_equipped_wheels',
    trail: 'kb_equipped_trail',
    emote: 'kb_equipped_emote'
  },
  getEquipped() {
    return {
      characterId: localStorage.getItem(this.KEYS.character) || 'racer',
      kartClassKey: localStorage.getItem(this.KEYS.kartClass) || 'tank',
      skinId: localStorage.getItem(this.KEYS.skin) || 'default',
      wheelsId: localStorage.getItem(this.KEYS.wheels) || 'standard',
      trailId: localStorage.getItem(this.KEYS.trail) || 'default',
      emoteId: localStorage.getItem(this.KEYS.emote) || 'default'
    };
  },
  equipItem(category, itemId) {
    if (category === 'character') {
      localStorage.setItem(this.KEYS.character, itemId);
      localStorage.setItem('kb_selected_character', itemId);
    } else if (category === 'kartClass') {
      localStorage.setItem(this.KEYS.kartClass, itemId);
      selectedKartClass = itemId;
    } else if (category === 'skin') {
      localStorage.setItem(this.KEYS.skin, itemId);
    } else if (category === 'wheels') {
      localStorage.setItem(this.KEYS.wheels, itemId);
    } else if (category === 'trail') {
      localStorage.setItem(this.KEYS.trail, itemId);
      ProgressionSystem.data.selectedTrail = itemId;
      ProgressionSystem.save();
    } else if (category === 'emote') {
      localStorage.setItem(this.KEYS.emote, itemId);
      ProgressionSystem.data.selectedEmote = itemId;
      ProgressionSystem.save();
    }
  },
  isEquipped(category, itemId) {
    const eq = this.getEquipped();
    if (category === 'character') return eq.characterId === itemId;
    if (category === 'kartClass') return eq.kartClassKey === itemId;
    if (category === 'skin') return eq.skinId === itemId;
    if (category === 'wheels') return eq.wheelsId === itemId;
    if (category === 'trail') return eq.trailId === itemId;
    if (category === 'emote') return eq.emoteId === itemId;
    return false;
  }
};

/* ---------------- GARAGE 3D STAGE & COMBINED TURNTABLE ---------------- */
let garageRenderer = null;
let garageScene = null;
let garageCamera = null;
let garageStageGroup = null;
let garageSpotlight = null;
let isGarageDragging = false;
let previousGarageMouseX = 0;

let previewState = {
  tab: 'characters',
  characterId: 'racer',
  kartClassKey: 'tank',
  skinId: 'default',
  wheelsId: 'standard',
  trailId: 'default',
  emoteId: 'default',
  selectedItem: null,
  selectedCategory: 'character'
};

function initGarageStagePreview() {
  const container = document.getElementById('garagePreviewStage');
  if (!container || garageRenderer) return;

  const width = container.clientWidth || 340;
  const height = container.clientHeight || 340;

  garageScene = new THREE.Scene();
  garageCamera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
  garageCamera.position.set(0, 1.4, 3.8);
  garageCamera.lookAt(0, 0.45, 0);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
  garageScene.add(ambientLight);

  garageSpotlight = new THREE.SpotLight(0x00f3ff, 2.5);
  garageSpotlight.position.set(2, 5, 4);
  garageSpotlight.angle = Math.PI / 4;
  garageSpotlight.penumbra = 0.5;
  garageScene.add(garageSpotlight);

  garageStageGroup = new THREE.Group();
  garageScene.add(garageStageGroup);

  garageRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  garageRenderer.setSize(width, height);
  garageRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(garageRenderer.domElement);

  const dom = garageRenderer.domElement;
  dom.style.cursor = 'grab';
  dom.addEventListener('mousedown', (e) => {
    isGarageDragging = true;
    previousGarageMouseX = e.clientX;
    dom.style.cursor = 'grabbing';
  });
  window.addEventListener('mouseup', () => {
    isGarageDragging = false;
    if (dom) dom.style.cursor = 'grab';
  });
  window.addEventListener('mousemove', (e) => {
    if (isGarageDragging && garageStageGroup) {
      const deltaX = e.clientX - previousGarageMouseX;
      garageStageGroup.rotation.y += deltaX * 0.01;
      previousGarageMouseX = e.clientX;
    }
  });

  dom.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isGarageDragging = true;
      previousGarageMouseX = e.touches[0].clientX;
    }
  }, { passive: true });
  window.addEventListener('touchend', () => { isGarageDragging = false; });
  window.addEventListener('touchmove', (e) => {
    if (isGarageDragging && garageStageGroup && e.touches.length === 1) {
      const deltaX = e.touches[0].clientX - previousGarageMouseX;
      garageStageGroup.rotation.y += deltaX * 0.01;
      previousGarageMouseX = e.touches[0].clientX;
    }
  }, { passive: true });

  function animateGarageStage() {
    requestAnimationFrame(animateGarageStage);
    if (typeof currentUIState !== 'undefined' && currentUIState === UIState.GARAGE) {
      if (!isGarageDragging && garageStageGroup) {
        garageStageGroup.rotation.y += 0.007;
      }
      if (garageRenderer && garageScene && garageCamera) {
        garageRenderer.render(garageScene, garageCamera);
      }
    }
  }
  animateGarageStage();
}

function updateGarageCombinedPreview() {
  if (!garageScene || !garageStageGroup) return;

  while (garageStageGroup.children.length > 0) {
    garageStageGroup.remove(garageStageGroup.children[0]);
  }

  const kClass = KART_CLASSES[previewState.kartClassKey] || KART_CLASSES.tank;
  const skin = CosmeticsRegistry.skins.find(s => s.id === previewState.skinId);
  const colorHex = (skin && skin.colorHex) ? skin.colorHex : kClass.color;

  const kartMesh = makeKartMesh(colorHex, !!kClass.isGhost, previewState.characterId);
  kartMesh.scale.setScalar(0.75);
  garageStageGroup.add(kartMesh);

  if (garageSpotlight) {
    const charObj = CharacterRegistry.getCharacter(previewState.characterId);
    garageSpotlight.color.set(charObj ? charObj.accent : kClass.colorHex);
  }

  const pedestalGlow = document.getElementById('garagePedestalGlow');
  if (pedestalGlow) {
    const charObj = CharacterRegistry.getCharacter(previewState.characterId);
    const accent = charObj ? charObj.accent : kClass.colorHex;
    pedestalGlow.style.background = `radial-gradient(ellipse at center, ${accent} 0%, transparent 70%)`;
  }
}

function updateGarageDetailPanel() {
  const titleEl = document.getElementById('garageItemTitle');
  const subEl = document.getElementById('garageItemSub');
  const descEl = document.getElementById('garageItemDesc');
  const rarityBadge = document.getElementById('garageItemRarityBadge');
  const statsContainer = document.getElementById('garageKartStatsContainer');
  const unlockBox = document.getElementById('garageItemUnlockBox');
  const reqLvlVal = document.getElementById('garageReqLvlVal');
  const equipBtn = document.getElementById('btnGarageEquip');

  const item = previewState.selectedItem;
  const category = previewState.selectedCategory;
  if (!item) return;

  const currentLevel = ProgressionSystem.data.level || 1;
  const isUnlocked = currentLevel >= (item.reqLvl || 1);
  const isEquipped = EquipmentSystem.isEquipped(category, item.id || item.key);

  if (titleEl) titleEl.textContent = item.name;
  if (rarityBadge) {
    const rarity = item.rarity || 'COMMON';
    rarityBadge.textContent = rarity;
    rarityBadge.className = `kb-rarity-badge kb-rarity-${rarity.toLowerCase()}`;
  }

  if (category === 'kartClass') {
    if (subEl) subEl.textContent = `${item.abilityName ? item.abilityName.toUpperCase() : 'SPECIAL'} CLASS`;
    if (descEl) descEl.textContent = item.desc;

    if (statsContainer) {
      statsContainer.style.display = 'flex';
      
      const hpVal = document.getElementById('statHpVal');
      const hpFill = document.getElementById('statHpFill');
      if (hpVal && hpFill) {
        hpVal.textContent = `${item.maxHp} HP`;
        hpFill.style.width = `${Math.min(100, (item.maxHp / 125) * 100)}%`;
      }

      const speedVal = document.getElementById('statSpeedVal');
      const speedFill = document.getElementById('statSpeedFill');
      if (speedVal && speedFill) {
        const speedPct = Math.round(item.topSpeedMult * 100);
        speedVal.textContent = `${speedPct}%`;
        speedFill.style.width = `${Math.min(100, (item.topSpeedMult / 1.3) * 100)}%`;
      }

      const accelVal = document.getElementById('statAccelVal');
      const accelFill = document.getElementById('statAccelFill');
      if (accelVal && accelFill) {
        const accelPct = Math.round(item.accelMult * 100);
        accelVal.textContent = `${accelPct}%`;
        accelFill.style.width = `${Math.min(100, (item.accelMult / 1.8) * 100)}%`;
      }

      const knockVal = document.getElementById('statKnockVal');
      const knockFill = document.getElementById('statKnockFill');
      if (knockVal && knockFill) {
        const knockPct = Math.round(item.knockMult * 100);
        knockVal.textContent = `${knockPct}%`;
        knockFill.style.width = `${Math.min(100, (item.knockMult / 2.0) * 100)}%`;
      }
    }
  } else if (category === 'character') {
    if (subEl) subEl.textContent = `${item.style} PERSONALITY`;
    if (descEl) descEl.textContent = item.shortDescription;
    if (statsContainer) statsContainer.style.display = 'none';
  } else {
    if (subEl) subEl.textContent = `${category.toUpperCase()} ITEM`;
    if (descEl) descEl.textContent = item.desc || item.text || 'Custom cosmetic item.';
    if (statsContainer) statsContainer.style.display = 'none';
  }

  if (unlockBox && reqLvlVal) {
    if (!isUnlocked) {
      unlockBox.style.display = 'block';
      reqLvlVal.textContent = item.reqLvl;
    } else {
      unlockBox.style.display = 'none';
    }
  }

  if (equipBtn) {
    if (!isUnlocked) {
      equipBtn.disabled = true;
      equipBtn.textContent = `🔒 UNLOCKS AT LVL ${item.reqLvl}`;
    } else if (isEquipped) {
      equipBtn.disabled = true;
      equipBtn.textContent = '✓ EQUIPPED';
    } else {
      equipBtn.disabled = false;
      equipBtn.textContent = `EQUIP ${item.name.toUpperCase()} 🚀`;
    }
  }
}

function renderGarageUI() {
  const lvlEl = document.getElementById('garageLvl');
  const xpEl = document.getElementById('garageXp');
  if (lvlEl) lvlEl.textContent = ProgressionSystem.data.level;
  if (xpEl) xpEl.textContent = `${ProgressionSystem.data.xp}/${ProgressionSystem.getXpForLevel(ProgressionSystem.data.level)}`;

  const equipped = EquipmentSystem.getEquipped();
  if (!previewState.selectedItem) {
    previewState.characterId = equipped.characterId;
    previewState.kartClassKey = equipped.kartClassKey;
    previewState.skinId = equipped.skinId;
    previewState.wheelsId = equipped.wheelsId;
    previewState.trailId = equipped.trailId;
    previewState.emoteId = equipped.emoteId;
  }

  initGarageStagePreview();

  const rosterGrid = document.getElementById('garageNavRosterGrid');
  if (!rosterGrid) return;

  const currentLevel = ProgressionSystem.data.level || 1;
  const tab = previewState.tab;

  let items = [];
  let currentCategory = 'character';

  if (tab === 'characters') {
    currentCategory = 'character';
    items = CharacterRegistry.characters.map(c => ({ ...c, category: 'character' }));
  } else if (tab === 'karts') {
    currentCategory = 'kartClass';
    items = Object.values(KART_CLASSES).map(k => ({ ...k, category: 'kartClass', id: k.key, portrait: k.icon, rarity: 'EPIC' }));
  } else if (tab === 'cosmetics') {
    currentCategory = 'skin';
    items = CosmeticsRegistry.skins.map(s => ({ ...s, category: 'skin', portrait: s.icon }))
      .concat(CosmeticsRegistry.wheels.map(w => ({ ...w, category: 'wheels', portrait: w.icon })))
      .concat(CosmeticsRegistry.trails.map(t => ({ ...t, category: 'trail', portrait: t.icon })));
  } else if (tab === 'emotes') {
    currentCategory = 'emote';
    items = CosmeticsRegistry.emotes.map(e => ({ ...e, category: 'emote', portrait: e.icon }));
  }

  if (!previewState.selectedItem || previewState.tabChanged) {
    previewState.selectedItem = items[0];
    previewState.selectedCategory = items[0].category;
    previewState.tabChanged = false;
  }

  rosterGrid.innerHTML = items.map(item => {
    const isUnlocked = currentLevel >= (item.reqLvl || 1);
    const itemCat = item.category;
    const isEquipped = EquipmentSystem.isEquipped(itemCat, item.id || item.key);
    const isSelected = previewState.selectedItem && (previewState.selectedItem.id === item.id) && (previewState.selectedCategory === itemCat);
    const rarityClass = `kb-rarity-${(item.rarity || 'COMMON').toLowerCase()}`;

    return `
      <div class="kb-char-card ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}" data-item-id="${item.id}" data-item-cat="${itemCat}">
        <div class="kb-char-card-portrait" style="border-color: ${item.accent || '#00f3ff'};">
          ${isUnlocked ? item.portrait : '🔒'}
        </div>
        <div class="kb-char-card-info">
          <div class="kb-char-card-name">${item.name} ${isEquipped ? '✓' : ''}</div>
          <div class="kb-char-card-style">${isEquipped ? 'EQUIPPED' : (isUnlocked ? 'UNLOCKED' : `LVL ${item.reqLvl}`)}</div>
          <div class="kb-rarity-badge ${rarityClass}">${item.rarity || 'COMMON'}</div>
        </div>
      </div>
    `;
  }).join('');

  rosterGrid.querySelectorAll('.kb-char-card').forEach(card => {
    card.addEventListener('click', () => {
      const itemId = card.getAttribute('data-item-id');
      const itemCat = card.getAttribute('data-item-cat');
      const targetItem = items.find(i => i.id === itemId && i.category === itemCat);
      if (!targetItem) return;

      previewState.selectedItem = targetItem;
      previewState.selectedCategory = itemCat;

      if (itemCat === 'character') previewState.characterId = itemId;
      else if (itemCat === 'kartClass') previewState.kartClassKey = itemId;
      else if (itemCat === 'skin') previewState.skinId = itemId;

      renderGarageUI();
      updateGarageCombinedPreview();
      updateGarageDetailPanel();
    });
  });

  updateGarageCombinedPreview();
  updateGarageDetailPanel();
}

function openGarage(){
  setUIState(UIState.GARAGE);
}

function closeGarage(){
  const modal = document.getElementById('garageModal');
  if(modal) modal.style.display = 'none';
  if(currentUIState === UIState.GARAGE){
    setUIState(UIState.MAIN_MENU);
  }
}

const endGarageBtn = document.getElementById('endGarageBtn');
if(endGarageBtn) endGarageBtn.addEventListener('click', openGarage);

const garageCloseBtn = document.getElementById('garageCloseBtn');
if(garageCloseBtn) garageCloseBtn.addEventListener('click', closeGarage);

const btnGarageEquip = document.getElementById('btnGarageEquip');
if (btnGarageEquip) {
  btnGarageEquip.addEventListener('click', () => {
    if (!previewState.selectedItem) return;
    const cat = previewState.selectedCategory;
    const id = previewState.selectedItem.id || previewState.selectedItem.key;
    EquipmentSystem.equipItem(cat, id);
    if (typeof SoundFX !== 'undefined' && SoundFX.playUIClick) SoundFX.playUIClick();
    renderGarageUI();
  });
}

document.querySelectorAll('.kb-garage-tab-btn').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.kb-garage-tab-btn').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    previewState.tab = tab.getAttribute('data-gtab');
    previewState.tabChanged = true;
    renderGarageUI();
  });
});

/* ---------------- MULTIPLAYER & MENU EVENT BINDINGS (STEP 2.2) ---------------- */
const btnOnline = document.getElementById('btnOnline');
if (btnOnline) btnOnline.addEventListener('click', () => setUIState(UIState.ONLINE_MENU));

const btnCreateRoom = document.getElementById('btnCreateRoom');
if (btnCreateRoom) btnCreateRoom.addEventListener('click', () => {
  const name = getPlayerName();
  localStorage.setItem('kb_player_name', name);
  if (socket && socket.connected) {
    socket.emit('createRoom', { displayName: name, characterId: CharacterRegistry.getSelectedCharacterId() });
  } else {
    showJoinError('❌ Server offline. Unable to create room.');
  }
});

const btnJoinRoom = document.getElementById('btnJoinRoom');
if (btnJoinRoom) btnJoinRoom.addEventListener('click', () => setUIState(UIState.JOIN_ROOM));

const btnJoinSubmit = document.getElementById('btnJoinSubmit');
if (btnJoinSubmit) btnJoinSubmit.addEventListener('click', () => {
  clearJoinError();
  const input = document.getElementById('joinCodeInput');
  const code = input ? input.value.trim().toUpperCase() : '';
  if (!code || code.length !== 6) {
    showJoinError('❌ Please enter a valid 6-character room code.');
    return;
  }
  const name = getPlayerName();
  localStorage.setItem('kb_player_name', name);
  if (socket && socket.connected) {
    socket.emit('joinRoom', { roomId: code, displayName: name, characterId: CharacterRegistry.getSelectedCharacterId() });
  } else {
    showJoinError('❌ Server offline. Unable to connect to server.');
  }
});

/* ---------------- CHARACTER SELECTION NAVIGATION (PHASE 6.3) ---------------- */
const btnGarageCharSelect = document.getElementById('btnGarageCharSelect');
if (btnGarageCharSelect) btnGarageCharSelect.addEventListener('click', () => setUIState(UIState.CHARACTER_SELECT));

const btnCharSelectBack = document.getElementById('btnCharSelectBack');
if (btnCharSelectBack) btnCharSelectBack.addEventListener('click', () => setUIState(UIState.GARAGE));

const btnConfirmCharacter = document.getElementById('btnConfirmCharacter');
if (btnConfirmCharacter) btnConfirmCharacter.addEventListener('click', () => {
  const charObj = CharacterRegistry.getCharacter(selectedCharTempId);
  const currentLevel = ProgressionSystem.data.level || 1;
  if (charObj && currentLevel >= charObj.reqLvl) {
    CharacterRegistry.setSelectedCharacterId(charObj.id);
    setUIState(UIState.GARAGE);
  }
});

const btnCopyCode = document.getElementById('btnCopyCode');
if (btnCopyCode) btnCopyCode.addEventListener('click', () => copyRoomCode(currentRoomId, 'copyBtnText'));

const btnLobbyReady = document.getElementById('btnLobbyReady');
if (btnLobbyReady) btnLobbyReady.addEventListener('click', () => {
  if (socket && socket.connected && !isReadyRequestInFlight) {
    isReadyRequestInFlight = true;
    socket.emit('playerReady', { ready: !isMyPlayerReady });
  }
});

const btnLobbyStartMatch = document.getElementById('btnLobbyStartMatch');
if (btnLobbyStartMatch) btnLobbyStartMatch.addEventListener('click', () => {
  if (socket && socket.connected && isRoomHost && !isStartRequestInFlight) {
    if (!isMyPlayerReady) {
      showLobbyNotice('❌ Host must be READY before starting the match!', true);
      return;
    }
    isStartRequestInFlight = true;
    socket.emit('startMatch');
  }
});

const btnReturnToLobby = document.getElementById('btnReturnToLobby');
if (btnReturnToLobby) btnReturnToLobby.addEventListener('click', () => {
  setUIState(UIState.MULTIPLAYER_LOBBY);
});

const btnResultsLeave = document.getElementById('btnResultsLeave');
if (btnResultsLeave) btnResultsLeave.addEventListener('click', () => {
  if (socket) socket.emit('leaveRoom');
  clearRoomClientState();
  setUIState(UIState.ONLINE_MENU);
});

const btnLobbyLeave = document.getElementById('btnLobbyLeave');
if (btnLobbyLeave) btnLobbyLeave.addEventListener('click', () => {
  if (socket) socket.emit('leaveRoom');
  setUIState(UIState.ONLINE_MENU);
});

const btnCreateRoomBack = document.getElementById('btnCreateRoomBack');
if (btnCreateRoomBack) btnCreateRoomBack.addEventListener('click', () => {
  if (socket) socket.emit('leaveRoom');
  setUIState(UIState.ONLINE_MENU);
});

const btnJoinBack = document.getElementById('btnJoinBack');
if (btnJoinBack) btnJoinBack.addEventListener('click', () => setUIState(UIState.ONLINE_MENU));

const playerNameInput = document.getElementById('playerNameInput');
if (playerNameInput) playerNameInput.addEventListener('change', (e) => {
  localStorage.setItem('kb_player_name', e.target.value.trim());
});

const cardOnline = document.getElementById('cardOnline');
if (cardOnline) cardOnline.addEventListener('click', () => setUIState(UIState.ONLINE_MENU));

const cardSolo = document.getElementById('cardSolo');
if (cardSolo) cardSolo.addEventListener('click', () => setUIState(UIState.SOLO_SELECT));

const btnSolo = document.getElementById('btnSolo');
if (btnSolo) btnSolo.addEventListener('click', (e) => { e.stopPropagation(); setUIState(UIState.SOLO_SELECT); });

const btnGarage = document.getElementById('btnGarage');
if (btnGarage) btnGarage.addEventListener('click', () => setUIState(UIState.GARAGE));

const btnSettings = document.getElementById('btnSettings');
if (btnSettings) btnSettings.addEventListener('click', () => setUIState(UIState.SETTINGS));

// Back Buttons
const btnOnlineBack = document.getElementById('btnOnlineBack');
if (btnOnlineBack) btnOnlineBack.addEventListener('click', () => setUIState(UIState.MAIN_MENU));

const btnSoloBack = document.getElementById('btnSoloBack');
if (btnSoloBack) btnSoloBack.addEventListener('click', () => setUIState(UIState.MAIN_MENU));

const btnSettingsBack = document.getElementById('btnSettingsBack');
if (btnSettingsBack) btnSettingsBack.addEventListener('click', () => setUIState(UIState.MAIN_MENU));

// Start Solo Game
const startSoloBtn = document.getElementById('startSoloBtn');
if (startSoloBtn) startSoloBtn.addEventListener('click', () => {
  initSoloGame();
});

// Settings Toggles & Persistence
const toggleAudio = document.getElementById('toggleAudio');
if (toggleAudio) toggleAudio.addEventListener('click', () => {
  toggleAudio.classList.toggle('active');
  toggleAudio.textContent = toggleAudio.classList.contains('active') ? 'ENABLED' : 'DISABLED';
  SoundFX.updateVolumes();
  try { localStorage.setItem('kb_audio', toggleAudio.textContent); } catch(e){}
});

const toggleSfx = document.getElementById('toggleSfx');
if (toggleSfx) toggleSfx.addEventListener('click', () => {
  toggleSfx.classList.toggle('active');
  toggleSfx.textContent = toggleSfx.classList.contains('active') ? 'ENABLED' : 'DISABLED';
  SoundFX.updateVolumes();
  try { localStorage.setItem('kb_sfx', toggleSfx.textContent); } catch(e){}
});

const toggleMusic = document.getElementById('toggleMusic');
if (toggleMusic) toggleMusic.addEventListener('click', () => {
  toggleMusic.classList.toggle('active');
  toggleMusic.textContent = toggleMusic.classList.contains('active') ? 'ENABLED' : 'DISABLED';
  SoundFX.updateVolumes();
  if (toggleMusic.textContent === 'ENABLED') SoundFX.startMusic();
  else SoundFX.stopMusic();
  try { localStorage.setItem('kb_music', toggleMusic.textContent); } catch(e){}
});

const toggleHaptics = document.getElementById('toggleHaptics');
if (toggleHaptics) toggleHaptics.addEventListener('click', () => {
  toggleHaptics.classList.toggle('active');
  toggleHaptics.textContent = toggleHaptics.classList.contains('active') ? 'ENABLED' : 'DISABLED';
  try { localStorage.setItem('kb_haptics', toggleHaptics.textContent); } catch(e){}
});

const toggleCamShake = document.getElementById('toggleCamShake');
if (toggleCamShake) toggleCamShake.addEventListener('click', () => {
  toggleCamShake.classList.toggle('active');
  toggleCamShake.textContent = toggleCamShake.classList.contains('active') ? 'ENABLED' : 'DISABLED';
  try { localStorage.setItem('kb_camShake', toggleCamShake.textContent); } catch(e){}
});

// Load saved settings
['Audio', 'Sfx', 'Music', 'Haptics', 'CamShake'].forEach(key => {
  const el = document.getElementById('toggle' + key);
  try {
    const saved = localStorage.getItem('kb_' + key.toLowerCase());
    if (el && saved) {
      if (saved === 'DISABLED') {
        el.classList.remove('active');
        el.textContent = 'DISABLED';
      } else {
        el.classList.add('active');
        el.textContent = 'ENABLED';
      }
    }
  } catch(e){}
});

// Universal UI Click Sounds & Mobile Audio Unlock
document.querySelectorAll('button, .menu-btn, .toggle-btn, .kart-select-card').forEach(btn => {
  btn.addEventListener('click', () => SoundFX.playUIClick());
});

['click', 'keydown', 'touchstart'].forEach(evt => {
  window.addEventListener(evt, () => {
    SoundFX.init();
  }, { once: false, passive: true });
});

// Initialize Main Menu State on Load
setUIState(UIState.MAIN_MENU);

})();
