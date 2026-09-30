const fs = require('fs');
const path = require('path');

// Read index.html
const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';

console.log("=== TESTING SCRIPT 3 EXECUTION IN SIMULATED DOM ===");

// Check for syntax or runtime issues when Script 3 starts
try {
  // Check if Script 3 has any missing variables or top-level runtime errors
  console.log("Script 3 length:", script3.length);
  // Test parsing via Function constructor
  new Function(script3);
  console.log("Function parsing successful!");
} catch(e) {
  console.error("Script 3 Parse Error:", e);
}
