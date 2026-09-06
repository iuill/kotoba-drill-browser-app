const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const configFile = path.join(os.homedir(), '.claude.json');
const config = fs.existsSync(configFile)
  ? JSON.parse(fs.readFileSync(configFile, 'utf8'))
  : {};
config.hasCompletedOnboarding = true;
fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
fs.chmodSync(configFile, 0o600);
