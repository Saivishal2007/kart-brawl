const SPAWN_POSITIONS = [
  { x: 0, z: 28, yaw: Math.PI },
  { x: 0, z: -28, yaw: 0 },
  { x: 28, z: 0, yaw: -Math.PI / 2 },
  { x: -28, z: 0, yaw: Math.PI / 2 },
  { x: 20, z: 20, yaw: -Math.PI * 3 / 4 },
  { x: -20, z: -20, yaw: Math.PI / 4 }
];

const WEAPONS = {
  pea:   { name: 'BULLET BLASTER', dmg: 8,  speed: 52, cooldown: 0.22, ammo: Infinity, splash: 0,   knock: 3.5, size: 0.25 },
  rocket:{ name: 'ROCKET',      dmg: 35, speed: 38, cooldown: 0.65, ammo: 4,        splash: 7.2, knock: 16,  size: 0.50 },
  triple:{ name: 'TRIPLE SHOT', dmg: 10, speed: 46, cooldown: 0.26, ammo: 12,       splash: 0,   knock: 5.5, size: 0.28 },
  mine:  { name: 'MINE',        dmg: 40, speed: 0,  cooldown: 0.60, ammo: 3,        splash: 6.2, knock: 18,  size: 0.58 }
};

const POWERUP_SPAWNS = [
  { id: 0, x: 16, z: 16 },
  { id: 1, x: -16, z: 16 },
  { id: 2, x: 16, z: -16 },
  { id: 3, x: -16, z: -16 },
  { id: 4, x: 32, z: 0 },
  { id: 5, x: -32, z: 0 },
  { id: 6, x: 0, z: 32 },
  { id: 7, x: 0, z: -32 }
];

const POWERUP_TYPES = ['rocket', 'triple', 'mine', 'nitro', 'shield'];

const ARENA_RAMP_DEFS = [
  { x: -40, z: 0, yaw: 0, width: 12, length: 16, maxHeight: 3.8 },
  { x: 40, z: 0, yaw: Math.PI, width: 12, length: 16, maxHeight: 3.8 },
  { x: 0, z: -40, yaw: Math.PI / 2, width: 12, length: 16, maxHeight: 3.8 },
  { x: 0, z: 40, yaw: -Math.PI / 2, width: 12, length: 16, maxHeight: 3.8 }
];

const ARENA_OBSTACLE_DEFS = [];
for (let i = 0; i < 16; i++) {
  const ang = (i / 16) * Math.PI * 2 + Math.PI / 16;
  const r = 50 + ((i * 7 + 3) % 9) * 2.2;
  const x = Math.round(Math.cos(ang) * r * 10) / 10;
  const z = Math.round(Math.sin(ang) * r * 10) / 10;
  const isBox = (i % 2 === 0);
  const yaw = ((i * 3 + 1) % 8) * (Math.PI / 4);
  ARENA_OBSTACLE_DEFS.push({
    type: isBox ? 'box' : 'cylinder',
    x, z, yaw,
    halfX: 1.3, halfZ: 1.3,
    radius: 1.2,
    height: isBox ? 2.6 : 2.0
  });
}

const TICK_RATE = 30; // 30Hz simulation rate
const DT = 1 / TICK_RATE;

class GameRoom {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.io = io;
    this.players = {};
    this.projectiles = [];
    this.mines = [];
    this.assignedSpawns = new Array(SPAWN_POSITIONS.length).fill(false);
    this.maximumPlayers = 6;
    this.status = 'WAITING'; // 'WAITING', 'COUNTDOWN', 'PLAYING', 'FINISHED'
    this.hostId = null;
    this.createdAt = Date.now();
    this.tickInterval = null;

    // Step 6: Powerups, Storm, Match State & Arena Events
    this.powerups = POWERUP_SPAWNS.map(s => ({
      id: s.id,
      x: s.x,
      y: 1.0,
      z: s.z,
      active: true,
      type: POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)],
      respawnTimer: 0
    }));

    this.storm = {
      radius: 72.0,
      minRadius: 15.0,
      duration: 120.0,
      damageTimer: 0
    };

    this.matchTime = 120.0;
    this.countdownTimer = 3.0;
    this.eventTimer = 25.0;
    this.activeEvent = null;
    this.activeEventTimer = 0;
    this.meteorTimer = 0;
    this.tornadoPos = { x: 0, z: 0, angle: 0 };

    this.startTickLoop();
  }

  getAvailableSpawnIndex() {
    for (let i = 0; i < SPAWN_POSITIONS.length; i++) {
      if (!this.assignedSpawns[i]) return i;
    }
    return 0;
  }

  addPlayer(socket, displayName, characterId) {
    if (Object.keys(this.players).length >= this.maximumPlayers) {
      return { success: false, reason: 'roomFull' };
    }

    const spawnIndex = this.getAvailableSpawnIndex();
    this.assignedSpawns[spawnIndex] = true;
    const spawn = SPAWN_POSITIONS[spawnIndex];

    if (!this.hostId) {
      this.hostId = socket.id;
    }

    const isHost = socket.id === this.hostId;
    const defaultName = displayName || `Player ${Object.keys(this.players).length + 1}`;
    const charId = characterId || 'racer';

    const player = {
      id: socket.id,
      displayName: defaultName,
      characterId: charId,
      isHost: isHost,
      ready: false,
      alive: true,
      x: spawn.x,
      y: 0,
      z: spawn.z,
      yaw: spawn.yaw,
      speed: 0,
      verticalVelocity: 0,
      grounded: true,
      nitroActive: false,
      nitroTimer: 0,
      spawnIndex: spawnIndex,

      // Combat State
      hp: 100,
      maxHp: 100,
      weapon: 'pea',
      ammo: Infinity,
      cooldownT: 0,
      shieldT: 0,
      kills: 0,
      deaths: 0,
      damageDealt: 0,
      storedPowerup: null,
      heldPowerup: null,
      knockVel: { x: 0, z: 0 },
      respawnTimer: 0,

      inputs: {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        nitro: false
      }
    };

    this.players[socket.id] = player;
    socket.join(this.roomId);

    console.log(`[Room ${this.roomId}] Player ${socket.id} (${defaultName}, ${charId}) joined (${Object.keys(this.players).length}/${this.maximumPlayers})`);

    this.broadcastRoomState();
    socket.to(this.roomId).emit('playerJoined', { id: socket.id, displayName: defaultName, characterId: charId, x: spawn.x, y: 0, z: spawn.z, yaw: spawn.yaw });

    return { success: true, player, spawn };
  }

  removePlayer(socketId, socket) {
    if (!this.players[socketId]) return;

    const p = this.players[socketId];
    if (p.spawnIndex >= 0 && p.spawnIndex < this.assignedSpawns.length) {
      this.assignedSpawns[p.spawnIndex] = false;
    }

    delete this.players[socketId];
    if (socket) socket.leave(this.roomId);

    console.log(`[Room ${this.roomId}] Player ${socketId} left (${Object.keys(this.players).length}/${this.maximumPlayers})`);

    const remainingIds = Object.keys(this.players);
    if (this.hostId === socketId && remainingIds.length > 0) {
      this.hostId = remainingIds[0];
      this.players[this.hostId].isHost = true;
      console.log(`[Room ${this.roomId}] Host transferred to ${this.hostId}`);
      this.io.to(this.roomId).emit('hostChanged', { newHostId: this.hostId });
    }

    if (this.status === 'COUNTDOWN' && remainingIds.length < 2) {
      this.status = 'WAITING';
      this.countdownTimer = 3.0;
      console.log(`[Room ${this.roomId}] Countdown cancelled: Not enough players remaining (${remainingIds.length}).`);
      this.io.to(this.roomId).emit('matchStateChanged', { status: 'WAITING' });
    }

    if (remainingIds.length === 0) {
      this.stopTickLoop();
    } else {
      this.io.to(this.roomId).emit('playerLeft', { id: socketId });
      this.broadcastRoomState();
    }
  }

  setPlayerReady(socketId, ready) {
    if (this.players[socketId]) {
      this.players[socketId].ready = !!ready;
      this.broadcastRoomState();
    }
  }

  startMatch(requestedBySocketId) {
    if (requestedBySocketId && requestedBySocketId !== this.hostId) {
      console.log(`[Room ${this.roomId}] Start match denied for non-host ${requestedBySocketId}`);
      return false;
    }

    if (this.status !== 'WAITING' && this.status !== 'FINISHED') return false;

    const playerList = Object.values(this.players);
    if (playerList.length < 2) {
      console.log(`[Room ${this.roomId}] Start match denied: Need at least 2 connected players (currently ${playerList.length}).`);
      return false;
    }

    const allReady = playerList.every(p => p.ready);
    if (!allReady) {
      console.log(`[Room ${this.roomId}] Start match denied: Not all players are ready.`);
      return false;
    }

    this.status = 'COUNTDOWN';
    this.countdownTimer = 3.0;

    console.log(`[Room ${this.roomId}] Match countdown initiated by host.`);
    this.io.to(this.roomId).emit('matchStateChanged', { status: 'COUNTDOWN', countdown: 3 });
    this.broadcastRoomState();
    return true;
  }

  handlePlayerInput(socketId, inputData) {
    if (this.players[socketId]) {
      this.players[socketId].inputs = Object.assign(this.players[socketId].inputs, inputData);
    }
  }

  // --- Authoritative Combat System: Weapon Firing Handler ---
  handleFireWeapon(socketId, payload = {}) {
    const p = this.players[socketId];
    if (!p || !p.alive || p.cooldownT > 0 || this.status !== 'PLAYING') return;

    let activeWeapon = payload.weapon || p.weapon;
    if (!WEAPONS[activeWeapon]) activeWeapon = 'pea';

    const def = WEAPONS[activeWeapon];

    // Validate Ammo
    if (activeWeapon !== 'pea' && p.ammo <= 0) {
      p.weapon = 'pea';
      p.ammo = Infinity;
      p.heldPowerup = null;
      activeWeapon = 'pea';
    }

    // Overcharge event modifier
    const cdMult = (this.activeEvent && this.activeEvent.type === 'overcharge') ? 0.5 : 1.0;
    p.cooldownT = WEAPONS[activeWeapon].cooldown * cdMult;

    if (activeWeapon !== 'pea' && !(this.activeEvent && this.activeEvent.type === 'overcharge')) {
      p.ammo--;
    }
    if (p.heldPowerup && p.heldPowerup.isWeapon) {
      p.heldPowerup.ammo = p.ammo;
    }

    const fwdX = Math.sin(p.yaw);
    const fwdZ = Math.cos(p.yaw);
    const spawnX = p.x + fwdX * 1.6;
    const spawnZ = p.z + fwdZ * 1.6;

    // Golden rush event damage multiplier
    const dmgMult = (this.activeEvent && this.activeEvent.type === 'goldenrush') ? 2.0 : 1.0;

    if (activeWeapon === 'mine') {
      const mineObj = {
        id: `mine_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        ownerId: socketId,
        ownerName: p.displayName,
        x: p.x - fwdX * 1.6,
        z: p.z - fwdZ * 1.6,
        dmg: def.dmg * dmgMult,
        splash: def.splash,
        knock: def.knock,
        armT: 0.6,
        life: 22.0
      };
      this.mines.push(mineObj);
      this.io.to(this.roomId).emit('mineCreated', mineObj);
    } else if (activeWeapon === 'triple') {
      const angles = [-0.3, 0, 0.3];
      angles.forEach(off => {
        const cos = Math.cos(off), sin = Math.sin(off);
        const dirX = fwdX * cos + fwdZ * sin;
        const dirZ = -fwdX * sin + fwdZ * cos;

        const proj = {
          id: `proj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          ownerId: socketId,
          ownerName: p.displayName,
          type: 'triple',
          x: spawnX,
          z: spawnZ,
          velX: dirX * def.speed,
          velZ: dirZ * def.speed,
          dmg: def.dmg * dmgMult,
          splash: def.splash,
          knock: def.knock,
          size: def.size,
          life: 2.4
        };
        this.projectiles.push(proj);
      });
    } else {
      // Pea or Rocket
      const proj = {
        id: `proj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        ownerId: socketId,
        ownerName: p.displayName,
        type: activeWeapon,
        x: spawnX,
        z: spawnZ,
        velX: fwdX * def.speed,
        velZ: fwdZ * def.speed,
        dmg: def.dmg * dmgMult,
        splash: def.splash,
        knock: def.knock,
        size: def.size,
        life: 2.4
      };
      this.projectiles.push(proj);
    }

    this.io.to(this.roomId).emit('weaponFired', {
      ownerId: socketId,
      ownerName: p.displayName,
      weapon: activeWeapon,
      ammo: p.ammo,
      x: spawnX,
      z: spawnZ,
      yaw: p.yaw
    });

    if (activeWeapon !== 'pea' && p.ammo <= 0) {
      p.weapon = 'pea';
      p.ammo = Infinity;
      p.heldPowerup = null; // Completely consumed! Slot is now EMPTY!
    }
  }

  // --- Authoritative Damage & Knockback Application ---
  applyDamage(target, dmg, knockDir, knockMag, attackerId) {
    if (!target || !target.alive || target.shieldT > 0) return;

    let attackerName = 'The Void';
    if (attackerId === 'STORM') {
      attackerName = 'The Storm';
    } else if (attackerId === 'METEOR') {
      attackerName = 'Meteor Impact';
    } else {
      const attacker = this.players[attackerId];
      if (attacker) {
        attackerName = attacker.displayName;
        attacker.damageDealt = (attacker.damageDealt || 0) + Math.min(dmg, target.hp);
      }
    }

    target.hp = Math.max(0, target.hp - dmg);

    if (knockDir && knockMag > 0) {
      target.knockVel.x += knockDir.x * knockMag * 0.7;
      target.knockVel.z += knockDir.z * knockMag * 0.7;
    }

    this.io.to(this.roomId).emit('playerDamaged', {
      targetId: target.id,
      hp: target.hp,
      maxHp: target.maxHp,
      dmg: dmg,
      attackerId: attackerId,
      attackerName: attackerName
    });

    if (target.hp <= 0) {
      target.alive = false;
      target.respawnTimer = 3.0;
      if (target.spawnIndex >= 0 && target.spawnIndex < this.assignedSpawns.length) {
        this.assignedSpawns[target.spawnIndex] = false;
      }

      const attacker = this.players[attackerId];
      if (attacker && attacker.id !== target.id) {
        attacker.kills++;
      }
      target.deaths++;

      console.log(`[Room ${this.roomId}] Player ${target.id} eliminated by ${attackerName}`);

      this.io.to(this.roomId).emit('playerDied', {
        targetId: target.id,
        targetName: target.displayName,
        killerId: attackerId,
        killerName: attackerName,
        respawnTime: 3.0
      });

      this.broadcastRoomState();
    }
  }

  getRoomStatePayload() {
    return {
      roomId: this.roomId,
      status: this.status,
      hostId: this.hostId,
      maximumPlayers: this.maximumPlayers,
      playerCount: Object.keys(this.players).length,
      matchTime: Math.ceil(this.matchTime),
      stormRadius: this.storm.radius,
      powerups: this.powerups,
      players: Object.values(this.players).map(p => ({
        id: p.id,
        displayName: p.displayName,
        characterId: p.characterId || 'racer',
        isHost: p.isHost,
        ready: p.ready,
        alive: p.alive,
        hp: p.hp,
        maxHp: p.maxHp,
        kills: p.kills,
        deaths: p.deaths,
        damageDealt: Math.round(p.damageDealt || 0),
        weapon: p.weapon,
        ammo: p.ammo,
        heldPowerup: p.heldPowerup,
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: p.yaw,
        speed: p.speed,
        nitroActive: !!p.nitroActive
      }))
    };
  }

  broadcastRoomState() {
    this.io.to(this.roomId).emit('roomState', this.getRoomStatePayload());
  }

  startTickLoop() {
    if (this.tickInterval) return;

    this.perfStats = {
      tickCount: 0,
      totalDuration: 0,
      maxDuration: 0
    };
    this.recentTickDurations = [];
    this.lastPayloadBytes = 0;

    this.tickInterval = setInterval(() => {
      const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());

      // ----------------------------------------------------
      // A. MATCH STATE MACHINE UPDATES
      // ----------------------------------------------------
      if (this.status === 'COUNTDOWN') {
        this.countdownTimer -= DT;
        this.io.to(this.roomId).emit('matchCountdown', { count: Math.ceil(this.countdownTimer) });

        if (this.countdownTimer <= 0) {
          this.status = 'PLAYING';
          this.matchTime = 120.0;
          this.eventTimer = 25.0;
          this.activeEvent = null;
          this.storm.radius = 72.0;

          // Reset all player positions & stats for match start
          Object.values(this.players).forEach((p, idx) => {
            const spawn = SPAWN_POSITIONS[idx % SPAWN_POSITIONS.length];
            p.x = spawn.x; p.y = 0; p.z = spawn.z; p.yaw = spawn.yaw;
            p.speed = 0; p.verticalVelocity = 0; p.grounded = true;
            p.hp = p.maxHp = 100; p.alive = true;
            p.kills = 0; p.deaths = 0; p.damageDealt = 0;
            p.weapon = 'pea'; p.ammo = Infinity; p.shieldT = 0;
            p.nitroTimer = 0; p.nitroActive = false; p.heldPowerup = null;
          });

          console.log(`[Room ${this.roomId}] MATCH STARTED!`);
          this.io.to(this.roomId).emit('matchStateChanged', { status: 'PLAYING', matchTime: 120 });
          this.io.to(this.roomId).emit('gameStarted', { status: 'PLAYING', matchTime: 120 });
          this.broadcastRoomState();
        }
      } else if (this.status === 'PLAYING') {
        this.matchTime = Math.max(0, this.matchTime - DT);

        // Constant Fixed Arena Radius - NO shrinking
        this.storm.radius = 72.0;

        // Out of Bounds Boundary Damage (5 HP / sec if forced past fixed boundary)
        this.storm.damageTimer += DT;
        if (this.storm.damageTimer >= 1.0) {
          this.storm.damageTimer = 0;
          for (const id in this.players) {
            const p = this.players[id];
            if (!p.alive) continue;
            const dist = Math.hypot(p.x, p.z);
            if (dist > this.storm.radius) {
              this.applyDamage(p, 5, null, 0, 'STORM');
            }
          }
        }

        // ----------------------------------------------------
        // B. POWERUP BOXES RESPRAWN & PICKUP SIMULATION
        // ----------------------------------------------------
        for (const pbox of this.powerups) {
          if (!pbox.active) {
            pbox.respawnTimer -= DT;
            if (pbox.respawnTimer <= 0) {
              pbox.active = true;
              pbox.type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
              this.io.to(this.roomId).emit('powerupRespawned', {
                id: pbox.id,
                type: pbox.type,
                x: pbox.x,
                y: pbox.y,
                z: pbox.z
              });
            }
          } else {
            // Check pickup collision with alive players
            for (const id in this.players) {
              const p = this.players[id];
              if (!p.alive) continue;

              const dist = Math.hypot(p.x - pbox.x, p.z - pbox.z);
              if (dist < 2.5) {
                // PHASE 6.13 ONE-POWERUP-AT-A-TIME RULE:
                // If player already holds a powerup, they CANNOT pick up another!
                // Box remains in arena, player existing item is never overwritten.
                const hasHeld = (p.heldPowerup !== null && p.heldPowerup !== undefined && p.heldPowerup.type !== 'pea') || (p.shieldT > 0) || (p.nitroTimer > 0);
                if (p.heldPowerup !== null && hasHeld) {
                  continue;
                }

                pbox.active = false;
                pbox.respawnTimer = 10.0; // 10 sec respawn

                if (pbox.type === 'rocket' || pbox.type === 'triple' || pbox.type === 'mine') {
                  p.weapon = pbox.type;
                  p.ammo = WEAPONS[pbox.type].ammo;
                  p.heldPowerup = {
                    type: pbox.type,
                    isWeapon: true,
                    ammo: p.ammo,
                    maxAmmo: WEAPONS[pbox.type].ammo
                  };
                } else if (pbox.type === 'nitro') {
                  p.nitroTimer = 3.5;
                  p.heldPowerup = {
                    type: 'nitro',
                    isWeapon: false,
                    duration: 3.5,
                    totalDuration: 3.5
                  };
                } else if (pbox.type === 'shield') {
                  p.shieldT = 4.5;
                  p.heldPowerup = {
                    type: 'shield',
                    isWeapon: false,
                    duration: 4.5,
                    totalDuration: 4.5
                  };
                }

                console.log(`[Room ${this.roomId}] Powerup box ${pbox.id} (${pbox.type}) picked up by ${p.displayName}`);
                this.io.to(this.roomId).emit('powerupPickedUp', {
                  id: pbox.id,
                  playerId: p.id,
                  playerName: p.displayName,
                  type: pbox.type,
                  heldPowerup: p.heldPowerup
                });
                break;
              }
            }
          }
        }

        // ----------------------------------------------------
        // C. ARENA EVENTS ENGINE
        // ----------------------------------------------------
        this.eventTimer -= DT;
        if (this.eventTimer <= 0 && !this.activeEvent) {
          const eventOptions = [
            { type: 'tornado', name: '🌪️ TORNADO OUTBREAK', desc: 'A violent tornado sweeps across the arena!', duration: 15 },
            { type: 'meteor', name: '☄️ METEOR SHOWER', desc: 'Meteors raining from the sky! Dodge impact zones!', duration: 15 },
            { type: 'overcharge', name: '⚡ OVERCHARGE TURBO', desc: 'Unlimited nitro boost & faster reload speed!', duration: 15 },
            { type: 'goldenrush', name: '👑 GOLDEN RUSH', desc: 'Double damage on all weapons!', duration: 15 }
          ];
          const selected = eventOptions[Math.floor(Math.random() * eventOptions.length)];
          this.activeEvent = selected;
          this.activeEventTimer = selected.duration;
          this.eventTimer = 35.0; // Next event in 35s

          console.log(`[Room ${this.roomId}] Dynamic Arena Event Started: ${selected.name}`);
          this.io.to(this.roomId).emit('arenaEventStarted', selected);
        }

        if (this.activeEvent) {
          this.activeEventTimer -= DT;

          // Event Logic: Tornado
          if (this.activeEvent.type === 'tornado') {
            this.tornadoPos.angle += DT * 0.8;
            this.tornadoPos.x = Math.cos(this.tornadoPos.angle) * 22.0;
            this.tornadoPos.z = Math.sin(this.tornadoPos.angle) * 22.0;

            for (const id in this.players) {
              const p = this.players[id];
              if (!p.alive) continue;
              const tDist = Math.hypot(p.x - this.tornadoPos.x, p.z - this.tornadoPos.z);
              if (tDist < 12.0 && tDist > 0.1) {
                const pullX = (this.tornadoPos.x - p.x) / tDist;
                const pullZ = (this.tornadoPos.z - p.z) / tDist;
                p.knockVel.x += pullX * 18.0 * DT;
                p.knockVel.z += pullZ * 18.0 * DT;
              }
            }
          }
          // Event Logic: Meteor Shower
          else if (this.activeEvent.type === 'meteor') {
            this.meteorTimer += DT;
            if (this.meteorTimer >= 2.2) {
              this.meteorTimer = 0;
              const mx = (Math.random() - 0.5) * 50.0;
              const mz = (Math.random() - 0.5) * 50.0;
              const splashRad = 7.0;

              this.io.to(this.roomId).emit('meteorImpact', { x: mx, z: mz, radius: splashRad });

              for (const id in this.players) {
                const p = this.players[id];
                if (!p.alive) continue;
                const mDist = Math.hypot(p.x - mx, p.z - mz);
                if (mDist <= splashRad) {
                  const knockDir = {
                    x: mDist > 0.1 ? (p.x - mx) / mDist : 0,
                    z: mDist > 0.1 ? (p.z - mz) / mDist : 1
                  };
                  this.applyDamage(p, 30, knockDir, 16.0, 'METEOR');
                }
              }
            }
          }

          if (this.activeEventTimer <= 0) {
            console.log(`[Room ${this.roomId}] Dynamic Arena Event Ended: ${this.activeEvent.type}`);
            this.io.to(this.roomId).emit('arenaEventEnded', { type: this.activeEvent.type });
            this.activeEvent = null;
          }
        }

        // Match Completion Check
        if (this.matchTime <= 0) {
          this.status = 'FINISHED';

          // Reset player ready states for next round in lobby
          Object.values(this.players).forEach(p => { p.ready = false; });

          const standings = Object.values(this.players).map(p => ({
            id: p.id,
            displayName: p.displayName,
            kills: p.kills,
            deaths: p.deaths,
            damageDealt: Math.round(p.damageDealt || 0)
          })).sort((a,b) => b.kills - a.kills || b.damageDealt - a.damageDealt);

          console.log(`[Room ${this.roomId}] MATCH FINISHED! Winner: ${standings[0] ? standings[0].displayName : 'None'}`);

          this.io.to(this.roomId).emit('matchEnded', { status: 'FINISHED', standings, roomId: this.roomId });
          this.io.to(this.roomId).emit('gameFinished', { standings });
          this.io.to(this.roomId).emit('matchStateChanged', { status: 'FINISHED' });
          this.broadcastRoomState();
        }
      }

      // ----------------------------------------------------
      // D. PROCESS PLAYER PHYSICS & RESPAWNS
      // ----------------------------------------------------
      for (const id in this.players) {
        const p = this.players[id];

        if (!p.alive) {
          p.respawnTimer -= DT;
          if (p.respawnTimer <= 0) {
            p.spawnIndex = this.getAvailableSpawnIndex();
            this.assignedSpawns[p.spawnIndex] = true;
            const spawn = SPAWN_POSITIONS[p.spawnIndex];

            p.x = spawn.x;
            p.y = 0;
            p.z = spawn.z;
            p.yaw = spawn.yaw;
            p.speed = 0;
            p.verticalVelocity = 0;
            p.grounded = true;
            p.hp = p.maxHp = 100;
            p.alive = true;
            p.weapon = 'pea';
            p.ammo = Infinity;
            p.cooldownT = 0;
            p.shieldT = 0;
            p.nitroTimer = 0;
            p.nitroActive = false;
            p.heldPowerup = null;
            p.knockVel = { x: 0, z: 0 };

            console.log(`[Room ${this.roomId}] Player ${p.id} respawned at (${p.x}, ${p.z})`);

            this.io.to(this.roomId).emit('playerRespawned', {
              id: p.id,
              displayName: p.displayName,
              x: p.x,
              y: p.y,
              z: p.z,
              yaw: p.yaw,
              hp: p.hp,
              maxHp: p.maxHp
            });

            this.broadcastRoomState();
          }
          continue;
        }

        const inp = (this.status === 'PLAYING') ? (p.inputs || {}) : {};

        if (p.cooldownT > 0) p.cooldownT -= DT;
        if (p.shieldT > 0) {
          p.shieldT -= DT;
          if (p.heldPowerup && p.heldPowerup.type === 'shield') {
            p.heldPowerup.duration = Math.max(0, p.shieldT);
            if (p.shieldT <= 0) {
              p.heldPowerup = null; // Shield duration ended -> slot EMPTY
            }
          }
        }

        if (inp.nitro || (this.activeEvent && this.activeEvent.type === 'overcharge')) {
          p.nitroTimer = Math.max(p.nitroTimer, 0.6);
        }
        if (p.nitroTimer > 0) {
          p.nitroActive = true;
          p.nitroTimer -= DT;
          if (p.heldPowerup && p.heldPowerup.type === 'nitro') {
            p.heldPowerup.duration = Math.max(0, p.nitroTimer);
            if (p.nitroTimer <= 0) {
              p.heldPowerup = null; // Nitro duration ended -> slot EMPTY
            }
          }
        } else {
          p.nitroActive = false;
          if (p.heldPowerup && p.heldPowerup.type === 'nitro' && p.nitroTimer <= 0) {
            p.heldPowerup = null;
          }
        }

        const topSpeed = p.nitroActive ? 45.0 : 32.0;
        const accel = 28.0;
        const brakeDecel = 65.0;
        const turnSpeed = 2.8;

        if (inp.forward) {
          if (p.speed < 0) {
            p.speed = Math.min(0, p.speed + brakeDecel * DT);
          } else {
            p.speed = Math.min(p.speed + accel * DT, topSpeed);
          }
        } else if (inp.backward) {
          if (p.speed > 0) {
            p.speed = Math.max(0, p.speed - brakeDecel * DT);
          } else {
            p.speed = Math.max(p.speed - accel * DT, -12.0);
          }
        } else {
          p.speed *= Math.pow(0.85, DT * 30);
        }

        if (inp.left) p.yaw -= turnSpeed * DT;
        if (inp.right) p.yaw += turnSpeed * DT;

        const fwdX = Math.sin(p.yaw);
        const fwdZ = Math.cos(p.yaw);

        // Anti-tunneling substeps
        const substeps = (Math.abs(p.speed) > 16 || p.nitroActive) ? 2 : 1;
        const subDt = DT / substeps;

        for (let step = 0; step < substeps; step++) {
          p.x += fwdX * p.speed * subDt + p.knockVel.x * subDt;
          p.z += fwdZ * p.speed * subDt + p.knockVel.z * subDt;
          p.knockVel.x *= Math.pow(0.85, subDt * 30);
          p.knockVel.z *= Math.pow(0.85, subDt * 30);

          // 1. Ramp collisions (solid backside & sides) + smooth slope following + natural fall
          this.resolveServerRamps(p, subDt, fwdX, fwdZ, inp);

          // 2. Solid obstacle collisions (Crates & Tire Stacks with sliding & bouncing)
          this.resolveServerObstacles(p, fwdX, fwdZ);
        }

        const dist = Math.hypot(p.x, p.z);
        if (dist > 72.0) {
          p.x = (p.x / dist) * 72.0;
          p.z = (p.z / dist) * 72.0;
          p.speed *= 0.5;
        }
      }

      // ----------------------------------------------------
      // E. PROCESS PROJECTILES
      // ----------------------------------------------------
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const proj = this.projectiles[i];
        proj.life -= DT;
        proj.x += proj.velX * DT;
        proj.z += proj.velZ * DT;

        let hit = false;

        for (const targetId in this.players) {
          const target = this.players[targetId];
          if (!target.alive || target.id === proj.ownerId) continue;

          const dist = Math.hypot(proj.x - target.x, proj.z - target.z);
          if (dist < (proj.size + 1.4)) {
            hit = true;

            if (proj.splash > 0) {
              for (const splashTargetId in this.players) {
                const sTarget = this.players[splashTargetId];
                if (!sTarget.alive) continue;
                const sDist = Math.hypot(proj.x - sTarget.x, proj.z - sTarget.z);
                if (sDist <= proj.splash) {
                  const knockDir = {
                    x: sDist > 0.1 ? (sTarget.x - proj.x) / sDist : 0,
                    z: sDist > 0.1 ? (sTarget.z - proj.z) / sDist : 1
                  };
                  this.applyDamage(sTarget, proj.dmg, knockDir, proj.knock, proj.ownerId);
                }
              }
            } else {
              const knockDir = {
                x: proj.velX > 0 ? 1 : -1,
                z: proj.velZ > 0 ? 1 : -1
              };
              this.applyDamage(target, proj.dmg, knockDir, proj.knock, proj.ownerId);
            }
            break;
          }
        }

        if (hit || proj.life <= 0) {
          this.io.to(this.roomId).emit('projectileRemoved', { id: proj.id, x: proj.x, z: proj.z });
          this.projectiles.splice(i, 1);
        }
      }

      // ----------------------------------------------------
      // F. PROCESS MINES
      // ----------------------------------------------------
      for (let i = this.mines.length - 1; i >= 0; i--) {
        const mine = this.mines[i];
        if (mine.armT > 0) mine.armT -= DT;
        mine.life -= DT;

        let detonated = false;

        if (mine.armT <= 0) {
          for (const targetId in this.players) {
            const target = this.players[targetId];
            if (!target.alive) continue;

            const dist = Math.hypot(mine.x - target.x, mine.z - target.z);
            if (dist <= 2.2) {
              detonated = true;
              break;
            }
          }
        }

        if (detonated) {
          for (const targetId in this.players) {
            const target = this.players[targetId];
            if (!target.alive) continue;

            const dist = Math.hypot(mine.x - target.x, mine.z - target.z);
            if (dist <= mine.splash) {
              const knockDir = {
                x: dist > 0.1 ? (target.x - mine.x) / dist : 0,
                z: dist > 0.1 ? (target.z - mine.z) / dist : 1
              };
              this.applyDamage(target, mine.dmg, knockDir, mine.knock, mine.ownerId);
            }
          }

          this.io.to(this.roomId).emit('mineDetonated', { id: mine.id, x: mine.x, z: mine.z });
          this.mines.splice(i, 1);
        } else if (mine.life <= 0) {
          this.mines.splice(i, 1);
        }
      }

      // Broadcast room-isolated 3D gameState
      const gameStatePayload = {
        roomId: this.roomId,
        status: this.status,
        matchTime: Math.ceil(this.matchTime),
        stormRadius: this.storm.radius,
        powerups: this.powerups,
        activeEvent: this.activeEvent,
        players: Object.values(this.players).map(p => ({
          id: p.id,
          displayName: p.displayName,
          characterId: p.characterId || 'racer',
          alive: p.alive,
          hp: p.hp,
          maxHp: p.maxHp,
          kills: p.kills,
          deaths: p.deaths,
          damageDealt: Math.round(p.damageDealt || 0),
          weapon: p.weapon,
          ammo: p.ammo,
          shield: p.shieldT > 0,
          heldPowerup: p.heldPowerup ? {
            type: p.heldPowerup.type,
            isWeapon: p.heldPowerup.isWeapon,
            ammo: p.heldPowerup.ammo,
            maxAmmo: p.heldPowerup.maxAmmo,
            duration: p.heldPowerup.duration ? Number(p.heldPowerup.duration.toFixed(2)) : 0,
            totalDuration: p.heldPowerup.totalDuration || 0
          } : null,
          x: p.x,
          y: p.y,
          z: p.z,
          yaw: p.yaw,
          speed: p.speed,
          verticalVelocity: p.verticalVelocity,
          grounded: p.grounded,
          nitroActive: p.nitroActive
        }))
      };

      const payloadStr = JSON.stringify(gameStatePayload);
      this.lastPayloadBytes = payloadStr.length;
      this.io.to(this.roomId).emit('gameState', gameStatePayload);

      const tDuration = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
      this.perfStats.tickCount++;
      this.perfStats.totalDuration += tDuration;
      if (tDuration > this.perfStats.maxDuration) this.perfStats.maxDuration = tDuration;

      if (!this.recentTickDurations) this.recentTickDurations = [];
      this.recentTickDurations.push(tDuration);
      if (this.recentTickDurations.length > 300) this.recentTickDurations.shift();

      if (this.perfStats.tickCount % 300 === 0) {
        const avg = this.perfStats.totalDuration / 300;
        console.log(`[Room ${this.roomId}] 30Hz Tick Perf (300 ticks): avg=${avg.toFixed(3)}ms, max=${this.perfStats.maxDuration.toFixed(3)}ms (budget: 33.33ms, payload: ${this.lastPayloadBytes}B)`);
        this.perfStats.totalDuration = 0;
        this.perfStats.maxDuration = 0;
      }
    }, 1000 / TICK_RATE);
  }

  getPerfMetrics() {
    const times = this.recentTickDurations || [];
    if (times.length === 0) {
      return {
        tickCount: this.perfStats ? this.perfStats.tickCount : 0,
        sampleSize: 0,
        avgTickMs: 0,
        p95TickMs: 0,
        maxTickMs: 0,
        minTickMs: 0,
        tickRate: 30,
        activePlayers: Object.keys(this.players).length,
        projectiles: this.projectiles.length,
        mines: this.mines.length,
        lastPayloadBytes: this.lastPayloadBytes || 0
      };
    }
    const sorted = [...times].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const avg = sum / sorted.length;
    const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const p95 = sorted[p95Idx];
    return {
      tickCount: this.perfStats ? this.perfStats.tickCount : 0,
      sampleSize: sorted.length,
      avgTickMs: Number(avg.toFixed(3)),
      p95TickMs: Number(p95.toFixed(3)),
      maxTickMs: Number(sorted[sorted.length - 1].toFixed(3)),
      minTickMs: Number(sorted[0].toFixed(3)),
      tickRate: 30,
      activePlayers: Object.keys(this.players).length,
      projectiles: this.projectiles.length,
      mines: this.mines.length,
      lastPayloadBytes: this.lastPayloadBytes || 0
    };
  }

  stopTickLoop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  resolveServerRamps(p, dt, fwdX, fwdZ, inp) {
    const R_kart = 1.35;
    let onRamp = false;
    let groundY = 0;

    for (let i = 0; i < ARENA_RAMP_DEFS.length; i++) {
      const rmp = ARENA_RAMP_DEFS[i];
      const cosY = Math.cos(rmp.yaw);
      const sinY = Math.sin(rmp.yaw);
      const dx = p.x - rmp.x;
      const dz = p.z - rmp.z;
      let lx = dx * cosY - dz * sinY;
      let lz = dx * sinY + dz * cosY;
      const hw = rmp.width / 2;
      const L = rmp.length;
      const curMaxH = rmp.maxHeight;

      const slopeAtX = (lx >= 0 && lx <= L) ? (lx / L) * curMaxH : (lx > L ? curMaxH : 0);
      const isAboveSlope = p.y >= (slopeAtX - 0.35);

      let collided = false;
      let nlx = 0, nlz = 0;

      // 1. Back Wall & Back Corners
      if (lx >= L) {
        if (Math.abs(lz) <= hw) {
          // Direct backside
          if (lx < L + R_kart && !isAboveSlope) {
            lx = L + R_kart;
            nlx = 1; nlz = 0;
            collided = true;
          }
        } else {
          // Diagonal back corners: (L, -hw) and (L, hw)
          const signZ = Math.sign(lz);
          const clx = lx - L;
          const clz = Math.abs(lz) - hw;
          const distSq = clx * clx + clz * clz;
          if (distSq < R_kart * R_kart && !isAboveSlope) {
            const dist = Math.sqrt(distSq) || 0.001;
            lx = L + (clx / dist) * R_kart;
            lz = signZ * (hw + (clz / dist) * R_kart);
            nlx = clx / dist;
            nlz = signZ * (clz / dist);
            collided = true;
          }
        }
      } else if (lx >= 0 && lx < L) {
        // 2. Side Walls & Interior Penetration
        if (Math.abs(lz) >= hw) {
          // Outside side wall
          if (Math.abs(lz) < hw + R_kart && !isAboveSlope) {
            const signZ = Math.sign(lz);
            lz = signZ * (hw + R_kart);
            nlx = 0;
            nlz = signZ;
            collided = true;
          }
        } else {
          // Inside ramp footprint (lx in [0, L], |lz| < hw)
          if (!isAboveSlope) {
            // Kart penetrated inside solid prism! Eject to nearest barrier face
            const dBack = L - lx;
            const dSide = hw - Math.abs(lz);
            const signZ = Math.sign(lz) || 1;
            if (dBack < dSide) {
              lx = L + R_kart;
              nlx = 1; nlz = 0;
            } else {
              lz = signZ * (hw + R_kart);
              nlx = 0; nlz = signZ;
            }
            collided = true;
          } else {
            // Kart is legitimately on top of the ramp slope
            onRamp = true;
            groundY = Math.max(groundY, slopeAtX);
          }
        }
      } else if (lx < 0 && Math.abs(lz) > hw) {
        // Front corners: (0, -hw) and (0, hw)
        const signZ = Math.sign(lz);
        const clx = -lx;
        const clz = Math.abs(lz) - hw;
        const distSq = clx * clx + clz * clz;
        if (distSq < R_kart * R_kart && !isAboveSlope) {
          const dist = Math.sqrt(distSq) || 0.001;
          lx = -(clx / dist) * R_kart;
          lz = signZ * (hw + (clz / dist) * R_kart);
          nlx = -clx / dist;
          nlz = signZ * (clz / dist);
          collided = true;
        }
      }

      if (collided) {
        // Convert resolved local position back to world
        p.x = rmp.x + (lx * cosY + lz * sinY);
        p.z = rmp.z + (-lx * sinY + lz * cosY);

        // Convert local normal to world normal
        const nx = nlx * cosY + nlz * sinY;
        const nz = -nlx * sinY + nlz * cosY;

        let vx = fwdX * p.speed + p.knockVel.x;
        let vz = fwdZ * p.speed + p.knockVel.z;
        const vDotN = vx * nx + vz * nz;
        if (vDotN < 0) {
          const vnX = vDotN * nx, vnZ = vDotN * nz;
          const vtX = vx - vnX, vtZ = vz - vnZ;
          vx = vtX * 0.85 - vnX * 0.15;
          vz = vtZ * 0.85 - vnZ * 0.15;
          const newSpeed = vx * fwdX + vz * fwdZ;
          p.speed = newSpeed;
          p.knockVel.x = vx - fwdX * newSpeed;
          p.knockVel.z = vz - fwdZ * newSpeed;
        }
      }
    }

    // D. Ground Surface Following & Natural Gravity Fall
    const currentGround = onRamp ? groundY : 0;
    if (inp && inp.jump && p.grounded) {
      p.verticalVelocity = 14.0;
      p.grounded = false;
    }

    if (!p.grounded) {
      p.y += p.verticalVelocity * dt;
      p.verticalVelocity -= 32.0 * dt;
      if (p.y <= currentGround) {
        p.y = currentGround;
        p.verticalVelocity = 0;
        p.grounded = true;
      }
    } else if (onRamp) {
      // Follow slope surface smoothly - NO artificial auto-jump!
      p.y = currentGround;
    } else {
      if (p.y > 0.05) {
        // Dropping off ramp crest naturally into air
        p.grounded = false;
        p.y += p.verticalVelocity * dt;
        p.verticalVelocity -= 32.0 * dt;
        if (p.y <= 0) {
          p.y = 0;
          p.verticalVelocity = 0;
          p.grounded = true;
        }
      } else {
        p.y = 0;
      }
    }
  }

  resolveServerObstacles(p, fwdX, fwdZ) {
    const R_kart = 1.35;
    let vx = fwdX * p.speed + p.knockVel.x;
    let vz = fwdZ * p.speed + p.knockVel.z;
    let collided = false;

    for (let i = 0; i < ARENA_OBSTACLE_DEFS.length; i++) {
      const ob = ARENA_OBSTACLE_DEFS[i];
      if (ob.type === 'cylinder') {
        const dx = p.x - ob.x, dz = p.z - ob.z;
        const minDist = R_kart + ob.radius;
        const dSq = dx * dx + dz * dz;
        if (dSq < minDist * minDist) {
          collided = true;
          let dist = Math.sqrt(dSq);
          let nx = 1, nz = 0;
          if (dist > 0.0001) { nx = dx / dist; nz = dz / dist; }
          else { dist = 0.0001; }
          const overlap = minDist - dist;
          p.x += nx * overlap;
          p.z += nz * overlap;

          const vDotN = vx * nx + vz * nz;
          if (vDotN < 0) {
            const vnX = vDotN * nx, vnZ = vDotN * nz;
            const vtX = vx - vnX, vtZ = vz - vnZ;
            const impact = -vDotN;
            const restitution = impact > 4.0 ? 0.22 : 0.05;
            const friction = impact > 4.0 ? 0.8 : 0.95;
            vx = vtX * friction - vnX * restitution;
            vz = vtZ * friction - vnZ * restitution;
          }
        }
      } else {
        // Box obstacle (Oriented Bounding Box)
        const dx = p.x - ob.x, dz = p.z - ob.z;
        const cosY = Math.cos(-ob.yaw), sinY = Math.sin(-ob.yaw);
        let lx = dx * cosY - dz * sinY;
        let lz = dx * sinY + dz * cosY;
        const cx = Math.max(-ob.halfX, Math.min(ob.halfX, lx));
        const cz = Math.max(-ob.halfZ, Math.min(ob.halfZ, lz));
        const diffX = lx - cx, diffZ = lz - cz;
        const dSq = diffX * diffX + diffZ * diffZ;
        let hit = false;
        let lnx = 0, lnz = 0;

        if (dSq > 0.000001 && dSq < R_kart * R_kart) {
          hit = true;
          const d = Math.sqrt(dSq);
          lnx = diffX / d; lnz = diffZ / d;
          const overlap = R_kart - d;
          lx += lnx * overlap; lz += lnz * overlap;
        } else if (dSq <= 0.000001) {
          hit = true;
          const dL = lx - (-ob.halfX), dR = ob.halfX - lx;
          const dB = lz - (-ob.halfZ), dT = ob.halfZ - lz;
          const minE = Math.min(dL, dR, dB, dT);
          let overlap = 0;
          if (minE === dL) { lnx = -1; overlap = dL + R_kart; }
          else if (minE === dR) { lnx = 1; overlap = dR + R_kart; }
          else if (minE === dB) { lnz = -1; overlap = dB + R_kart; }
          else { lnz = 1; overlap = dT + R_kart; }
          lx += lnx * overlap; lz += lnz * overlap;
        }

        if (hit) {
          collided = true;
          const cosW = Math.cos(ob.yaw), sinW = Math.sin(ob.yaw);
          p.x = ob.x + (lx * cosW - lz * sinW);
          p.z = ob.z + (lx * sinW + lz * cosW);
          const nx = lnx * cosW - lnz * sinW;
          const nz = lnx * sinW + lnz * cosW;
          const vDotN = vx * nx + vz * nz;
          if (vDotN < 0) {
            const vnX = vDotN * nx, vnZ = vDotN * nz;
            const vtX = vx - vnX, vtZ = vz - vnZ;
            const impact = -vDotN;
            const restitution = impact > 4.0 ? 0.22 : 0.05;
            const friction = impact > 4.0 ? 0.8 : 0.95;
            vx = vtX * friction - vnX * restitution;
            vz = vtZ * friction - vnZ * restitution;
          }
        }
      }
    }

    if (collided) {
      const newSpeed = vx * fwdX + vz * fwdZ;
      p.speed = newSpeed;
      p.knockVel.x = vx - fwdX * newSpeed;
      p.knockVel.z = vz - fwdZ * newSpeed;
    }
  }
}

GameRoom.WEAPONS = WEAPONS;

module.exports = GameRoom;
