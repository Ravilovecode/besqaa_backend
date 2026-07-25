import dotenv from 'dotenv';

dotenv.config();

const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigins: (process.env.CLIENT_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/besqaa',
  jwtSecret: process.env.JWT_SECRET || 'dev_insecure_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  seedAdmin: {
    name: process.env.SEED_ADMIN_NAME || 'Besqaa Admin',
    email: process.env.SEED_ADMIN_EMAIL || 'admin@besqaa.in',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
  },
  aws: {
    region: process.env.AWS_REGION || 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    bucket: process.env.S3_BUCKET || '',
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || '',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Besqaa <no-reply@besqaa.in>',
  },
  // 'ses' = send via Amazon SES using the AWS keys above; 'smtp' or empty = use
  // SMTP when configured, otherwise log to console (dev mode).
  mailProvider: (process.env.MAIL_PROVIDER || '').toLowerCase(),
  sms: {
    // 'sns' = send via AWS SNS; empty = log to console (dev mode).
    provider: (process.env.SMS_PROVIDER || '').toLowerCase(),
    senderId: process.env.SMS_SENDER_ID || '',
    // TRAI DLT registration (required for the cheap India local route).
    dltEntityId: process.env.SMS_DLT_ENTITY_ID || '',
    dltTemplateId: process.env.SMS_DLT_TEMPLATE_ID || '',
    // Must match the DLT-registered template word-for-word; {#var#} = the OTP.
    otpTemplate:
      process.env.SMS_OTP_TEMPLATE ||
      'Your Besqaa verification code is {#var#}. It is valid for 10 minutes. Do not share it with anyone.',
  },
};

export const isMailConfigured = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

export const isSesConfigured = Boolean(
  env.mailProvider === 'ses' && env.aws.accessKeyId && env.aws.secretAccessKey
);

export const isSmsConfigured = Boolean(
  env.sms.provider === 'sns' && env.aws.accessKeyId && env.aws.secretAccessKey
);

export const isS3Configured = Boolean(
  env.aws.accessKeyId && env.aws.secretAccessKey && env.aws.bucket
);

export default env;
