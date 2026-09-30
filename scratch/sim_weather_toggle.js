const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';

console.log("=== SIMULATING WeatherSystem.toggle() CALL ===");

// Check where WeatherSystem is defined
const wsIndex = script3.indexOf('const WeatherSystem =');
console.log("WeatherSystem index in script3:", wsIndex);

// Let's inspect WeatherSystem implementation
const wsBlock = script3.substring(wsIndex, wsIndex + 2500);
console.log(wsBlock.substring(0, 1000));
