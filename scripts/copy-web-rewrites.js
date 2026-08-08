const { copyFileSync } = require('node:fs');
const { resolve } = require('node:path');

copyFileSync(resolve('.htaccess'), resolve('dist/.htaccess'));
