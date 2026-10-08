module.exports = {
  apps: [
    {
      name: "rzvpn",
      script: "server.js",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 20
    }
  ]
};
