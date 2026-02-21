// scripts/restore.js
// Usage: node scripts/restore.js <s3-key>
// Example: node scripts/restore.js db-backups/backup-2026-02-21T02-00-00-000Z.gz
require('dotenv').config();
const { execSync } = require('child_process');
const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

const s3 = new S3Client({ region: process.env.AWS_REGION });

const downloadFromS3 = async (s3Key) => {
  const localPath = path.join(__dirname, '../backups', path.basename(s3Key));

  logger.info('restore: downloading backup from S3', { s3Key });

  const response = await s3.send(new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key:    s3Key,
  }));

  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(localPath);
    response.Body.pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  logger.info('restore: backup downloaded', { localPath });
  return localPath;
};

const listAvailableBackups = async () => {
  const response = await s3.send(new ListObjectsV2Command({
    Bucket: process.env.AWS_BUCKET_NAME,
    Prefix: 'db-backups/',
  }));

  if (!response.Contents?.length) {
    console.log('No backups found in S3.');
    return;
  }

  console.log('\nAvailable backups (newest first):');
  response.Contents
    .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
    .forEach(obj => {
      const sizeMB = (obj.Size / 1024 / 1024).toFixed(2);
      console.log(`  ${obj.Key}  [${sizeMB} MB]  ${obj.LastModified}`);
    });
  console.log('\nTo restore: node scripts/restore.js <key-from-above>\n');
};

const restore = async (s3Key) => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGO_URI not set');

  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const localPath = await downloadFromS3(s3Key);

  logger.info('restore: starting mongorestore', { s3Key });
  console.log('\n⚠️  This will OVERWRITE your current database. Ctrl+C to cancel. Starting in 5s...\n');

  await new Promise(r => setTimeout(r, 5000));

  execSync(
    `mongorestore --uri="${mongoUri}" --archive="${localPath}" --gzip --drop`,
    { stdio: 'inherit' }
  );

  fs.unlinkSync(localPath);
  logger.info('restore: completed successfully', { s3Key });
  console.log('\n✅ Restore complete.\n');
};

// ── CLI entry point ───────────────────────────────────────────────────────────
const s3Key = process.argv[2];
if (!s3Key) {
  listAvailableBackups().catch(console.error);
} else {
  restore(s3Key).catch(err => {
    logger.error('restore: failed', { error: err });
    console.error('❌ Restore failed:', err.message);
    process.exit(1);
  });
}
