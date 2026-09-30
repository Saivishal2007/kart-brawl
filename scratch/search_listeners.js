const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';

console.log("=== SEARCHING FOR EVENT LISTENERS / BUTTON ID REFERENCES IN SCRIPT 3 ===");
const idRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
let match;
const ids = new Set();
while ((match = idRegex.exec(script3)) !== null) {
  ids.add(match[1]);
}
console.log("IDs accessed via getElementById:", [...ids]);

const addEventListenerMatches = script3.match(/[\w$]+\.addEventListener\(['"]click['"],\s*([^)]+)\)/g) || [];
console.log("\nClick addEventListener calls:", addEventListenerMatches.length);
addEventListenerMatches.forEach(m => console.log("  ", m));

const onClickAssignments = script3.match(/[\w$]+\.onclick\s*=/g) || [];
console.log("\nOnclick assignments:", onClickAssignments.length);
onClickAssignments.forEach(m => console.log("  ", m));
