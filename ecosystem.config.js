module.exports = {
  apps: [
    {
      name: 'squat-ms-bot',
      script: 'index.js',
      // PENTING: Harus 1 instance karena GrammY menggunakan Long Polling
      // (Mencegah error 409 Conflict getUpdates Telegram)
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
