import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendPasswordResetEmail(to: string, resetLink: string) {
    const fromEmail =
      process.env.MAIL_FROM || 'HisabWise <no-reply@minhazurrahman.me>';

    try {
      await this.resend.emails.send({
        from: fromEmail,
        to,
        subject: 'Reset your HisabWise password',
        text: `Reset your HisabWise password

          We received a request to reset the password on your HisabWise account. Use the link below to choose a new one. For your security, this link expires in 15 minutes.
          
          ${resetLink}
          
          If you didn't request a password reset, you can safely ignore this email.
          
          © ${new Date().getFullYear()} HisabWise`,
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="color-scheme" content="light dark" />
          <meta name="supported-color-schemes" content="light dark" />
          <title>Reset your password</title>
          <style>
            :root { color-scheme: light dark; supported-color-schemes: light dark; }
            .bg { background-color: #f4f4f5; }
            .card { background-color: #ffffff; border: 1px solid #e4e4e7; }
            .heading { color: #18181b; }
            .body-text { color: #52525b; }
            .footer-text { color: #71717a; }
            .divider { border-top: 1px solid #e4e4e7; }
            .badge { background-color: #ecfdf5; border: 1px solid #a7f3d0; }
            .badge-text { color: #047857; }
            .link { color: #059669; }
          
            @media (prefers-color-scheme: dark) {
              .bg { background-color: #09090b !important; }
              .card { background-color: #18181b !important; border-color: #27272a !important; }
              .heading { color: #fafafa !important; }
              .body-text { color: #a1a1aa !important; }
              .footer-text { color: #71717a !important; }
              .divider { border-color: #27272a !important; }
              .badge { background-color: #022c22 !important; border-color: #064e3b !important; }
              .badge-text { color: #34d399 !important; }
              .link { color: #34d399 !important; }
            }
          </style>
          </head>
          <body class="bg" style="margin:0; padding:0; -webkit-text-size-adjust:100%; text-size-adjust:100%;">
            <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
              Reset your HisabWise password — this link expires in 15 minutes.
            </div>
          
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="padding:40px 16px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          
                    <tr>
                      <td align="center" style="padding-bottom:28px;">
                        <span class="heading" style="font-size:20px; font-weight:700; letter-spacing:-0.02em; font-family:Arial, Helvetica, sans-serif;">
                          Hisab<span style="color:#10b981;">Wise</span>
                        </span>
                      </td>
                    </tr>
          
                    <tr>
                      <td class="card" style="border-radius:16px; padding:40px;">
          
                        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                          <tr>
                            <td class="badge" style="border-radius:999px; padding:6px 14px;">
                              <span class="badge-text" style="font-family:Arial, Helvetica, sans-serif; font-size:12px; font-weight:600;">
                                🔒 Account security
                              </span>
                            </td>
                          </tr>
                        </table>
          
                        <h1 class="heading" style="margin:0 0 12px 0; font-family:Arial, Helvetica, sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.02em;">
                          Reset your password
                        </h1>
          
                        <p class="body-text" style="margin:0 0 28px 0; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6;">
                          We received a request to reset the password on your HisabWise account. Click the button below to choose a new one. For your security, this link expires in 15 minutes.
                        </p>
          
                        <table role="presentation" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="border-radius:8px; background-color:#059669;">
                              <a href="${resetLink}" target="_blank" style="display:inline-block; padding:14px 32px; font-family:Arial, Helvetica, sans-serif; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">
                                Reset password
                              </a>
                            </td>
                          </tr>
                        </table>
          
                        <p class="footer-text" style="margin:24px 0 0 0; font-family:Arial, Helvetica, sans-serif; font-size:13px;">
                          ⏱ This link expires in 15 minutes.
                        </p>
          
                        <hr class="divider" style="margin:32px 0;" />
          
                        <p class="footer-text" style="margin:0 0 8px 0; font-family:Arial, Helvetica, sans-serif; font-size:12px;">
                          If the button above doesn't work, copy and paste this link into your browser:
                        </p>
                        <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:12px; word-break:break-all;">
                          <a href="${resetLink}" class="link" style="text-decoration:underline;">${resetLink}</a>
                        </p>
          
                      </td>
                    </tr>
          
                    <tr>
                      <td style="padding:28px 8px 0 8px;" align="center">
                        <p class="footer-text" style="margin:0 0 6px 0; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:1.6; text-align:center;">
                          If you didn't request a password reset, you can safely ignore this email.
                        </p>
                        <p class="footer-text" style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:12px; text-align:center;">
                          © ${new Date().getFullYear()} HisabWise. Your private financial workspace.
                        </p>
                      </td>
                    </tr>
          
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html> `,
      });
      this.logger.log(`Password reset email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
    }
  }
}
