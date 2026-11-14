import dotenv from 'dotenv';

dotenv.config();

const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  // Public origin of this API, used to build image URLs. Render sets
  // RENDER_EXTERNAL_URL automatically; PUBLIC_URL overrides it.
  publicUrl: (
    process.env.PUBLIC_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${process.env.PORT || 5000}`
  ).replace(/\/$/, ''),
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
  // Only needed for MAIL_PROVIDER=ses / SMS_PROVIDER=sns. Images are stored in
  // MongoDB (see services/images.js), not S3.
  aws: {
    region: process.env.AWS_REGION || 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Besqaa <no-reply@besqaa.in>',
  },
  // 'ses' = send via Amazon SES using the AWS keys above; 'twilio' / 'sendgrid'
  // / 'resend' / 'brevo' = send via that provider's HTTPS API; 'smtp' or empty
  // = use SMTP when configured, otherwise log to console (dev mode).
  mailProvider: (process.env.MAIL_PROVIDER || '').toLowerCase(),
  // One Twilio account serves both SMS (SMS_PROVIDER=twilio) and email
  // (MAIL_PROVIDER=twilio).
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    // SMS sender: a Twilio phone number (+1...) or a Messaging Service SID (MG...).
    smsFrom: process.env.TWILIO_FROM || '',
  },
  // HTTPS email APIs — these work on Render's free tier, which blocks
  // outbound SMTP ports (25/465/587).
  sendgridApiKey: process.env.SENDGRID_API_KEY || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  brevoApiKey: process.env.BREVO_API_KEY || '',
  sms: {
    // 'sns' = send via AWS SNS; 'twilio' = send via Twilio; empty = log to
    // console (dev mode).
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

export const isSmtpConfigured = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

export const isSesConfigured = Boolean(
  env.mailProvider === 'ses' && env.aws.accessKeyId && env.aws.secretAccessKey
);

export const isTwilioMailConfigured = Boolean(
  env.mailProvider === 'twilio' && env.twilio.accountSid && env.twilio.authToken
);

export const isSendgridConfigured = Boolean(env.mailProvider === 'sendgrid' && env.sendgridApiKey);

export const isResendConfigured = Boolean(env.mailProvider === 'resend' && env.resendApiKey);

export const isBrevoConfigured = Boolean(env.mailProvider === 'brevo' && env.brevoApiKey);

// The email provider actually in use; null = emails are logged to the console.
export const activeMailProvider =
  (isSesConfigured && 'ses') ||
  (isTwilioMailConfigured && 'twilio') ||
  (isSendgridConfigured && 'sendgrid') ||
  (isResendConfigured && 'resend') ||
  (isBrevoConfigured && 'brevo') ||
  (isSmtpConfigured && 'smtp') ||
  null;

export const isSnsConfigured = Boolean(
  env.sms.provider === 'sns' && env.aws.accessKeyId && env.aws.secretAccessKey
);

export const isTwilioSmsConfigured = Boolean(
  env.sms.provider === 'twilio' && env.twilio.accountSid && env.twilio.authToken && env.twilio.smsFrom
);

// The SMS provider actually in use; null = SMS is logged to the console.
export const activeSmsProvider = (isSnsConfigured && 'sns') || (isTwilioSmsConfigured && 'twilio') || null;

export const isSmsConfigured = Boolean(activeSmsProvider);

export default env;
