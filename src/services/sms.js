import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import env, { isSmsConfigured } from '../config/env.js';

let client = null;
if (isSmsConfigured) {
  client = new SNSClient({
    region: env.aws.region,
    credentials: {
      accessKeyId: env.aws.accessKeyId,
      secretAccessKey: env.aws.secretAccessKey,
    },
  });
}

// Normalises Indian numbers to E.164: "98765 43210" / "098..." / "91..." → "+91...".
// Numbers already carrying a "+" are passed through untouched.
export function toE164India(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (/^0\d{10}$/.test(digits)) return `+91${digits.slice(1)}`;
  if (/^91\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  return digits ? `+${digits}` : '';
}

// Sends a transactional SMS via AWS SNS; without SMS_PROVIDER=sns it logs to
// the console instead (same dev pattern as mail) so flows remain testable.
// The DLT entity/template attributes route Indian traffic through the cheap
// local (DLT) route — without them AWS uses the pricey international route.
export async function sendSms(phone, message) {
  const to = toE164India(phone);
  if (!client) {
    console.log(`📱 [sms:dev] To: ${to || phone} | ${message}`);
    return { dev: true };
  }
  if (!to) throw new Error(`Cannot send SMS — invalid phone number: "${phone}"`);

  const MessageAttributes = {
    'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
  };
  if (env.sms.senderId) {
    MessageAttributes['AWS.SNS.SMS.SenderID'] = {
      DataType: 'String',
      StringValue: env.sms.senderId,
    };
  }
  if (env.sms.dltEntityId) {
    MessageAttributes['AWS.MM.SMS.EntityId'] = {
      DataType: 'String',
      StringValue: env.sms.dltEntityId,
    };
  }
  if (env.sms.dltTemplateId) {
    MessageAttributes['AWS.MM.SMS.TemplateId'] = {
      DataType: 'String',
      StringValue: env.sms.dltTemplateId,
    };
  }

  return client.send(
    new PublishCommand({ PhoneNumber: to, Message: message, MessageAttributes })
  );
}

export function otpSms(otp) {
  return env.sms.otpTemplate.replace('{#var#}', otp);
}

export { isSmsConfigured };
