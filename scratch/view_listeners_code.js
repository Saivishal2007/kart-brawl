const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';
const lines = script3.split('\n');

function printRange(start, end, label) {
  console.log(`\n--- ${label} (L${start} to L${end}) ---`);
  for (let i = start - 1; i < end && i < lines.length; i++) {
    console.log(`L${i + 1}: ${lines[i]}`);
  }
}

printRange(6410, 6515, 'Garage & Lobby Handlers');
printRange(6608, 6665, 'Settings Handlers');
