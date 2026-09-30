const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'client', 'index.html'), 'utf8');
const lines = content.split('\n');

const targets = ['scene', 'sun', 'hemiLight', 'mombar', 'momText', 'superBadge', 'btnSuper', 'timerEl', 'stormlabel', 'domAbilEl', 'domWCardBox', 'domWIconEl', 'domWNameEl', 'domWAmmoEl', 'domSpeedoBar', 'domDriftBox', 'domSlotEl', 'domSlotText', 'domRespawnTimer', 'domCenterMsg'];

lines.forEach((line, idx) => {
  targets.forEach(target => {
    // Check if line assigns to target without let/const/var/function/param
    const regex = new RegExp(`^\\s*${target}\\s*=\\s*`);
    if (regex.test(line)) {
      console.log(`L${idx + 1}: ${line.trim()}`);
    }
  });
});
