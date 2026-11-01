import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  constructor(private readonly config: ConfigService) {}

  async sendLoginCode(to: string, code: string) {
    const user = (this.config.get<string>('SMTP_USER') || '').trim();
    const pass = (this.config.get<string>('SMTP_PASS') || '').replace(/\s+/g, '');
    if (!user || !pass) {
      throw new ServiceUnavailableException("We couldn't send the verification code. Add the Gmail sender settings and try again.");
    }

    const transport = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST') || 'smtp.gmail.com',
      port: Number(this.config.get<string>('SMTP_PORT') || 587),
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      auth: { user, pass },
    });
    const intro = 'Your Nexora login code is below. Enter it on the verification page.';
    const note = 'This code expires in 10 minutes. If you did not try to sign in, you can ignore this email.';

    try {
      await transport.sendMail({
        from: this.config.get<string>('SMTP_FROM') || `Nexora <${user}>`,
        to,
        subject: 'Your Nexora verification code',
        text: `${intro}\n\n${code}\n\n${note}`,
        html: `<p>${intro}</p><p style="font-size:32px;letter-spacing:8px;font-weight:700;">${code}</p><p>${note}</p>`,
      });
    } catch (error) {
      console.error('Gmail rejected the login code message.');
      throw new ServiceUnavailableException(mailFailureMessage(error));
    }
  }
}

function mailFailureMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const responseCode = typeof error === 'object' && error && 'responseCode' in error ? Number(error.responseCode) : 0;
  if (code === 'EAUTH' || responseCode === 535) {
    return 'Gmail refused the sender login. Generate a new Google App Password, put it in SMTP_PASS, and try again.';
  }
  return "We couldn't send the verification code. Try again.";
}
