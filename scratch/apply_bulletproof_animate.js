const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Refactor animate() to be 100% error-resilient and GUARANTEE renderer.render(scene, camera) executes on every single frame!
const bulletproofAnimate = `function animate() {
  requestAnimationFrame(animate);

  const dt = (typeof clock !== 'undefined' && clock && clock.getDelta) ? Math.min(clock.getDelta(), 0.1) : 0.016;

  // Defensive update wrapper to ensure rendering NEVER halts
  try {
    // Environmental animations
    if (typeof boostTextures !== 'undefined' && Array.isArray(boostTextures)) {
      boostTextures.forEach(t => { if (t && t.offset) t.offset.y -= dt * 1.8; });
    }

    if (typeof clouds !== 'undefined' && Array.isArray(clouds)) {
      clouds.forEach(c => {
        if (c && c.mesh) {
          c.mesh.position.x += (c.speed || 10) * dt * 0.5;
          if (c.mesh.position.x > 350) c.mesh.position.x = -350;
        }
      });
    }

    // Universal Storm Visual Scaling & Pulsing
    if (typeof updateStormWallVFX === 'function') {
      updateStormWallVFX(dt);
    }

    // 360° Stadium Spectator Wave & Flashes
    if (typeof stadiumSectors !== 'undefined' && Array.isArray(stadiumSectors)) {
      const time = performance.now() * 0.004;
      stadiumSectors.forEach(s => {
        if (s && s.group) {
          const wave = Math.sin(time + (s.ang || 0) * 4.0);
          const waveJump = wave > 0.2 ? wave * 0.55 : 0;
          s.group.position.y = waveJump;
        }
      });
    }

    if (typeof stadiumFlashes !== 'undefined' && Array.isArray(stadiumFlashes)) {
      stadiumFlashes.forEach(sf => {
        if (sf && sf.mat) {
          if (sf.timer > 0) {
            sf.timer -= dt;
            sf.mat.opacity = Math.max(0, sf.timer / 0.12);
          } else if (Math.random() < 0.003) {
            sf.timer = 0.12;
            sf.mat.opacity = 1.0;
          }
        }
      });
    }

    if (typeof floatingHazards !== 'undefined' && Array.isArray(floatingHazards)) {
      floatingHazards.forEach(h => {
        if (h && h.mesh && h.basePos) {
          h.mesh.rotation.y += dt * 0.8;
          h.mesh.position.y = h.basePos.y + Math.sin(performance.now() * 0.003 + (h.phase || 0)) * 0.6;
        }
      });
    }

    // Particle Trails
    if (typeof karts !== 'undefined' && Array.isArray(karts)) {
      karts.forEach(k => {
        if (k && k.alive && (k.nitroT > 0 || k.trail === 'flame')) {
          if (typeof spawnNitroFlame === 'function') spawnNitroFlame(k);
        }
      });
    }

    // Floating Mystery Boxes
    if (typeof pickups !== 'undefined' && Array.isArray(pickups)) {
      pickups.forEach((p, idx) => {
        if (p && p.active && p.mesh) {
          p.mesh.rotation.y += dt * 2.0;
          p.mesh.position.y = 1.0 + Math.sin(performance.now() * 0.003 + idx * 0.7) * 0.25;
        }
      });
    }

    if (typeof ReplaySystem !== 'undefined' && ReplaySystem && ReplaySystem.isReplaying) {
      ReplaySystem.updateReplay(dt);
    } else if (typeof currentUIState !== 'undefined' && currentUIState === UIState.GAME && typeof started !== 'undefined' && started && !gameOver) {
      if (typeof ReplaySystem !== 'undefined' && ReplaySystem.recordFrame) ReplaySystem.recordFrame(karts);
      if (typeof currentRoomId !== 'undefined' && !currentRoomId) {
        // Solo offline mode
        roundElapsed = (roundElapsed || 0) + dt;
        const elapsedRatio = roundElapsed / (typeof ROUND_TIME !== 'undefined' ? ROUND_TIME : 120);
        stormR = Math.max(12, 85 * (1 - elapsedRatio * 0.85));

        if (typeof player !== 'undefined' && player && !player.alive) {
          player.respawnT -= dt;
          if (player.respawnT <= 0 && typeof player.respawn === 'function') player.respawn();
        }

        if (typeof karts !== 'undefined' && Array.isArray(karts)) {
          karts.forEach(k => {
            if (k && !k.isPlayer) {
              if (!k.alive) {
                k.respawnT -= dt;
                if (k.respawnT <= 0 && typeof k.respawn === 'function') k.respawn();
              } else if (typeof updateAI === 'function') {
                updateAI(k, dt);
              }
            }
            if (k && typeof integrateKart === 'function') integrateKart(k, dt, k.isPlayer);
          });
        }

        if (typeof resolveKartCollisions === 'function') resolveKartCollisions();
        if (typeof updateProjectiles === 'function') updateProjectiles(dt);
        if (typeof updateMines === 'function') updateMines(dt);
        if (typeof updatePickups === 'function') updatePickups(dt);
        if (typeof updateParticles === 'function') updateParticles(dt);
        if (typeof updateSuperNovas === 'function') updateSuperNovas(dt);
        if (typeof updateArenaEvents === 'function') updateArenaEvents(dt);

        if (roundElapsed >= (typeof ROUND_TIME !== 'undefined' ? ROUND_TIME : 120) && typeof endRound === 'function') {
          endRound();
        }
      } else {
        // Multiplayer client update
        if (typeof karts !== 'undefined' && Array.isArray(karts)) {
          karts.forEach(k => {
            if (k && typeof integrateKart === 'function') integrateKart(k, dt, k.isPlayer);
          });
        }
        if (typeof updateProjectiles === 'function') updateProjectiles(dt);
        if (typeof updateParticles === 'function') updateParticles(dt);
        if (typeof updateSuperNovas === 'function') updateSuperNovas(dt);
        if (typeof sendPlayerInput === 'function') sendPlayerInput();
      }

      if (typeof SpectatorDirector !== 'undefined' && SpectatorDirector && SpectatorDirector.activeMode !== 0) {
        SpectatorDirector.update(dt);
      } else if (typeof updateCamera === 'function') {
        updateCamera(dt);
      }
      if (typeof updateHUD === 'function') updateHUD(dt);
    } else {
      menuCamAngle = (typeof menuCamAngle !== 'undefined' ? menuCamAngle : 0) + 0.0025 * dt * 60;
      if (typeof camera !== 'undefined' && camera) {
        camera.position.x = Math.sin(menuCamAngle) * 35;
        camera.position.z = Math.cos(menuCamAngle) * 35;
        camera.position.y = 18;
        camera.lookAt(0, 2, 0);
      }
    }
  } catch (err) {
    console.warn("Animate frame update caught exception:", err);
  }

  // GUARANTEED WEBGL RENDER CYCLE ON EVERY FRAME
  if (typeof renderer !== 'undefined' && renderer && typeof scene !== 'undefined' && scene && typeof camera !== 'undefined' && camera) {
    renderer.render(scene, camera);
  }
}`;

// Find current animate function block in index.html and replace it
const animateRegex = /function animate\(\) \{[\s\S]*?\n\s*renderer\.render\(scene, camera\);[\s\S]*?\n\}/;
if (animateRegex.test(html)) {
  html = html.replace(animateRegex, bulletproofAnimate);
  console.log("Successfully replaced animate() with bulletproof render loop!");
} else {
  console.error("Could not find animateRegex match in index.html");
}

fs.writeFileSync(htmlPath, html, 'utf8');
console.log("Updated client/index.html with bulletproof animate loop");
