const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';
const lines = script3.split('\n');

console.log("=== CHECKING WEATHER SYSTEM CALLS & SCENE OVERWRITES ===");

lines.forEach((line, idx) => {
  if (line.includes('scene.background') || line.includes('setPreset') || line.includes('toggleWeather') || line.includes('btnWeatherToggle')) {
    console.log(`L${idx+1}: ${line.trim().substring(0, 120)}`);
  }
});
