const admin = require('firebase-admin');

function sanitizeBucketName(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  return value
    .trim()
    .replace(/^gs:\/\//i, '')
    .replace(/^https?:\/\/storage\.googleapis\.com\//i, '')
    .replace(/^https?:\/\/firebasestorage\.googleapis\.com\/v0\/b\//i, '')
    .replace(/\/.*$/, '')
    .replace(/\?.*$/, '');
}

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'advocacia-sistema-80239';

const defaultBucketName =
  sanitizeBucketName(process.env.FIREBASE_STORAGE_BUCKET) || `${projectId}.firebasestorage.app`;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: defaultBucketName
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { admin, db, bucket, projectId, defaultBucketName, sanitizeBucketName };
