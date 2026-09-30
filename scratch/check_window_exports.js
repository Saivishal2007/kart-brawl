const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';

console.log("=== CHECKING ALL WINDOW ASSIGNMENTS IN SCRIPT 3 ===");
const windowAssignments = script3.match(/window\.\w+\s*=/g) || [];
console.log([...new Set(windowAssignments)]);
