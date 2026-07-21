import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { nanoid } from 'nanoid';
import env, { isS3Configured } from '../config/env.js';

let client = null;
if (isS3Configured) {
  client = new S3Client({
    region: env.aws.region,
    credentials: {
      accessKeyId: env.aws.accessKeyId,
      secretAccessKey: env.aws.secretAccessKey,
    },
  });
}

function publicUrl(key) {
  if (env.aws.publicBaseUrl) {
    return `${env.aws.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }
  return `https://${env.aws.bucket}.s3.${env.aws.region}.amazonaws.com/${key}`;
}

// Uploads a single in-memory file (from multer memoryStorage) to S3 and returns
// its public URL. Throws a clear error if S3 isn't configured yet.
export async function uploadBufferToS3(file, folder = 'products') {
  if (!isS3Configured || !client) {
    throw new Error(
      'S3 is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and S3_BUCKET in server/.env'
    );
  }
  const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase();
  const key = `${folder}/${Date.now()}-${nanoid(8)}.${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: env.aws.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return { key, url: publicUrl(key) };
}

export async function deleteFromS3(key) {
  if (!isS3Configured || !client || !key) return;
  await client.send(new DeleteObjectCommand({ Bucket: env.aws.bucket, Key: key }));
}

export { isS3Configured };
