#!/usr/bin/env node
const { spawn } = require('child_process');

spawn('npx', ['@cursor-agency/tunnel', '--subdomain', 'hy-api', '--port', process.env.PORT || '4000'], {
	stdio: 'inherit',
	shell: true,
}).on('exit', (code) => process.exit(code));
