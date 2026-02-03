module.exports = {
  apps: [{
    name: 'ark-signaling',
    script: 'server/index.js',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      PORT: 6742
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: '400M'
  }]
};