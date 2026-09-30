/**
 * KART BRAWL — ARCADE AUDIO SYSTEM (SoundFX)
 * 
 * High-performance, low-latency procedural audio engine built on the Web Audio API.
 * Features:
 * - Master Dynamics Compressor / Limiter (prevents digital clipping)
 * - Persistent, zero-allocation Engine & Drift synthesis graphs (no node churn at 60 FPS)
 * - Distinct, punchy combat sound identities (pea, rocket, triple, mine, explosion, hit ping, hurt)
 * - Dual-state procedural arcade soundtrack (Menu Synthwave Lounge & Battle Theme)
 * - Spatial 3D distance attenuation & stereo panning
 * - Robust autoplay resume and silent error handling
 */

(function(window) {
  "use strict";

  const SoundFX = {
    ctx: null,
    compressor: null,
    masterGain: null,
    sfxGain: null,
    musicGain: null,
    uiGain: null,

    // Persistent Engine Audio Graph (reused continuously)
    engineSubOsc: null,
    engineMidOsc: null,
    engineFilter: null,
    engineGainNode: null,
    engineInitialized: false,

    // Persistent Drift Audio Graph (reused continuously)
    driftNoiseSource: null,
    driftFilterNode: null,
    driftGainNode: null,
    driftInitialized: false,

    // Persistent Music Voices (reused, zero allocation per step)
    musicTimer: null,
    musicBpm: 124,
    musicStep: 0,
    isBattleTrack: false,
    musicBassOsc: null,
    musicBassFilter: null,
    musicBassGain: null,
    musicLeadOsc: null,
    musicLeadFilter: null,
    musicLeadGain: null,
    musicChordOsc1: null,
    musicChordOsc2: null,
    musicChordFilter: null,
    musicChordGain: null,
    musicDrumSource: null,
    musicDrumFilter: null,
    musicDrumGain: null,
    musicInitialized: false,

    // Cooldown trackers
    lastFireT: 0,
    lastStormWarnT: 0,
    lastAnnouncerT: 0,
    lastBotShotT: 0,

    // Shared Noise Buffer Cache
    noiseBufferCache: null,

    init() {
      if (this.ctx) {
        this.resumeContext();
        return;
      }

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        this.ctx = new AudioCtx();

        // 1. Master Dynamics Compressor / Brickwall Limiter to prevent clipping
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);
        this.compressor.connect(this.ctx.destination);

        // 2. Bus Gains
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.uiGain = this.ctx.createGain();

        this.masterGain.connect(this.compressor);
        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.uiGain.connect(this.masterGain);

        this.updateVolumes();

        // 3. Initialize Shared Noise Buffer
        this.initNoiseBuffer();

        // 4. Initialize Persistent Engine Graph
        this.initEngineGraph();

        // 5. Initialize Persistent Drift Graph
        this.initDriftGraph();

        // 6. Initialize Persistent Music Graph
        this.initMusicGraph();

      } catch (err) {
        console.warn('SoundFX initialization failed (silent fallback):', err);
      }

      this.resumeContext();
    },

    resumeContext() {
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

      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(masterOn ? 0.60 : 0.0, now, 0.04);
      this.sfxGain.gain.setTargetAtTime(sfxOn ? 0.55 : 0.0, now, 0.04);
      this.musicGain.gain.setTargetAtTime(musicOn ? 0.22 : 0.0, now, 0.04);
      this.uiGain.gain.setTargetAtTime(masterOn ? 0.50 : 0.0, now, 0.04);
    },

    isEnabled() {
      if (!this.ctx) this.init();
      const toggleAudio = document.getElementById('toggleAudio');
      const toggleSfx = document.getElementById('toggleSfx');
      if (toggleAudio && toggleAudio.textContent === 'DISABLED') return false;
      if (toggleSfx && toggleSfx.textContent === 'DISABLED') return false;
      return !!this.ctx;
    },

    initNoiseBuffer() {
      if (!this.ctx || this.noiseBufferCache) return;
      const length = this.ctx.sampleRate * 2.0; // 2 seconds looping noise
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBufferCache = buffer;
    },

    createNoiseBuffer(duration = 1.0) {
      if (!this.ctx) return null;
      if (this.noiseBufferCache && duration <= 2.0) return this.noiseBufferCache;
      const length = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
    },

    /* =========================================================================
       PERSISTENT ENGINE SYNTHESIS (Zero Allocation, Butter Smooth)
       ========================================================================= */

    initEngineGraph() {
      if (!this.ctx || this.engineInitialized) return;
      try {
        const now = this.ctx.currentTime;

        // Sub Rumble (Low sine wave)
        this.engineSubOsc = this.ctx.createOscillator();
        this.engineSubOsc.type = 'sine';
        this.engineSubOsc.frequency.setValueAtTime(45, now);

        // Mid Growl (Warm triangle wave)
        this.engineMidOsc = this.ctx.createOscillator();
        this.engineMidOsc.type = 'triangle';
        this.engineMidOsc.frequency.setValueAtTime(90, now);

        // Lowpass RPM Filter
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.setValueAtTime(140, now);
        this.engineFilter.Q.setValueAtTime(1.5, now);

        // Output Gain
        this.engineGainNode = this.ctx.createGain();
        this.engineGainNode.gain.setValueAtTime(0.0001, now);

        this.engineSubOsc.connect(this.engineFilter);
        this.engineMidOsc.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGainNode);
        this.engineGainNode.connect(this.sfxGain);

        this.engineSubOsc.start(now);
        this.engineMidOsc.start(now);

        this.engineInitialized = true;
      } catch (e) {
        console.warn('Engine audio init error:', e);
      }
    },

    updateEngine(speed, isNitro) {
      if (!this.isEnabled()) {
        this.stopEngine();
        return;
      }
      if (!this.engineInitialized) this.initEngineGraph();
      if (!this.engineGainNode) return;

      const now = this.ctx.currentTime;
      const absSpeed = Math.abs(speed || 0);

      if (absSpeed < 1.0 && !isNitro) {
        // Idle: fade to near-silence
        this.engineGainNode.gain.setTargetAtTime(0.0001, now, 0.08);
        return;
      }

      const speedRatio = Math.min(absSpeed / 60, 1.0);
      const baseFreq = 42 + speedRatio * 48 + (isNitro ? 22 : 0);
      const filterCutoff = 130 + speedRatio * 180 + (isNitro ? 90 : 0);
      const targetGain = 0.008 + speedRatio * 0.024 + (isNitro ? 0.012 : 0);

      this.engineSubOsc.frequency.setTargetAtTime(baseFreq, now, 0.08);
      this.engineMidOsc.frequency.setTargetAtTime(baseFreq * 2.0, now, 0.08);
      this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.08);
      this.engineGainNode.gain.setTargetAtTime(targetGain, now, 0.06);
    },

    stopEngine() {
      if (this.engineGainNode && this.ctx) {
        this.engineGainNode.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
      }
    },

    /* =========================================================================
       PERSISTENT DRIFT SKID TEXTURE
       ========================================================================= */

    initDriftGraph() {
      if (!this.ctx || this.driftInitialized) return;
      try {
        const now = this.ctx.currentTime;
        const noise = this.noiseBufferCache || this.createNoiseBuffer(2.0);
        if (!noise) return;

        this.driftNoiseSource = this.ctx.createBufferSource();
        this.driftNoiseSource.buffer = noise;
        this.driftNoiseSource.loop = true;

        this.driftFilterNode = this.ctx.createBiquadFilter();
        this.driftFilterNode.type = 'bandpass';
        this.driftFilterNode.frequency.setValueAtTime(680, now);
        this.driftFilterNode.Q.setValueAtTime(1.4, now);

        this.driftGainNode = this.ctx.createGain();
        this.driftGainNode.gain.setValueAtTime(0.0001, now);

        this.driftNoiseSource.connect(this.driftFilterNode);
        this.driftFilterNode.connect(this.driftGainNode);
        this.driftGainNode.connect(this.sfxGain);

        this.driftNoiseSource.start(now);
        this.driftInitialized = true;
      } catch (e) {
        console.warn('Drift audio init error:', e);
      }
    },

    updateDrift(isDrifting, speed) {
      if (!this.isEnabled()) {
        this.stopDrift();
        return;
      }
      if (!this.driftInitialized) this.initDriftGraph();
      if (!this.driftGainNode) return;

      const now = this.ctx.currentTime;
      const absSpeed = Math.abs(speed || 0);

      if (isDrifting && absSpeed > 10) {
        const intensity = Math.min((absSpeed - 10) / 45, 1.0);
        const targetGain = 0.015 + intensity * 0.035;
        const centerFreq = 650 + intensity * 240 + Math.random() * 40;

        this.driftGainNode.gain.setTargetAtTime(targetGain, now, 0.04);
        this.driftFilterNode.frequency.setTargetAtTime(centerFreq, now, 0.04);
      } else {
        this.driftGainNode.gain.setTargetAtTime(0.0001, now, 0.08);
      }
    },

    stopDrift() {
      if (this.driftGainNode && this.ctx) {
        this.driftGainNode.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.06);
      }
    },

    /* =========================================================================
       SPATIAL AUDIO CHANNEL (Distance Falloff + Stereo Panning)
       ========================================================================= */

    getSpatialChannel(worldPos, isPlayerAttacking = false) {
      if (!this.ctx) return null;
      const now = this.ctx.currentTime;

      // Rate limit distant bot attacks to prevent audio clutter
      if (!isPlayerAttacking) {
        if (now - this.lastBotShotT < 0.09) return null;
        this.lastBotShotT = now;
      }

      let gainMult = isPlayerAttacking ? 1.0 : 0.22;
      let panVal = 0.0;

      if (worldPos && typeof player !== 'undefined' && player && player.pos) {
        const dx = (worldPos.x !== undefined ? worldPos.x : 0) - player.pos.x;
        const dz = (worldPos.z !== undefined ? worldPos.z : 0) - player.pos.z;
        const dist = Math.hypot(dx, dz);

        if (dist <= 8) {
          gainMult *= 1.0;
        } else if (dist <= 26) {
          gainMult *= 1.0 / (1.0 + (dist - 8) * 0.15);
        } else if (dist <= 75) {
          gainMult *= 0.30 / (1.0 + (dist - 26) * 0.22);
        } else {
          gainMult *= 0.01;
        }

        if (typeof camera !== 'undefined' && camera) {
          const camDirX = -Math.sin(camera.rotation.y || 0);
          const camDirZ = -Math.cos(camera.rotation.y || 0);
          const rightX = -camDirZ;
          const rightZ = camDirX;
          const dotRight = (dx * rightX + dz * rightZ) / Math.max(1, dist);
          panVal = Math.min(Math.max(dotRight * 0.85, -0.85), 0.85);
        }
      }

      const channelGain = this.ctx.createGain();
      channelGain.gain.setValueAtTime(gainMult, now);

      let targetOutput = this.sfxGain;

      // Muffle distant bot audio slightly for depth
      if (!isPlayerAttacking) {
        const muffle = this.ctx.createBiquadFilter();
        muffle.type = 'lowpass';
        muffle.frequency.setValueAtTime(750, now);
        channelGain.connect(muffle);
        targetOutput = muffle;
      }

      if (this.ctx.createStereoPanner && Math.abs(panVal) > 0.03) {
        try {
          const panner = this.ctx.createStereoPanner();
          panner.pan.setValueAtTime(panVal, now);
          targetOutput.connect(panner);
          panner.connect(this.sfxGain);
          return channelGain;
        } catch(e) {}
      }

      targetOutput.connect(this.sfxGain);
      return channelGain;
    },

    /* =========================================================================
       COMBAT & WEAPON ACOUSTICS
       ========================================================================= */

    playNitroWhoosh() {
      if (!this.isEnabled()) return;
      const now = this.ctx.currentTime;

      // 1. Bass ignition thump
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(140, now);
      sub.frequency.exponentialRampToValueAtTime(50, now + 0.25);
      subGain.gain.setValueAtTime(0.24, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      sub.connect(subGain); subGain.connect(this.sfxGain);
      sub.start(now); sub.stop(now + 0.25);

      // 2. Rising whoosh noise
      const noiseBuf = this.createNoiseBuffer(0.35);
      if (noiseBuf) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(320, now);
        filter.frequency.exponentialRampToValueAtTime(1400, now + 0.22);
        filter.Q.setValueAtTime(1.8, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        noise.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
        noise.start(now); noise.stop(now + 0.35);
      }

      if (typeof Haptics !== 'undefined' && Haptics.vibrateNitro) Haptics.vibrateNitro();
    },

    playBulletFire(worldPos, isPlayerControlled = false) {
      if (!this.isEnabled()) return;
      const chan = this.getSpatialChannel(worldPos, isPlayerControlled);
      if (!chan) return;
      const now = this.ctx.currentTime;

      // 1. Sharp high-frequency mechanical crack transient
      const noiseBuf = this.createNoiseBuffer(0.04);
      if (noiseBuf) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuf;
        const bFilter = this.ctx.createBiquadFilter();
        bFilter.type = 'bandpass';
        bFilter.frequency.setValueAtTime(2800, now);
        bFilter.Q.setValueAtTime(2.2, now);
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(isPlayerControlled ? 0.32 : 0.10, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        noise.connect(bFilter);
        bFilter.connect(noiseGain);
        noiseGain.connect(chan);
        noise.start(now);
        noise.stop(now + 0.04);
      }

      // 2. Punchy arcade bullet body: swift downward pitch sweep
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.075);

      gain.gain.setValueAtTime(isPlayerControlled ? 0.28 : 0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

      osc.connect(gain);
      gain.connect(chan);
      osc.start(now);
      osc.stop(now + 0.075);

      // 3. Metallic brass ring resonance
      const metalOsc = this.ctx.createOscillator();
      const metalGain = this.ctx.createGain();
      metalOsc.type = 'sine';
      metalOsc.frequency.setValueAtTime(3200, now);
      metalGain.gain.setValueAtTime(isPlayerControlled ? 0.08 : 0.02, now);
      metalGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      metalOsc.connect(metalGain);
      metalGain.connect(chan);
      metalOsc.start(now);
      metalOsc.stop(now + 0.045);

      if (isPlayerControlled && typeof Haptics !== 'undefined' && Haptics.vibrate) Haptics.vibrate(14);
    },

    playPeaFire(worldPos, isPlayerControlled = false) {
      return this.playBulletFire(worldPos, isPlayerControlled);
    },

    playRocketFire(worldPos, isPlayerControlled = false) {
      if (!this.isEnabled()) return;
      const chan = this.getSpatialChannel(worldPos, isPlayerControlled);
      if (!chan) return;
      const now = this.ctx.currentTime;

      // Launch thump
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(180, now);
      sub.frequency.exponentialRampToValueAtTime(45, now + 0.20);
      subGain.gain.setValueAtTime(isPlayerControlled ? 0.30 : 0.09, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
      sub.connect(subGain); subGain.connect(chan);
      sub.start(now); sub.stop(now + 0.20);

      // Rocket ignition hiss
      const noiseBuf = this.createNoiseBuffer(0.24);
      if (noiseBuf) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(850, now);
        filter.Q.setValueAtTime(2.0, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(isPlayerControlled ? 0.24 : 0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        noise.connect(filter); filter.connect(gain); gain.connect(chan);
        noise.start(now); noise.stop(now + 0.24);
      }

      if (isPlayerControlled && typeof Haptics !== 'undefined' && Haptics.vibrate) Haptics.vibrate(30);
    },

    playTripleFire(worldPos, isPlayerControlled = false) {
      if (!this.isEnabled()) return;
      const now = this.ctx.currentTime;
      [0, 0.038, 0.076].forEach((delay, idx) => {
        setTimeout(() => {
          if (!this.ctx) return;
          const chan = this.getSpatialChannel(worldPos, isPlayerControlled);
          if (!chan) return;
          const t = this.ctx.currentTime;

          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(580 + idx * 75, t);
          osc.frequency.exponentialRampToValueAtTime(220, t + 0.065);

          gain.gain.setValueAtTime(isPlayerControlled ? 0.20 : 0.06, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

          osc.connect(gain); gain.connect(chan);
          osc.start(t); osc.stop(t + 0.065);
        }, delay * 1000);
      });

      if (isPlayerControlled && typeof Haptics !== 'undefined' && Haptics.vibrate) Haptics.vibrate([15, 18, 15]);
    },

    playMineDeploy(worldPos, isPlayerControlled = false) {
      if (!this.isEnabled()) return;
      const chan = this.getSpatialChannel(worldPos, isPlayerControlled);
      if (!chan) return;
      const now = this.ctx.currentTime;

      // Mechanical click + arming blip
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.12);

      gain.gain.setValueAtTime(isPlayerControlled ? 0.25 : 0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain); gain.connect(chan);
      osc.start(now); osc.stop(now + 0.12);

      if (isPlayerControlled && typeof Haptics !== 'undefined' && Haptics.vibrate) Haptics.vibrate(20);
    },

    playExplosion(worldPos) {
      if (!this.isEnabled()) return;
      const chan = this.getSpatialChannel(worldPos, true);
      if (!chan) return;
      const now = this.ctx.currentTime;

      // 1. Sub-bass punch
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(110, now);
      sub.frequency.exponentialRampToValueAtTime(32, now + 0.35);

      subGain.gain.setValueAtTime(0.40, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      sub.connect(subGain); subGain.connect(chan);
      sub.start(now); sub.stop(now + 0.35);

      // 2. Lowpass shaped blast burst
      const noiseBuf = this.createNoiseBuffer(0.42);
      if (noiseBuf) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuf;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(750, now);
        filter.frequency.exponentialRampToValueAtTime(90, now + 0.42);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.38, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

        noise.connect(filter); filter.connect(gain); gain.connect(chan);
        noise.start(now); noise.stop(now + 0.42);
      }

      if (typeof Haptics !== 'undefined' && Haptics.vibrateImpact) Haptics.vibrateImpact();
    },

    playHitPing(worldPos) {
      if (!this.isEnabled()) return;
      const chan = this.getSpatialChannel(worldPos, true);
      if (!chan) return;
      const now = this.ctx.currentTime;

      // Bright, crisp confirmation ping
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.05);

      gain.gain.setValueAtTime(0.20, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain); gain.connect(chan);
      osc.start(now); osc.stop(now + 0.05);
    },

    playDamageHurt(worldPos) {
      if (!this.isEnabled()) return;
      const chan = this.getSpatialChannel(worldPos, true);
      if (!chan) return;
      const now = this.ctx.currentTime;

      // Heavy, dull visceral impact thud
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.14);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, now);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(filter); filter.connect(gain); gain.connect(chan);
      osc.start(now); osc.stop(now + 0.14);
    },

    playShieldBlock(worldPos) {
      if (!this.isEnabled()) return;
      const chan = this.getSpatialChannel(worldPos, true);
      if (!chan) return;
      const now = this.ctx.currentTime;

      // Resonant harmonic shimmer
      [940, 1420].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + 0.16);

        gain.gain.setValueAtTime(0.22 / (idx + 1), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(gain); gain.connect(chan);
        osc.start(now); osc.stop(now + 0.16);
      });
    },

    /* =========================================================================
       POWERUPS & PICKUPS
       ========================================================================= */

    playPowerupPickup(type) {
      if (!this.isEnabled()) return;
      const now = this.ctx.currentTime;

      if (type === 'rocket') {
        // Bold rising major triad
        [220, 277.18, 329.63].forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.04);
          gain.gain.setValueAtTime(0.22, now + idx * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.12);
          osc.connect(gain); gain.connect(this.sfxGain);
          osc.start(now + idx * 0.04); osc.stop(now + idx * 0.04 + 0.12);
        });
      } else if (type === 'triple') {
        // Rapid triple chirp
        [440, 554.37, 659.25].forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.035);
          gain.gain.setValueAtTime(0.18, now + idx * 0.035);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.08);
          osc.connect(gain); gain.connect(this.sfxGain);
          osc.start(now + idx * 0.035); osc.stop(now + idx * 0.035 + 0.08);
        });
      } else if (type === 'shield') {
        // Shimmering luminous interval
        [523.25, 783.99].forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.04);
          gain.gain.setValueAtTime(0.20, now + idx * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.15);
          osc.connect(gain); gain.connect(this.sfxGain);
          osc.start(now + idx * 0.04); osc.stop(now + idx * 0.04 + 0.15);
        });
      } else {
        // Universal arcade pickup
        [392.00, 523.25].forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.045);
          gain.gain.setValueAtTime(0.20, now + idx * 0.045);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.10);
          osc.connect(gain); gain.connect(this.sfxGain);
          osc.start(now + idx * 0.045); osc.stop(now + idx * 0.045 + 0.10);
        });
      }

      if (typeof Haptics !== 'undefined' && Haptics.vibrate) Haptics.vibrate(20);
    },

    playPowerupActivate(type) {
      if (!this.isEnabled()) return;
      const now = this.ctx.currentTime;
      if (type === 'shield') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(740, now + 0.18);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain); gain.connect(this.sfxGain);
        osc.start(now); osc.stop(now + 0.18);
      }
    },

    /* =========================================================================
       GAME FLOW & UI
       ========================================================================= */

    playCountdownBeep(num) {
      if (!this.isEnabled()) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(num === 1 ? 880 : 587.33, now);
      gain.gain.setValueAtTime(0.30, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain); gain.connect(this.sfxGain);
      osc.start(now); osc.stop(now + 0.12);
    },

    playCountdownGo() {
      if (!this.isEnabled()) return;
      const now = this.ctx.currentTime;
      // Triumphant two-tone major chord
      [523.25, 783.99].forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain); gain.connect(this.sfxGain);
        osc.start(now); osc.stop(now + 0.35);
      });
    },

    playStormWarning() {
      if (!this.isEnabled()) return;
      const now = this.ctx.currentTime;
      if (now - this.lastStormWarnT < 3.0) return;
      this.lastStormWarnT = now;

      // Throbbing electronic siren
      [330, 260].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.22, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.14);
        osc.connect(gain); gain.connect(this.sfxGain);
        osc.start(now + idx * 0.12); osc.stop(now + idx * 0.12 + 0.14);
      });
    },

    playEliminationChime() {
      if (!this.isEnabled()) return;
      const now = this.ctx.currentTime;
      // Descending dramatic 4-tone chime
      [440, 370, 311.13, 220].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.065);
        gain.gain.setValueAtTime(0.22, now + idx * 0.065);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.065 + 0.16);
        osc.connect(gain); gain.connect(this.sfxGain);
        osc.start(now + idx * 0.065); osc.stop(now + idx * 0.065 + 0.16);
      });
    },

    playAnnouncerDoubleKill() {
      if (!this.isEnabled()) return;
      const now = this.ctx.currentTime;
      [440, 554.37, 659.25, 880].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.045);
        gain.gain.setValueAtTime(0.18, now + i * 0.045);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.14);
        osc.connect(gain); gain.connect(this.sfxGain);
        osc.start(now + i * 0.045); osc.stop(now + i * 0.045 + 0.14);
      });
    },

    playAnnouncerTripleKill() {
      if (!this.isEnabled()) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.04);
        gain.gain.setValueAtTime(0.20, now + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.18);
        osc.connect(gain); gain.connect(this.sfxGain);
        osc.start(now + i * 0.04); osc.stop(now + i * 0.04 + 0.18);
      });
    },

    playUIClick() {
      try {
        if (!this.isEnabled() || !this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
        osc.connect(gain); gain.connect(this.uiGain || this.sfxGain);
        osc.start(now); osc.stop(now + 0.025);
        if (typeof Haptics !== 'undefined' && Haptics.vibrate) Haptics.vibrate(8);
      } catch(e) {}
    },

    /* =========================================================================
       PROCEDURAL ARCADE MUSIC (Zero-Allocation Persistent Voice Sequencer)
       ========================================================================= */

    initMusicGraph() {
      if (!this.ctx || this.musicInitialized) return;
      try {
        const now = this.ctx.currentTime;

        // 1. Persistent Bass Voice
        this.musicBassOsc = this.ctx.createOscillator();
        this.musicBassOsc.type = 'triangle';
        this.musicBassOsc.frequency.setValueAtTime(110, now);

        this.musicBassFilter = this.ctx.createBiquadFilter();
        this.musicBassFilter.type = 'lowpass';
        this.musicBassFilter.frequency.setValueAtTime(220, now);

        this.musicBassGain = this.ctx.createGain();
        this.musicBassGain.gain.setValueAtTime(0.0001, now);

        this.musicBassOsc.connect(this.musicBassFilter);
        this.musicBassFilter.connect(this.musicBassGain);
        this.musicBassGain.connect(this.musicGain);
        this.musicBassOsc.start(now);

        // 2. Persistent Lead Voice
        this.musicLeadOsc = this.ctx.createOscillator();
        this.musicLeadOsc.type = 'sine';
        this.musicLeadOsc.frequency.setValueAtTime(440, now);

        this.musicLeadFilter = this.ctx.createBiquadFilter();
        this.musicLeadFilter.type = 'lowpass';
        this.musicLeadFilter.frequency.setValueAtTime(480, now);

        this.musicLeadGain = this.ctx.createGain();
        this.musicLeadGain.gain.setValueAtTime(0.0001, now);

        this.musicLeadOsc.connect(this.musicLeadFilter);
        this.musicLeadFilter.connect(this.musicLeadGain);
        this.musicLeadGain.connect(this.musicGain);
        this.musicLeadOsc.start(now);

        // 3. Persistent Drum Voice (Filtered Noise)
        const noise = this.noiseBufferCache || this.createNoiseBuffer(2.0);
        if (noise) {
          this.musicDrumSource = this.ctx.createBufferSource();
          this.musicDrumSource.buffer = noise;
          this.musicDrumSource.loop = true;

          this.musicDrumFilter = this.ctx.createBiquadFilter();
          this.musicDrumFilter.type = 'bandpass';
          this.musicDrumFilter.frequency.setValueAtTime(3500, now);
          this.musicDrumFilter.Q.setValueAtTime(1.0, now);

          this.musicDrumGain = this.ctx.createGain();
          this.musicDrumGain.gain.setValueAtTime(0.0001, now);

          this.musicDrumSource.connect(this.musicDrumFilter);
          this.musicDrumFilter.connect(this.musicDrumGain);
          this.musicDrumGain.connect(this.musicGain);
          this.musicDrumSource.start(now);
        }

        this.musicInitialized = true;
      } catch(e) {
        console.warn('Music voice graph init error:', e);
      }
    },

    startMusic(isBattleMode = false) {
      this.stopMusic();
      this.init();
      if (!this.musicInitialized) this.initMusicGraph();

      this.isBattleTrack = !!isBattleMode;
      this.musicBpm = this.isBattleTrack ? 128 : 104;
      this.musicStep = 0;

      // 16-step musical progressions:
      // Menu: Chill A minor / F / C / G progression
      const bassMenu = [
        110.00, 0, 110.00, 0,
        87.31,  0, 87.31,  0,
        130.81, 0, 130.81, 0,
        98.00,  0, 98.00,  0
      ];
      const leadMenu = [
        329.63, 0, 440.00, 0,
        349.23, 0, 392.00, 0,
        523.25, 0, 392.00, 0,
        440.00, 0, 329.63, 0
      ];

      // Battle: Driving energetic syncopated cyberpunk progression
      const bassBattle = [
        110.00, 110.00, 0, 110.00,
        130.81, 0,      110.00, 146.83,
        164.81, 164.81, 0, 146.83,
        130.81, 0,      110.00, 98.00
      ];
      const leadBattle = [
        440.00, 0, 523.25, 0,
        587.33, 0, 523.25, 659.25,
        523.25, 0, 440.00, 0,
        392.00, 0, 440.00, 0
      ];

      const stepIntervalMs = (60 / this.musicBpm / 4) * 1000; // 16th-note steps

      this.musicTimer = setInterval(() => {
        const toggleMusic = document.getElementById('toggleMusic');
        if (toggleMusic && toggleMusic.textContent === 'DISABLED') return;
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') {
          this.resumeContext();
          return;
        }

        const now = this.ctx.currentTime;
        const step = this.musicStep % 16;
        const gateDuration = (stepIntervalMs / 1000) * 0.85;

        const bassPattern = this.isBattleTrack ? bassBattle : bassMenu;
        const leadPattern = this.isBattleTrack ? leadBattle : leadMenu;

        // 1. Bass Step (Smooth pitch ramp & envelope on persistent voice)
        const bFreq = bassPattern[step];
        if (bFreq > 0 && this.musicBassGain && this.musicBassOsc) {
          this.musicBassOsc.frequency.setValueAtTime(bFreq, now);
          this.musicBassFilter.frequency.setValueAtTime(this.isBattleTrack ? 240 : 160, now);
          const bVol = this.isBattleTrack ? 0.055 : 0.038;
          this.musicBassGain.gain.setValueAtTime(bVol, now);
          this.musicBassGain.gain.exponentialRampToValueAtTime(0.0001, now + gateDuration);
        }

        // 2. Lead Step (Smooth melodic envelope on persistent voice)
        const lFreq = leadPattern[step];
        if (lFreq > 0 && this.musicLeadGain && this.musicLeadOsc) {
          this.musicLeadOsc.frequency.setValueAtTime(lFreq, now);
          this.musicLeadFilter.frequency.setValueAtTime(this.isBattleTrack ? 580 : 420, now);
          const lVol = this.isBattleTrack ? 0.035 : 0.024;
          this.musicLeadGain.gain.setValueAtTime(lVol, now);
          this.musicLeadGain.gain.exponentialRampToValueAtTime(0.0001, now + gateDuration);
        }

        // 3. Drum Rhythm (Hi-hat / Snare burst on persistent voice)
        if (this.musicDrumGain && this.musicDrumFilter) {
          if (this.isBattleTrack) {
            // Battle: Driving hi-hat on every 2nd step, snare accent on step 4 & 12
            if (step === 4 || step === 12) {
              // Snare
              this.musicDrumFilter.frequency.setValueAtTime(1800, now);
              this.musicDrumGain.gain.setValueAtTime(0.035, now);
              this.musicDrumGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
            } else if (step % 2 === 0) {
              // Closed Hat
              this.musicDrumFilter.frequency.setValueAtTime(4500, now);
              this.musicDrumGain.gain.setValueAtTime(0.012, now);
              this.musicDrumGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
            }
          } else {
            // Menu: Gentle shaker on every 4th step
            if (step % 4 === 2) {
              this.musicDrumFilter.frequency.setValueAtTime(4200, now);
              this.musicDrumGain.gain.setValueAtTime(0.008, now);
              this.musicDrumGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
            }
          }
        }

        this.musicStep++;
      }, stepIntervalMs);
    },

    stopMusic() {
      if (this.musicTimer) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
      if (this.ctx) {
        const now = this.ctx.currentTime;
        if (this.musicBassGain) this.musicBassGain.gain.setTargetAtTime(0.0001, now, 0.05);
        if (this.musicLeadGain) this.musicLeadGain.gain.setTargetAtTime(0.0001, now, 0.05);
        if (this.musicDrumGain) this.musicDrumGain.gain.setTargetAtTime(0.0001, now, 0.05);
      }
    }
  };

  // Autoplay Resume Listeners
  if (typeof window !== 'undefined') {
    ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(evt => {
      window.addEventListener(evt, () => {
        SoundFX.init();
      }, { once: false, passive: true });
    });

    window.SoundFX = SoundFX;
  }

})(typeof window !== 'undefined' ? window : this);