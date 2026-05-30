// Thin S3 helper for the tracker: tier posters + nightly DB snapshots.
// Credentials/region/bucket come from env (server/.env locally, Render env in
// prod). Degrades gracefully: if S3 isn't configured the helpers no-op / throw
// a clear error, and the rest of the app keeps working.
const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const REGION = process.env.AWS_REGION || 'me-central-1';
const BUCKET = process.env.S3_BUCKET || '';

let client = null;

function getClient() {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !BUCKET) {
        return null;
    }
    if (!client) {
        client = new S3Client({
            region: REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });
    }
    return client;
}

// True when env is wired (lets callers skip S3 cleanly in dev/tests).
function isEnabled() {
    return !!getClient();
}

// Upload a Buffer/string to `key`. Returns the key on success.
async function uploadBuffer(key, body, contentType = 'application/octet-stream') {
    const c = getClient();
    if (!c) throw new Error('S3 not configured (missing AWS_* / S3_BUCKET env)');
    await c.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
    return key;
}

// Presigned GET URL so the private bucket can serve an object to the browser
// for a limited time. Returns null when S3 isn't configured.
async function getSignedGetUrl(key, expiresIn = 3600) {
    const c = getClient();
    if (!c || !key) return null;
    return getSignedUrl(c, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

// Presigned URL that forces a browser download with a friendly filename
// (S3 returns Content-Disposition: attachment). Works cross-origin without any
// CORS config because the browser navigates to it rather than fetching it.
async function getSignedDownloadUrl(key, filename, expiresIn = 3600) {
    const c = getClient();
    if (!c || !key) return null;
    const safe = String(filename || 'download').replace(/[^a-zA-Z0-9._-]/g, '_');
    return getSignedUrl(
        c,
        new GetObjectCommand({ Bucket: BUCKET, Key: key, ResponseContentDisposition: `attachment; filename="${safe}"` }),
        { expiresIn }
    );
}

// List objects under a prefix (used by the snapshot browser). Returns
// [{ key, size, lastModified }] sorted newest-first.
async function listObjects(prefix, max = 1000) {
    const c = getClient();
    if (!c) return [];
    const out = [];
    let token;
    do {
        const res = await c.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 }));
        for (const o of res.Contents || []) out.push({ key: o.Key, size: o.Size, lastModified: o.LastModified });
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token && out.length < max);
    return out.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
}

module.exports = { isEnabled, uploadBuffer, getSignedGetUrl, getSignedDownloadUrl, listObjects, BUCKET, REGION };
