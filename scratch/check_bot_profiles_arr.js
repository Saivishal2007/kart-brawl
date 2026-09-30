const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';
const lines = script3.split('\n');

console.log("=== INSPECTING BOT_PROFILES ARRAY IN SCRIPT 3 ===");
lines.forEach((line, idx) => {
  if (line.includes('const BOT_PROFILES =')) {
    for (let i = idx; i < idx + 20; i++) {
      console.log(`L${i+1}: ${lines[i]}`);
    }
  }
});
