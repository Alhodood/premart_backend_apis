// scripts/backupScheduler.js
const cron = require('node-cron');
const { runBackup } = require('./backup');
const logger = require('../config/logger');

const initBackupScheduler = () => {
  // ── Daily at 2:00 AM server time ──────────────────────────────────────────
  // Cron format: second(opt) minute hour day month weekday
  cron.schedule('0 2 * * *', async () => {
    logger.info('backupScheduler: daily backup triggered');
    const result = await runBackup();

    if (!result.success) {
      logger.error('backupScheduler: daily backup failed', { error: result.error });
      // TODO: hook in your alert service here (e.g. send email/Slack alert)
    }
  }, {
    timezone: 'Asia/Dubai' // UTC+4 — adjust to your server timezone
  });

  // ── Optional: Weekly backup on Sunday at 3:00 AM ─────────────────────────
  cron.schedule('0 3 * * 0', async () => {
    logger.info('backupScheduler: weekly backup triggered');
    await runBackup();
  }, {
    timezone: 'Asia/Dubai'
  });

  logger.info('backupScheduler: backup scheduler initialized', {
    schedule: 'daily at 02:00 + weekly Sunday at 03:00',
    timezone: 'Asia/Dubai'
  });
};

module.exports = { initBackupScheduler };