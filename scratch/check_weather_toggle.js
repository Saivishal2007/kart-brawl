const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const lines = html.split('\n');

console.log("=== SEARCHING FOR btnWeatherToggle IN HTML ===");
lines.forEach((line, idx) => {
  if (line.includes('btnWeatherToggle') || line.includes('WeatherSystem')) {
    console.log(`L${idx+1}: ${line.trim().substring(0, 130)}`);
  }
});
