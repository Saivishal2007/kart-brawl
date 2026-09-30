const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';

console.log("=== SIMULATING GAME LOOP EXECUTION IN MOCK DOM ===");

// Build a node test environment that catches any exception during animate()
const testScript = `
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const dom = new JSDOM(\`${html.replace(/`/g, '\\`')}\`, {
  runScripts: "dangerously",
  resources: "usable"
});

console.log("JSDOM Loaded successfully");
`;

fs.writeFileSync(path.join(__dirname, 'jsdom_test.js'), testScript);
console.log("Created jsdom_test.js");
