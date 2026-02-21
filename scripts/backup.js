// scripts/backup.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('../config/logger');

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BACKUP_DIR = path.join(__dirname, '../backups');
const S3_BACKUP_PREFIX = 'db-backups/';
const RETENTION_DAYS = 30; // keep 30 days of backups on S3

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Dump MongoDB to a local .gz file
// ─────────────────────────────────────────────────────────────────────────────
const createDump = () => {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const timestamp  = new Date().toISOString().replace(/[:.]/g, '-');
  const filename   = `backup-${timestamp}.gz`;
  const outputPath = path.join(BACKUP_DIR, filename);
  const mongoUri   = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) throw new Error('MONGO_URI env variable is not set');

  logger.info('backup: starting MongoDB dump', { filename });

  // mongodump streams directly to gzip — no intermediate uncompressed folder
  execSync(
    `mongodump --uri="${mongoUri}" --archive="${outputPath}" --gzip`,
    { stdio: 'pipe' }
  );

  const sizeBytes = fs.statSync(outputPath).size;
  logger.info('backup: dump created successfully', { filename, sizeBytes });

  return { filename, outputPath };
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: Upload the dump to S3
// ─────────────────────────────────────────────────────────────────────────────
const uploadToS3 = async (filename, outputPath) => {
  const fileStream = fs.createReadStream(outputPath);
  const s3Key = `${S3_BACKUP_PREFIX}${filename}`;

  logger.info('backup: uploading to S3', { s3Key });

  await s3.send(new PutObjectCommand({
    Bucket:      process.env.AWS_BUCKET_NAME,
    Key:         s3Key,
    Body:        fileStream,
    ContentType: 'application/gzip',
    // Server-side encryption for backup security
    ServerSideEncryption: 'AES256',
  }));

  logger.info('backup: uploaded to S3 successfully', { s3Key });
  return s3Key;
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: Delete local dump file after successful upload
// ─────────────────────────────────────────────────────────────────────────────
const cleanupLocal = (outputPath, filename) => {
  fs.unlinkSync(outputPath);
  logger.info('backup: local dump file deleted', { filename });
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4: Delete S3 backups older than RETENTION_DAYS
// ─────────────────────────────────────────────────────────────────────────────
const pruneOldBackups = async () => {
  logger.info('backup: pruning old S3 backups', { retentionDays: RETENTION_DAYS });

  const response = await s3.send(new ListObjectsV2Command({
    Bucket: process.env.AWS_BUCKET_NAME,
    Prefix: S3_BACKUP_PREFIX,
  }));

  if (!response.Contents || response.Contents.length === 0) {
    logger.info('backup: no old backups to prune');
    return;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const toDelete = response.Contents.filter(obj => new Date(obj.LastModified) < cutoff);

  if (toDelete.length === 0) {
    logger.info('backup: no backups older than retention window found');
    return;
  }

  for (const obj of toDelete) {
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key:    obj.Key,
    }));
    logger.info('backup: deleted old backup from S3', { key: obj.Key });
  }

  logger.info('backup: pruning complete', { deleted: toDelete.length });
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: Run full backup pipeline
// ─────────────────────────────────────────────────────────────────────────────
const runBackup = async () => {
  logger.info('backup: ── backup pipeline started ──');
  const startTime = Date.now();

  try {
    // 1. Dump
    const { filename, outputPath } = createDump();

    // 2. Upload
    const s3Key = await uploadToS3(filename, outputPath);

    // 3. Cleanup local
    cleanupLocal(outputPath, filename);

    // 4. Prune old backups
    await pruneOldBackups();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info('backup: ── backup pipeline completed ──', { s3Key, durationSeconds: duration });

    return { success: true, s3Key, duration };
  } catch (error) {
    logger.error('backup: pipeline failed', { error });

    // Best-effort cleanup of any partial local file
    try {
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.gz'));
      files.forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
    } catch (_) { /* ignore cleanup errors */ }

    return { success: false, error: error.message };
  }
};

module.exports = { runBackup };