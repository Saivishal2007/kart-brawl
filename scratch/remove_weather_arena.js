const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

console.log("=== REMOVING WEATHER & MULTI-ARENA TOGGLES & SYSTEMS ===");

// 1. Remove toggle buttons from HTML bottom navigation bar
html = html.replace(
  /<button class="kb-btn kb-btn-secondary" id="btnMapToggle"[^>]*>[\s\S]*?<\/button>\s*/i,
  ''
);
html = html.replace(
  /<button class="kb-btn kb-btn-secondary" id="btnWeatherToggle"[^>]*>[\s\S]*?<\/button>\s*/i,
  ''
);

// 2. Remove top window WeatherSystem/toggleWeather exports
html = html.replace(
  /window\.WeatherSystem = WeatherSystem;\s*window\.toggleWeather = function\(\) \{[\s\S]*?\};\s*/i,
  ''
);

// 3. Clean up initSkyEffects / WeatherSystem calls in lighting setup
html = html.replace(
  /\/\* ---------------- PHASE 1: DYNAMIC SKY & SPOTLIGHT SYSTEM ---------------- \*\/[\s\S]*?initSkyEffects\(\);/i,
  ''
);
html = html.replace(
  /if \(typeof WeatherSystem !== 'undefined'\) WeatherSystem\.setPreset\(localStorage\.getItem\('kb_sky_mode'\) \|\| 'DAY'\);/i,
  ''
);

// 4. Remove WeatherSystem, ArenaSystem, createLavaFloorTexture, createCyberFloorTexture definitions
const systemRemovalRegex = /\/\* ---------------- PHASE 1: DYNAMIC WEATHER[\s\S]*?\/\* ---------------- PHASE 7\.1: MULTI-ARENA MAP & ENVIRONMENT SYSTEM ---------------- \*\/[\s\S]*?const ArenaSystem = \{[\s\S]*?\n\};/i;

if (systemRemovalRegex.test(html)) {
  html = html.replace(systemRemovalRegex, '');
  console.log("Successfully removed WeatherSystem & ArenaSystem objects");
} else {
  // Alternative fallback cleanup if header comments differed slightly
  const altRegex = /const WeatherSystem = \{[\s\S]*?\n\};\s*const ArenaSystem = \{[\s\S]*?\n\};/i;
  if (altRegex.test(html)) {
    html = html.replace(altRegex, '');
    console.log("Successfully removed WeatherSystem & ArenaSystem via fallback regex");
  }
}

// Also remove createLavaFloorTexture and createCyberFloorTexture if remaining
html = html.replace(/function createLavaFloorTexture\(\) \{[\s\S]*?\n\}/g, '');
html = html.replace(/function createCyberFloorTexture\(\) \{[\s\S]*?\n\}/g, '');

// 5. Remove bottom exports and event listeners
html = html.replace(/window\.ArenaSystem = ArenaSystem;\s*/g, '');
html = html.replace(/window\.WeatherSystem = WeatherSystem;\s*/g, '');
html = html.replace(/const btnMapToggle = document\.getElementById\('btnMapToggle'\);[\s\S]*?if \(btnWeatherToggle\) btnWeatherToggle\.addEventListener\('click', \(\) => WeatherSystem\.toggle\(\)\);\s*/g, '');

// Save modified html
fs.writeFileSync(htmlPath, html, 'utf8');
console.log("client/index.html updated cleanly — all weather & multi-arena toggle code removed!");
