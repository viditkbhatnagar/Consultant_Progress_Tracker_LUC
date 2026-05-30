// Nightly full-database snapshot to S3. Dumps every (non-system) collection as
// gzipped JSON under db-snapshots/YYYY-MM-DD/, plus a _manifest.json with
// counts. Date-structured so the admin can browse/restore a given day.
//
// Read-only on Mongo (find {} per collection). Sized for this app (a few
// thousand docs); for a much larger DB this should stream instead of toArray.
const zlib = require('zlib');
const mongoose = require('mongoose');
const s3 = require('./s3');

async function runDbSnapshot() {
    if (!s3.isEnabled()) {
        console.warn('[db-snapshot] S3 not configured (AWS_*/S3_BUCKET) — skipping');
        return { skipped: true };
    }
    const conn = mongoose.connection;
    if (!conn || conn.readyState !== 1) throw new Error('Mongo not connected');

    const now = new Date();
    const stamp = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const prefix = `db-snapshots/${stamp}`;
    const collections = await conn.db.listCollections().toArray();

    const manifest = {
        startedAt: now.toISOString(),
        database: conn.name,
        bucket: s3.BUCKET,
        prefix,
        collections: [],
    };

    for (const c of collections) {
        const name = c.name;
        if (name.startsWith('system.')) continue;
        const docs = await conn.db.collection(name).find({}).toArray();
        const gz = zlib.gzipSync(Buffer.from(JSON.stringify(docs)));
        const key = `${prefix}/${name}.json.gz`;
        await s3.uploadBuffer(key, gz, 'application/gzip');
        manifest.collections.push({ name, count: docs.length, bytes: gz.length, key });
    }

    manifest.finishedAt = new Date().toISOString();
    manifest.totalDocs = manifest.collections.reduce((s, c) => s + c.count, 0);
    manifest.totalBytes = manifest.collections.reduce((s, c) => s + c.bytes, 0);
    await s3.uploadBuffer(`${prefix}/_manifest.json`, Buffer.from(JSON.stringify(manifest, null, 2)), 'application/json');

    console.log(`[db-snapshot] ${manifest.collections.length} collections · ${manifest.totalDocs} docs · ${(manifest.totalBytes / 1024).toFixed(0)}KB gz -> s3://${s3.BUCKET}/${prefix}/`);
    return manifest;
}

module.exports = { runDbSnapshot };
