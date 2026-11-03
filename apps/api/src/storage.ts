import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";

/// Dosya deposu: production'da Cloudflare R2 (S3 uyumlu), yerelde disk (apps/api/.data).
export interface Storage {
  put(key: string, body: Uint8Array, contentType: string): Promise<string>; // public URL döner
}

const PUBLIC_URL = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
export const LOCAL_DIR = join(process.cwd(), ".data");

export const localStorage: Storage = {
  async put(key, body) {
    const path = join(LOCAL_DIR, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    return `${PUBLIC_URL}/files/${key}`;
  },
};

export async function readLocal(key: string): Promise<Buffer | null> {
  const path = normalize(join(LOCAL_DIR, key));
  if (!path.startsWith(LOCAL_DIR)) return null; // dizin dışına çıkma (../) engeli
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

async function r2Storage(): Promise<Storage> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  const bucket = process.env.R2_BUCKET!;
  const publicBase = process.env.R2_PUBLIC_URL!; // ör. https://cdn.example.com
  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      return `${publicBase}/${key}`;
    },
  };
}

export const useR2 = !!(process.env.R2_ACCOUNT_ID && process.env.R2_BUCKET && process.env.R2_PUBLIC_URL);
export const getStorage = (): Promise<Storage> => (useR2 ? r2Storage() : Promise.resolve(localStorage));
