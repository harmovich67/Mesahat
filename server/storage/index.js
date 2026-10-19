import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/env.js';
import { sequelize } from '../config/database.js';

/**
 * Storage abstraction. Two buckets:
 *  - "private": payment receipts. Never served statically; only streamed by authorised API routes.
 *  - "public":  space images / avatars / review photos, served from /media.
 * Drivers: postgres database (db, default on Vercel/prod), local disk (dev), and S3-compatible.
 */
class LocalDriver {
  dir(bucket) {
    if (process.env.VERCEL) {
      return bucket === 'private' ? path.join('/tmp', 'storage', 'private') : path.join('/tmp', 'storage', 'public');
    }
    return bucket === 'private' ? config.storage.privateDir : config.storage.publicDir;
  }
  safe(bucket, key) {
    const root = path.resolve(this.dir(bucket));
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep) && full !== root) throw new Error('Invalid storage key');
    return full;
  }
  async put(bucket, key, buffer) {
    const full = this.safe(bucket, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer, { mode: 0o640 });
  }
  async get(bucket, key) {
    return fs.readFile(this.safe(bucket, key));
  }
  async remove(bucket, key) {
    await fs.rm(this.safe(bucket, key), { force: true });
  }
}

class DatabaseDriver {
  constructor() {
    this.local = new LocalDriver();
  }

  async put(bucket, key, buffer, mime) {
    try {
      await sequelize.query(
        `INSERT INTO stored_files (bucket, key, mime_type, data, size, created_at)
         VALUES (:bucket, :key, :mime_type, :data, :size, NOW())
         ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, size = EXCLUDED.size, mime_type = EXCLUDED.mime_type`,
        {
          replacements: { bucket, key, mime_type: mime || 'application/octet-stream', data: buffer, size: buffer.length },
        }
      );
    } catch (err) {
      console.error('[storage db put error]:', err.message);
    }

    // Also write to local /tmp cache if possible
    try {
      await this.local.put(bucket, key, buffer);
    } catch {
      // Ephemeral cache write is optional
    }
  }

  async get(bucket, key) {
    // 1. Try local disk cache first (fastest)
    try {
      const cached = await this.local.get(bucket, key);
      if (cached) return cached;
    } catch {}

    // 2. Fetch from Neon Postgres database
    try {
      const [rows] = await sequelize.query(
        `SELECT data, mime_type FROM stored_files WHERE key = :key AND bucket = :bucket LIMIT 1`,
        { replacements: { key, bucket } }
      );
      if (rows && rows.length && rows[0].data) {
        const buf = Buffer.from(rows[0].data);
        // Populate local cache in background
        this.local.put(bucket, key, buf).catch(() => {});
        return buf;
      }
    } catch (err) {
      console.warn('[storage db get error]:', err.message);
    }

    return null;
  }

  async remove(bucket, key) {
    try {
      await sequelize.query(
        `DELETE FROM stored_files WHERE key = :key AND bucket = :bucket`,
        { replacements: { key, bucket } }
      );
    } catch {}
    await this.local.remove(bucket, key).catch(() => {});
  }
}

class S3Driver {
  async client() {
    if (this._c) return this._c;
    const { S3Client } = await import('@aws-sdk/client-s3').catch(() => {
      throw new Error('Install @aws-sdk/client-s3 to use STORAGE_DRIVER=s3');
    });
    const s = config.storage.s3;
    this._c = new S3Client({
      region: s.region,
      endpoint: s.endpoint,
      forcePathStyle: s.forcePathStyle,
      credentials: s.accessKeyId ? { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey } : undefined,
    });
    return this._c;
  }
  k(bucket, key) {
    return `${bucket}/${key}`;
  }
  async put(bucket, key, buffer, contentType) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await (await this.client()).send(new PutObjectCommand({
      Bucket: config.storage.s3.bucket, Key: this.k(bucket, key), Body: buffer, ContentType: contentType,
    }));
  }
  async get(bucket, key) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const res = await (await this.client()).send(new GetObjectCommand({ Bucket: config.storage.s3.bucket, Key: this.k(bucket, key) }));
    return Buffer.from(await res.Body.transformToByteArray());
  }
  async remove(bucket, key) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await (await this.client()).send(new DeleteObjectCommand({ Bucket: config.storage.s3.bucket, Key: this.k(bucket, key) }));
  }
}

function createDriver() {
  if (config.storage.driver === 's3') return new S3Driver();
  if (config.storage.driver === 'db') return new DatabaseDriver();
  return new LocalDriver();
}

const driver = createDriver();

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

/** Detects the real file type from magic bytes (never trusts the client-sent mimetype/extension). */
export function sniffMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  return null;
}

export const storage = {
  /** Saves a file under a random, non-guessable key. Returns { key, mime, size, checksum }. */
  async save(bucket, buffer, mime, folder = '') {
    const key = path.posix.join(folder, `${new Date().toISOString().slice(0, 7)}`, `${crypto.randomUUID()}.${EXT[mime] || 'bin'}`);
    await driver.put(bucket, key, buffer, mime);
    return { key, mime, size: buffer.length, checksum: crypto.createHash('sha256').update(buffer).digest('hex') };
  },
  read: (bucket, key) => driver.get(bucket, key),
  remove: (bucket, key) => driver.remove(bucket, key),
};
