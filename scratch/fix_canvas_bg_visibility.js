const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Hide #kb-bg-layer in CSS so the 3D WebGL canvas is always visible behind menus
html = html.replace(
  '#kb-bg-layer {\n    position: fixed; inset: 0; z-index: 55; pointer-events: none;\n    background: radial-gradient(circle at 50% 30%, #151a3d 0%, #060713 70%);\n    overflow: hidden; display: block;\n  }',
  '#kb-bg-layer {\n    position: fixed; inset: 0; z-index: 55; pointer-events: none;\n    overflow: hidden; display: none !important;\n  }'
);

// Also disable display = 'block' in JS for bgLayer
html = html.replace(
  "bgLayer.style.display = (state === UIState.GAME) ? 'none' : 'block';",
  "bgLayer.style.display = 'none';"
);

// 2. Ensure WeatherSystem.setPreset updates all matching buttons and forces renderer refresh
const enhancedSetPresetCode = `  setPreset(name) {
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
      skyStarField.visible = (p.starOpacity > 0);
    }

    if (typeof arenaSpotlights !== 'undefined' && Array.isArray(arenaSpotlights)) {
      arenaSpotlights.forEach(spot => {
        if (spot) {
          spot.intensity = p.spotIntensity;
          spot.color.setHex(p.spotColor);
        }
      });
    }

    document.querySelectorAll('#btnWeatherToggle, .btn-sky-toggle').forEach(btn => {
      if (btn) btn.textContent = p.label;
    });

    try { localStorage.setItem('kb_sky_mode', name); } catch(e){}
    if (typeof renderer !== 'undefined' && renderer && typeof camera !== 'undefined' && camera) {
      renderer.render(scene, camera);
    }
  }`;

html = html.replace(/setPreset\(name\) \{[\s\S]*?\n  \}/, enhancedSetPresetCode);

// 3. Apply saved/default sky mode on initialization right after initSkyEffects()
if (!html.includes("WeatherSystem.setPreset(localStorage.getItem('kb_sky_mode') || 'DAY');")) {
  html = html.replace(
    'initSkyEffects();',
    "initSkyEffects();\n    if (typeof WeatherSystem !== 'undefined') WeatherSystem.setPreset(localStorage.getItem('kb_sky_mode') || 'DAY');"
  );
}

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Successfully updated background layer visibility and WeatherSystem.setPreset');
