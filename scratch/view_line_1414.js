const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const lines = html.split('\n');

console.log("Line 1414:");
console.log(lines[1413]);
