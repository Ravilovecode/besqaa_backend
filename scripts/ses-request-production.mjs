// One-shot: request SES production access (exit the sandbox).
//   node scripts/ses-request-production.mjs
// Status afterwards: node scripts/setup-ses.mjs  (shows "Production access: YES" once approved)
import 'dotenv/config';
import { SESv2Client, PutAccountDetailsCommand } from '@aws-sdk/client-sesv2';

const client = new SESv2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const res = await client.send(
  new PutAccountDetailsCommand({
    ProductionAccessEnabled: true,
    MailType: 'TRANSACTIONAL',
    WebsiteURL: 'https://besqaa.in',
    ContactLanguage: 'EN',
    AdditionalContactEmailAddresses: ['help@besqaa.in'],
    UseCaseDescription:
      'Besqaa (besqaa.in) is an e-commerce mobile app for Indian customers. ' +
      'We send transactional emails only: one-time password (OTP) login codes and order confirmations. ' +
      'Recipients are customers who explicitly sign up in our app with their email address — no marketing or bulk mail. ' +
      'Expected volume is low (well under 200 emails/day initially). ' +
      'The sending domain besqaa.in is DKIM-verified. Bounces and complaints are monitored via the SES console, ' +
      'and addresses that hard-bounce or complain are removed from our user notification flow.',
  })
);
console.log('✅ Production access request submitted to AWS.');
console.log('   AWS review usually completes within 24 hours; watch help@besqaa.in and the AWS account root email for their reply.');
console.log('   Check status anytime with: node scripts/setup-ses.mjs');
