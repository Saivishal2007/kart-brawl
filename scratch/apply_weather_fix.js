const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Move window.WeatherSystem and window.toggleWeather exports to top of Script 3 (around window.UIState exports)
const topExportsInsert = `
window.WeatherSystem = WeatherSystem;
window.toggleWeather = function() {
  if (typeof WeatherSystem !== 'undefined' && WeatherSystem.toggle) {
    WeatherSystem.toggle();
  }
};
`;

if (!html.includes('window.toggleWeather = function()')) {
  html = html.replace(
    'window.UIState = UIState;\nwindow.setUIState = setUIState;\nwindow.copyRoomCode = copyRoomCode;',
    'window.UIState = UIState;\nwindow.setUIState = setUIState;\nwindow.copyRoomCode = copyRoomCode;' + topExportsInsert
  );
}

// 2. Refactor WeatherSystem.setPreset to ensure button label and state ALWAYS update reliably
const bulletproofSetPresetCode = `  setPreset(name) {
    if (!this.presets[name]) return;
    this.currentPreset = name;
    const p = this.presets[name];

    // 1. Always update UI buttons text across DOM
    document.querySelectorAll('#btnWeatherToggle, .btn-sky-toggle').forEach(btn => {
      if (btn) btn.textContent = p.label;
    });

    try { localStorage.setItem('kb_sky_mode', name); } catch(e){}

    if (typeof SoundFX !== 'undefined' && SoundFX.playUIClick) SoundFX.playUIClick();

    // 2. Safely apply 3D WebGL atmosphere if scene exists
    if (typeof scene !== 'undefined' && scene) {
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

      if (typeof renderer !== 'undefined' && renderer && typeof camera !== 'undefined' && camera) {
        renderer.render(scene, camera);
      }
    }
  }`;

html = html.replace(/setPreset\(name\) \{[\s\S]*?\n  \}/, bulletproofSetPresetCode);

// 3. Ensure button HTML uses window.toggleWeather() or window.WeatherSystem.toggle()
html = html.replace(
  'id="btnWeatherToggle" title="Toggle Sky Mode" onclick="if(window.WeatherSystem) WeatherSystem.toggle()"',
  'id="btnWeatherToggle" title="Toggle Sky Mode" onclick="if(window.WeatherSystem) window.WeatherSystem.toggle(); else if(window.toggleWeather) window.toggleWeather();"'
);

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Successfully refactored WeatherSystem.setPreset and hoisted window exports');
