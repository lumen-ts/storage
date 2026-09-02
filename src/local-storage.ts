import { mkdir, writeFile, readFile, unlink, readdir, stat } from 'fs/promises';
import { join, extname } from 'path';

/**
 * File storage interface — implement this for S3/GCS/Azure.
 */
export interface FileStorage {
  put(key: string, data: Buffer, metadata?: Record<string, string>): Promise<FileMetadata>;
  get(key: string): Promise<{ data: Buffer; metadata: FileMetadata } | undefined>;
  delete(key: string): Promise<boolean>;
  list(prefix?: string): Promise<FileMetadata[]>;
  getSignedUrl(key: string, expiresInMs?: number): Promise<string>;
}

/** File metadata. */
export interface FileMetadata {
  key: string;
  size: number;
  contentType?: string | undefined;
  lastModified: Date;
  metadata?: Record<string, string> | undefined;
}

/** Storage options. */
export interface StorageOptions {
  /** Base directory for file storage. Default './storage'. */
  basePath?: string;
  /** Base URL for signed URLs. Default 'http://localhost:3000'. */
  baseUrl?: string;
}

/**
 * Local file system storage.
 * Good for development; implement FileStorage for production (S3, GCS, etc.).
 *
 * @example
 * ```ts
 * const storage = new LocalStorage({ basePath: './uploads' });
 *
 * // Upload
 * await storage.put('avatars/user-1.jpg', imageBuffer, { contentType: 'image/jpeg' });
 *
 * // Download
 * const file = await storage.get('avatars/user-1.jpg');
 *
 * // List
 * const files = await storage.list('avatars/');
 *
 * // Signed URL
 * const url = await storage.getSignedUrl('avatars/user-1.jpg', 3600_000);
 * ```
 */
export class LocalStorage implements FileStorage {
  private readonly basePath: string;
  private readonly baseUrl: string;

  constructor(options: StorageOptions = {}) {
    this.basePath = options.basePath ?? './storage';
    this.baseUrl = options.baseUrl ?? 'http://localhost:3000';
  }

  private fullPath(key: string): string {
    return join(this.basePath, key);
  }

  async put(key: string, data: Buffer, metadata?: Record<string, string>): Promise<FileMetadata> {
    const fullPath = this.fullPath(key);
    const dir = join(fullPath, '..');
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, data);

    return {
      key,
      size: data.length,
      contentType: metadata?.contentType,
      lastModified: new Date(),
      metadata,
    };
  }

  async get(key: string): Promise<{ data: Buffer; metadata: FileMetadata } | undefined> {
    try {
      const fullPath = this.fullPath(key);
      const data = await readFile(fullPath);
      const stats = await stat(fullPath);

      return {
        data,
        metadata: {
          key,
          size: stats.size,
          lastModified: stats.mtime,
        },
      };
    } catch {
      return undefined;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await unlink(this.fullPath(key));
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix = ''): Promise<FileMetadata[]> {
    const dir = this.fullPath(prefix);
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const files: FileMetadata[] = [];

      for (const entry of entries) {
        if (entry.isFile()) {
          const key = join(prefix, entry.name);
          const stats = await stat(this.fullPath(key));
          files.push({
            key,
            size: stats.size,
            lastModified: stats.mtime,
          });
        }
      }

      return files;
    } catch {
      return [];
    }
  }

  async getSignedUrl(key: string, expiresInMs = 3600_000): Promise<string> {
    const expires = Date.now() + expiresInMs;
    const token = Buffer.from(JSON.stringify({ key, expires })).toString('base64');
    return `${this.baseUrl}/storage/${key}?token=${token}`;
  }
}
