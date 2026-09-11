const fs = require('fs');
const path = require('path');
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'tasks.db');
const LOCK_KEY = process.env.S3_LOCK_KEY || 'tasks.lock.json';
const DB_KEY = process.env.S3_DB_KEY || 'tasks.db';
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const CONTAINER_ID = `${process.pid}-${Date.now()}`;

function normalizeEndpoint(endpoint) {
  if (!endpoint) return endpoint;
  return /^[a-z][a-z\d+.-]*:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`;
}

let lockHeld = false;

const cloudStorageEnabled = Boolean(
  BUCKET_NAME &&
  process.env.S3_ENDPOINT &&
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY,
);

const S3_ENDPOINT = normalizeEndpoint(process.env.S3_ENDPOINT);

const s3 = cloudStorageEnabled
  ? new S3Client({
      region: process.env.AWS_REGION || 'us-east-005',
  endpoint: S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })
  : null;

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function acquireLock() {
  if (!cloudStorageEnabled) return;

  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: LOCK_KEY }));
    throw new Error('Another application instance currently owns the database lock');
  } catch (error) {
    if (error.name !== 'NotFound' && error.$metadata?.httpStatusCode !== 404) throw error;
  }

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: LOCK_KEY,
    Body: JSON.stringify({ containerId: CONTAINER_ID, acquiredAt: new Date().toISOString() }),
    ContentType: 'application/json',
  }));
  lockHeld = true;
}

async function releaseLock() {
  if (!cloudStorageEnabled || !lockHeld) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: LOCK_KEY }));
  } finally {
    lockHeld = false;
  }
}

async function initDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!cloudStorageEnabled) {
    console.log('Cloud database sync disabled; using local persistent storage.');
    return;
  }

  await acquireLock();
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: DB_KEY }));
    fs.writeFileSync(DB_PATH, await streamToBuffer(result.Body));
    console.log('Database restored from object storage.');
  } catch (error) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      console.log('No cloud database found; initializing from local data or schema.');
      return;
    }
    await releaseLock();
    throw error;
  }
}

async function backupDatabase() {
  if (!cloudStorageEnabled || !fs.existsSync(DB_PATH)) return;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: DB_KEY,
    Body: fs.readFileSync(DB_PATH),
    ContentType: 'application/octet-stream',
  }));
  console.log('Database backed up to object storage.');
}

module.exports = { initDatabase, backupDatabase, releaseLock };
