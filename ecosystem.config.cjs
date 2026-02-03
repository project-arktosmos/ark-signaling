module.exports = {
  apps: [{
    name: 'ark-signaling',
    script: 'server/index.js',
    cwd: '/var/www/ark-signaling',
    env: {
      NODE_ENV: 'production',
      PORT: 6742
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: '500M'
  }]
};