const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../client/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scripts = html.split('<script>');
const script3 = scripts[3] ? scripts[3].split('</script>')[0] : '';

console.log("=== WRAPPING SCRIPT 3 IN TRY-CATCH DIAGNOSTIC ===");

// We can inject try-catch wrappers around animate() and initSoloGame() in client/index.html!
// This will log any runtime error to console instead of crashing the WebGL render loop!

let modifiedHtml = html;

const safeAnimateWrapper = `
function animate() {
  requestAnimationFrame(animate);
  try {
    const dt = Math.min(clock.getDelta(), 0.1);
`;

if (html.includes('function animate() {\n  requestAnimationFrame(animate);\n\n  const dt = Math.min(clock.getDelta(), 0.1);')) {
  modifiedHtml = modifiedHtml.replace(
    'function animate() {\n  requestAnimationFrame(animate);\n\n  const dt = Math.min(clock.getDelta(), 0.1);',
    safeAnimateWrapper
  );
  // Add catch at the end of animate before closing brace
  modifiedHtml = modifiedHtml.replace(
    'renderer.render(scene, camera);\n}',
    'renderer.render(scene, camera);\n  } catch (err) {\n    console.error("CRITICAL ANIMATE ERROR:", err);\n  }\n}'
  );
  console.log("Successfully wrapped animate() in try-catch error handler!");
} else {
  console.log("Could not find exact animate signature in HTML");
}

fs.writeFileSync(htmlPath, modifiedHtml, 'utf8');
