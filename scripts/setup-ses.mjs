// One-shot SES setup + verification helper.
//
//   node scripts/setup-ses.mjs           → create identities, show status + DNS records
//   node scripts/setup-ses.mjs test you@example.com  → send a test email
//
// Prereq: the IAM user in .env needs SES permissions (e.g. AmazonSESFullAccess).
import 'dotenv/config';
import {
  SESv2Client,
  GetAccountCommand,
  GetEmailIdentityCommand,
  CreateEmailIdentityCommand,
  SendEmailCommand,
} from '@aws-sdk/client-sesv2';

const DOMAIN = 'besqaa.in';
// Sandbox testing: this address is verified as both sender and recipient so
// you can receive real OTP emails before the domain DNS / production access.
const TEST_EMAIL = 'besqaa4india@gmail.com';

const client = new SESv2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function ensureIdentity(name) {
  try {
    return await client.send(new GetEmailIdentityCommand({ EmailIdentity: name }));
  } catch (e) {
    if (e.name !== 'NotFoundException') throw e;
    await client.send(new CreateEmailIdentityCommand({ EmailIdentity: name }));
    console.log(`➕ Created identity: ${name}`);
    return client.send(new GetEmailIdentityCommand({ EmailIdentity: name }));
  }
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);

  if (cmd === 'test') {
    const to = arg || TEST_EMAIL;
    const res = await client.send(
      new SendEmailCommand({
        FromEmailAddress: process.env.MAIL_FROM || TEST_EMAIL,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: '✅ Besqaa SES test — it works!' },
            Body: { Html: { Data: '<h2>SES is live 🎉</h2><p>OTP emails from the Besqaa backend will now be delivered.</p>' } },
          },
        },
      })
    );
    console.log(`✅ Test email sent to ${to} (MessageId: ${res.MessageId})`);
    return;
  }

  const acct = await client.send(new GetAccountCommand({}));
  console.log(`\n— SES account (${process.env.AWS_REGION}) —`);
  console.log(`  Production access : ${acct.ProductionAccessEnabled ? 'YES' : 'NO (sandbox — can only email verified addresses)'}`);
  console.log(`  Sending enabled   : ${acct.SendingEnabled}`);
  console.log(`  24h quota         : ${acct.SendQuota?.SentLast24Hours}/${acct.SendQuota?.Max24HourSend}`);

  console.log(`\n— Identities —`);
  const email = await ensureIdentity(TEST_EMAIL);
  console.log(`  ${TEST_EMAIL}: ${email.VerifiedForSendingStatus ? '✅ verified' : '⏳ pending — click the link AWS emailed to this address'}`);

  const domain = await ensureIdentity(DOMAIN);
  console.log(`  ${DOMAIN}: ${domain.VerifiedForSendingStatus ? '✅ verified' : '⏳ pending — add the DNS records below'}`);
  const tokens = domain.DkimAttributes?.Tokens || [];
  if (!domain.VerifiedForSendingStatus && tokens.length) {
    console.log(`\n  Add these 3 CNAME records to ${DOMAIN}'s DNS (DKIM verification):`);
    for (const t of tokens) {
      console.log(`    ${t}._domainkey.${DOMAIN}  CNAME  ${t}.dkim.amazonses.com`);
    }
  }

  console.log(`\nNext: once an identity shows ✅, run  node scripts/setup-ses.mjs test  to receive a test email.`);
}

main().catch((e) => {
  console.error(`❌ ${e.name}: ${e.message}`);
  if (e.name === 'AccessDeniedException') {
    console.error('\nThe IAM user "besqaa-server" still lacks SES permissions.');
    console.error('AWS console → IAM → Users → besqaa-server → Add permissions → attach "AmazonSESFullAccess".');
  }
  process.exit(1);
});
