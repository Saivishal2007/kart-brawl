const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Update .ui-overlay CSS to make background semi-transparent without 12px blur masking
html = html.replace(
  'background: rgba(10, 20, 38, 0.75);\n    backdrop-filter: blur(12px);',
  'background: radial-gradient(circle at center, rgba(10, 20, 38, 0.2) 0%, rgba(5, 10, 20, 0.55) 100%);\n    backdrop-filter: blur(2px);'
);

// 2. Add visual toast feedback & instant render in WeatherSystem.setPreset
const toastSetPresetCode = `  setPreset(name) {
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

    if (typeof SoundFX !== 'undefined' && SoundFX.playUIClick) SoundFX.playUIClick();

    // Show visual notice toast
    if (typeof showLobbyNotice === 'function') {
      showLobbyNotice('✨ SKY ATMOSPHERE CHANGED TO: ' + name, false);
    }

    if (typeof renderer !== 'undefined' && renderer && typeof camera !== 'undefined' && camera) {
      renderer.render(scene, camera);
    }
  }`;

html = html.replace(/setPreset\(name\) \{[\s\S]*?\n  \}/, toastSetPresetCode);

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Successfully adjusted overlay transparency and added toast feedback to setPreset');
