// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'premart-api',
      script: './server.js',

      instances: process.env.NODE_ENV === 'production' ? 'max' : 1,
      exec_mode: process.env.NODE_ENV === 'production' ? 'cluster' : 'fork',

      // ── Environment ─────────────────────────────────────────────────
      env: {
        NODE_ENV: 'development',
        PORT: 3005,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3005,
      },

      // ── Restart policy ──────────────────────────────────────────────
      autorestart:     true,       
      watch:           false,       
      max_memory_restart: '500M',   
      restart_delay:   3000,       
      max_restarts:    10,          
      min_uptime:      '10s',      

      // ── Logging ─────────────────────────────────────────────────────
      out_file:        './logs/pm2-out.log',
      error_file:      './logs/pm2-error.log',
      merge_logs:      true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      // ── Graceful shutdown ───────────────────────────────────────────
      kill_timeout:    5000,        
      listen_timeout:  10000,       

      // ── Socket.IO cluster compatibility ─────────────────────────────
    }
  ]
};




// # Start the app first
// npm run pm2:start

// # Generate and install the startup script
// pm2 startup
// # ↑ This prints a command — copy and run it (it'll look like:)
// # sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

// # Save the current process list so it restores on reboot
// pm2 save