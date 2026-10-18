import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/env.js';

/**
 * Storage abstraction. Two buckets:
 *  - "private": payment receipts. Never served statically; only streamed by authorised API routes.
 *  - "public":  space images / avatars / review photos, served from /media.
 * Drivers: local disk (dev) and S3-compatible (prod). Add more by implementing the same interface.
 */
class LocalDriver {
  dir(bucket) {
    return bucket === 'private' ? config.storage.privateDir : config.storage.publicDir;
  }
  safe(bucket, key) {
    const root = path.resolve(this.dir(bucket));
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error('Invalid storage key');
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
  // private and public use key prefixes in one bucket; configure bucket policy so only public/ is readable.
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

const driver = config.storage.driver === 's3' ? new S3Driver() : new LocalDriver();

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

/** Detects the real file type from magic bytes (never trusts the client-sent mimetype/extension). */
export function sniffMime(buf) {
  if (buf.length < 12) return null;
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
