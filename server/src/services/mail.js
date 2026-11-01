const nodemailer = require('nodemailer');
const { httpError } = require('../lib/http');

function mailAccount() {
  return (process.env.SMTP_USER || '').trim();
}

function mailPassword() {
  return (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').replace(/\s+/g, '');
}

function transport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: mailAccount(),
      pass: mailPassword(),
    },
  });
}

function codeMessage(intro, code) {
  const text = `${intro}\n\n${code}\n\nThis code expires in 10 minutes. If you did not try to sign in, you can ignore this email.`;
  const html = `<p>${intro}</p><p style="font-size:32px;letter-spacing:8px;font-weight:700;">${code}</p><p>This code expires in 10 minutes. If you did not try to sign in, you can ignore this email.</p>`;
  return { text, html };
}

async function deliver({ to, subject, text, html }) {
  if (mailAccount() && mailPassword()) {
    try {
      await transport().sendMail({
        from: process.env.SMTP_FROM || `Nexora <${mailAccount()}>`,
        to,
        subject,
        text,
        html,
      });
    } catch (error) {
      console.error(`Gmail rejected the message to ${to}: ${error.message}`);
      throw httpError(503, 'Gmail refused the sender login. Generate a new Google App Password, put it in SMTP_PASS, and try again.');
    }
    return;
  }
  if (process.env.NODE_ENV === 'production') {
    throw httpError(500, "We couldn't send the verification code. Try again.");
  }
  console.info(`[nexora-mail] ${subject} -> ${to}. Add SMTP_USER and SMTP_PASS to send through Gmail.`);
}

function sendLoginCode(to, code) {
  const message = codeMessage('Your Nexora login code is below. Enter it on the verification page.', code);
  return deliver({
    to,
    subject: 'Your Nexora verification code',
    ...message,
  });
}

function sendResetCode(to, code) {
  const message = codeMessage('Your Nexora password reset code is below.', code);
  return deliver({
    to,
    subject: 'Reset your Nexora password',
    ...message,
  });
}

module.exports = { sendLoginCode, sendResetCode };
