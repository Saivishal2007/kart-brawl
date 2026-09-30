const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Add StarField & Spotlights initialization right after scene lighting init
const starAndSpotlightInitCode = `
  /* ---------------- PHASE 1: DYNAMIC SKY & SPOTLIGHT SYSTEM ---------------- */
  let skyStarField = null;
  let arenaSpotlights = [];

  function initSkyEffects() {
    if (!scene) return;

    // 1. Create Twinkling Star Field
    const starGeo = new THREE.BufferGeometry();
    const starCount = 600;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 250 + Math.random() * 200;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 20; // Dome above horizon
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.2,
      transparent: true,
      opacity: 0.0,
      sizeAttenuation: true
    });
    skyStarField = new THREE.Points(starGeo, starMat);
    scene.add(skyStarField);

    // 2. Create Corner Stadium Spotlights
    const spotCoords = [
      [-36, 22, -36],
      [36, 22, -36],
      [-36, 22, 36],
      [36, 22, 36]
    ];
    spotCoords.forEach(pos => {
      const spot = new THREE.SpotLight(0x00f3ff, 0.4);
      spot.position.set(pos[0], pos[1], pos[2]);
      spot.angle = Math.PI / 6;
      spot.penumbra = 0.4;
      spot.decay = 1.5;
      spot.distance = 120;
      spot.target.position.set(0, 0, 0);
      scene.add(spot);
      scene.add(spot.target);
      arenaSpotlights.push(spot);
    });
  }
  initSkyEffects();
`;

// Insert after hemiLight init
if (html.includes('scene.add(hemiLight);') && !html.includes('initSkyEffects();')) {
  html = html.replace('scene.add(hemiLight);', 'scene.add(hemiLight);\n' + starAndSpotlightInitCode);
  console.log('Successfully inserted sky star field & spotlight initialization');
}

// 2. Replace WeatherSystem implementation with expanded Phase 1 preset system
const newWeatherSystemCode = `/* ---------------- PHASE 1: DYNAMIC WEATHER & TIME-OF-DAY CYCLES (DAY, AFTERNOON, MIDNIGHT) ---------------- */
const WeatherSystem = {
  currentPreset: 'DAY',
  presets: {
    DAY: {
      bg: 0x3b85e0, fog: 0x6aa5ee, fogDensity: 0.003,
      sunColor: 0xfffaeb, sunIntensity: 1.5, sunPos: [80, 120, 60],
      ambientColor: 0xd6e6ff, ambientIntensity: 0.9,
      hemiSky: 0x70cfff, hemiGround: 0x448833, hemiIntensity: 0.6,
      starOpacity: 0.0, spotIntensity: 0.1, spotColor: 0xffffff,
      label: '☀️ SKY: DAY'
    },
    AFTERNOON: {
      bg: 0xff4522, fog: 0xff7044, fogDensity: 0.004,
      sunColor: 0xffaa33, sunIntensity: 1.85, sunPos: [140, 35, 30],
      ambientColor: 0xffcca0, ambientIntensity: 0.75,
      hemiSky: 0xff6633, hemiGround: 0x443322, hemiIntensity: 0.65,
      starOpacity: 0.35, spotIntensity: 0.65, spotColor: 0xffaa44,
      label: '🌅 SKY: AFTERNOON'
    },
    MIDNIGHT: {
      bg: 0x040614, fog: 0x090e24, fogDensity: 0.0055,
      sunColor: 0x3366ff, sunIntensity: 0.45, sunPos: [30, 95, -50],
      ambientColor: 0x1a2040, ambientIntensity: 0.4,
      hemiSky: 0x00d4ff, hemiGround: 0xff0066, hemiIntensity: 0.75,
      starOpacity: 1.0, spotIntensity: 1.8, spotColor: 0x00f3ff,
      label: '🌙 SKY: MIDNIGHT'
    }
  },
  toggle() {
    const list = ['DAY', 'AFTERNOON', 'MIDNIGHT'];
    const idx = (list.indexOf(this.currentPreset) + 1) % list.length;
    this.setPreset(list[idx]);
  },
  setPreset(name) {
    if (!this.presets[name] || typeof scene === 'undefined' || !scene) return;
    this.currentPreset = name;
    const p = this.presets[name];

    if (scene.background) scene.background.setHex(p.bg);
    if (scene.fog) {
      scene.fog.color.setHex(p.fog);
      scene.fog.density = p.fogDensity;
    }
    if (typeof sun !== 'undefined' && sun) {
      sun.color.setHex(p.sunColor);
      sun.intensity = p.sunIntensity;
      sun.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
    }
    if (typeof ambientLight !== 'undefined' && ambientLight) {
      ambientLight.color.setHex(p.ambientColor);
      ambientLight.intensity = p.ambientIntensity;
    }
    if (typeof hemiLight !== 'undefined' && hemiLight) {
      hemiLight.color.setHex(p.hemiSky);
      hemiLight.groundColor.setHex(p.hemiGround);
      hemiLight.intensity = p.hemiIntensity;
    }

    if (typeof skyStarField !== 'undefined' && skyStarField && skyStarField.material) {
      skyStarField.material.opacity = p.starOpacity;
    }

    if (typeof arenaSpotlights !== 'undefined' && Array.isArray(arenaSpotlights)) {
      arenaSpotlights.forEach(spot => {
        if (spot) {
          spot.intensity = p.spotIntensity;
          spot.color.setHex(p.spotColor);
        }
      });
    }

    const btn = document.getElementById('btnWeatherToggle');
    if (btn) btn.textContent = p.label;
    try { localStorage.setItem('kb_sky_mode', name); } catch(e){}
  }
};`;

const weatherRegex = /\/\* ---------------- PHASE 6\.8: DYNAMIC WEATHER[\s\S]*?const WeatherSystem = \{[\s\S]*?\n\};/;
if (weatherRegex.test(html)) {
  html = html.replace(weatherRegex, newWeatherSystemCode);
  console.log('Successfully replaced WeatherSystem with Phase 1 dynamic sky modes');
} else {
  console.error('Failed to locate weatherRegex pattern in index.html');
}

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('client/index.html updated successfully with Phase 1 sky modes');
