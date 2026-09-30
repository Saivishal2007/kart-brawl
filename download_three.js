const https = require('https');
const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'client', 'three.min.js');
const url = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

console.log(`Downloading ${url} to ${targetPath}...`);

const file = fs.createWriteStream(targetPath);
https.get(url, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to download: status ${response.statusCode}`);
    return;
  }
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log(`✅ Successfully downloaded local three.min.js (${fs.statSync(targetPath).size} bytes)`);
  });
}).on('error', (err) => {
  fs.unlink(targetPath, () => {});
  console.error('❌ Download error:', err.message);
});
