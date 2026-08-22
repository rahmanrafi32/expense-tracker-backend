import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Prisma } from '@prisma/client';
import dayjs from 'dayjs';

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
  previewText?: string;
}

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly projectLogo: Buffer;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);

    this.fromEmail =
      process.env.MAIL_FROM || 'HisabWise <no-reply@minhazurrahman.me>';

    this.projectLogo = readFileSync(
      join(process.cwd(), 'src/assets/project-logo.png'),
    );
  }

  private async sendEmail({
    to,
    subject,
    text,
    html,
    previewText,
  }: SendEmailOptions): Promise<void> {
    const finalHtml = previewText
      ? html.replace(
          '<body',
          `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${previewText}</div><body`,
        )
      : html;

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        text,
        html: finalHtml,
        attachments: [
          {
            filename: 'project-logo.png',
            content: this.projectLogo,
            contentId: 'project-logo',
          },
        ],
      });

      this.logger.log(`Email sent successfully to ${to}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send email to ${to}`,
        error instanceof Error ? error.stack : JSON.stringify(error),
      );

      throw error;
    }
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Reset your HisabWise password',
      previewText:
        'Reset your HisabWise password — this link expires in 15 minutes.',
      text: `
Reset your HisabWise password

We received a request to reset the password on your HisabWise account. Use the link below to choose a new one. For your security, this link expires in 15 minutes.

${resetLink}

If you didn't request a password reset, you can safely ignore this email.

© ${dayjs().year()} HisabWise
      `.trim(),
      html: this.buildEmailLayout({
        badge: '🔒 Account security',
        heading: 'Reset your password',
        content: `
          <p class="body-text" style="margin:0 0 28px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;">
            We received a request to reset the password on your HisabWise account. Click the button below to choose a new one. For your security, this link expires in 15 minutes.
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="border-radius:8px;background-color:#059669;">
                <a
                  href="${resetLink}"
                  target="_blank"
                  style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;"
                >
                  Reset password
                </a>
              </td>
            </tr>
          </table>

          <p class="footer-text" style="margin:24px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;">
            ⏱ This link expires in 15 minutes.
          </p>

          <hr class="divider" style="margin:32px 0;" />

          <p class="footer-text" style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;">
            If the button above doesn't work, copy and paste this link into your browser:
          </p>

          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;word-break:break-all;">
            <a href="${resetLink}" class="link" style="text-decoration:underline;">
              ${resetLink}
            </a>
          </p>
        `,
        footer:
          "If you didn't request a password reset, you can safely ignore this email.",
      }),
    });
  }

  async sendRecurringPaymentReminder({
    to,
    firstName,
    payments,
  }: {
    to: string;
    firstName: string;
    payments: {
      name: string;
      amount: Prisma.Decimal;
      dueDate: Date;
      daysUntilDue: number;
    }[];
  }): Promise<void> {
    const totalAmount = payments.reduce(
      (total, payment) => total.add(payment.amount),
      new Prisma.Decimal(0),
    );

    const paymentCount = payments.length;

    const todayCount = payments.filter(
      (payment) => payment.daysUntilDue === 0,
    ).length;

    const tomorrowCount = payments.filter(
      (payment) => payment.daysUntilDue === 1,
    ).length;

    const sevenDayCount = payments.filter(
      (payment) => payment.daysUntilDue === 7,
    ).length;

    const summaryParts: string[] = [];

    if (todayCount > 0) {
      summaryParts.push(`${todayCount} due today`);
    }

    if (tomorrowCount > 0) {
      summaryParts.push(`${tomorrowCount} due tomorrow`);
    }

    if (sevenDayCount > 0) {
      summaryParts.push(`${sevenDayCount} due in 7 days`);
    }

    const summary = summaryParts.join(', ');

    const subject =
      paymentCount === 1
        ? `You have 1 upcoming payment`
        : `You have ${paymentCount} upcoming payments`;

    const heading =
      paymentCount === 1 ? 'Upcoming payment' : 'Upcoming payments';

    const message =
      paymentCount === 1
        ? `You have 1 recurring payment coming up.`
        : `You have ${paymentCount} recurring payments coming up.`;

    const paymentRows = [...payments]
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
      .map((payment) => {
        const formattedAmount = payment.amount.toFixed(2);

        const formattedDate = payment.dueDate.toLocaleDateString('en-BD', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });

        const status =
          payment.daysUntilDue <= 0
            ? {
                label: payment.daysUntilDue < 0 ? 'Overdue' : 'Due today',
                backgroundColor: '#fff1f2',
                borderColor: '#fecdd3',
                textColor: '#ef4444',
              }
            : payment.daysUntilDue === 1
              ? {
                  label: 'Due tomorrow',
                  backgroundColor: '#fffbeb',
                  borderColor: '#fde68a',
                  textColor: '#d97706',
                }
              : {
                  label: `Due in ${payment.daysUntilDue} days`,
                  backgroundColor: '#ecfdf5',
                  borderColor: '#a7f3d0',
                  textColor: '#059669',
                };

        return `
        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          style="
            margin:0 0 10px 0;
            border:1px solid ${status.borderColor};
            border-radius:14px;
            background-color:${status.backgroundColor};
          "
        >
          <tr>
            <td
              valign="middle"
              style="padding:16px;"
            >
              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
              >
                <tr>
                  <td
                    valign="middle"
                    style="
                      font-family:Arial,Helvetica,sans-serif;
                      white-space:nowrap;
                    "
                  >
                    <span
                      style="
                        font-size:15px;
                        font-weight:700;
                        color:#18181b;
                      "
                    >
                      ${payment.name}
                    </span>

                    <span
                      style="
                        margin-left:8px;
                        font-size:12px;
                        color:#71717a;
                      "
                    >
                      ${formattedDate}
                    </span>

                    <span
                      style="
                        display:inline-block;
                        margin-left:8px;
                        padding:3px 8px;
                        border-radius:999px;
                        background-color:#ffffff;
                        border:1px solid ${status.borderColor};
                        color:${status.textColor};
                        font-size:11px;
                        font-weight:600;
                        line-height:14px;
                      "
                    >
                      ${status.label}
                    </span>
                  </td>

                  <td
                    align="right"
                    valign="middle"
                    style="
                      padding-left:16px;
                      white-space:nowrap;
                    "
                  >
                    <span
                      style="
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:16px;
                        font-weight:700;
                        line-height:22px;
                        color:${status.textColor};
                      "
                    >
                      ${formattedAmount}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;
      })
      .join('');

    const formattedTotal = totalAmount.toFixed(2);

    const textPayments = [...payments]
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
      .map((payment) => {
        const formattedDate = payment.dueDate.toLocaleDateString('en-BD', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        const status =
          payment.daysUntilDue < 0
            ? 'Overdue'
            : payment.daysUntilDue === 0
              ? 'Due today'
              : payment.daysUntilDue === 1
                ? 'Due tomorrow'
                : `Due in ${payment.daysUntilDue} days`;

        return `${payment.name} — ${payment.amount.toFixed(
          2,
        )} — ${formattedDate} — ${status}`;
      })
      .join('\n');

    const text = `
Hi ${firstName},

${message}

${textPayments}

Total upcoming: ${formattedTotal}

Open HisabWise to review your upcoming payments and cash flow.

© ${dayjs().year()} HisabWise
  `.trim();

    await this.sendEmail({
      to,
      subject,
      previewText: `${message} ${summary}.`,
      text,
      html: this.buildEmailLayout({
        badge: todayCount > 0 ? '⚠️ Payment reminder' : '🔔 Upcoming payments',
        heading,
        content: `
        <p
          class="body-text"
          style="
            margin:0 0 28px 0;
            font-family:Arial,Helvetica,sans-serif;
            font-size:15px;
            line-height:1.6;
          "
        >
          Hi ${firstName}, ${message}
        </p>

        ${paymentRows}

        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          style="
            margin-top:4px;
            margin-bottom:20px;
            border:1px solid #e4e4e7;
            border-radius:14px;
            background-color:#f4f4f5;
          "
        >
          <tr>
            <td style="padding:14px 16px;">
              <span
                class="footer-text"
                style="
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:12px;
                  font-weight:600;
                "
              >
                Total upcoming
              </span>
            </td>

            <td
              align="right"
              style="padding:14px 16px;"
            >
              <span
                style="
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:16px;
                  font-weight:700;
                  color:#18181b;
                "
              >
                ${formattedTotal}
              </span>
            </td>
          </tr>
        </table>

        <p
          class="footer-text"
          style="
            margin:0;
            font-family:Arial,Helvetica,sans-serif;
            font-size:13px;
            line-height:1.6;
          "
        >
          Review your upcoming payments in HisabWise to stay ahead
          of your cash flow.
        </p>
      `,
      }),
    });

    this.logger.log(
      `Recurring payment reminder sent to ${to} for ${paymentCount} payment(s)`,
    );
  }

  private buildEmailLayout({
    badge,
    heading,
    content,
    footer = '© ' +
      dayjs().year() +
      ' HisabWise. Your private financial workspace.',
  }: {
    badge: string;
    heading: string;
    content: string;
    footer?: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />

        <style>
          :root {
            color-scheme: light dark;
            supported-color-schemes: light dark;
          }

          .bg {
            background-color:#f4f4f5;
          }

          .card {
            background-color:#ffffff;
            border:1px solid #e4e4e7;
          }

          .heading {
            color:#18181b;
          }

          .body-text {
            color:#52525b;
          }

          .footer-text {
            color:#71717a;
          }

          .divider {
            border-top:1px solid #e4e4e7;
          }

          .badge {
            background-color:#ecfdf5;
            border:1px solid #a7f3d0;
          }

          .badge-text {
            color:#047857;
          }

          @media (prefers-color-scheme: dark) {
            .bg {
              background-color:#09090b !important;
            }

            .card {
              background-color:#18181b !important;
              border-color:#27272a !important;
            }

            .heading {
              color:#fafafa !important;
            }

            .body-text {
              color:#a1a1aa !important;
            }

            .footer-text {
              color:#71717a !important;
            }

            .divider {
              border-color:#27272a !important;
            }

            .badge {
              background-color:#022c22 !important;
              border-color:#064e3b !important;
            }

            .badge-text {
              color:#34d399 !important;
            }
          }
        </style>
      </head>

      <body
        class="bg"
        style="
          margin:0;
          padding:0;
          -webkit-text-size-adjust:100%;
          text-size-adjust:100%;
        "
      >
        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          class="bg"
          style="padding:40px 16px;"
        >
          <tr>
            <td align="center">

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                style="max-width:560px;"
              >

                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <img
                      src="cid:project-logo"
                      alt="HisabWise"
                      width="180"
                      style="
                        display:block;
                        width:180px;
                        height:auto;
                        border:0;
                        outline:none;
                        text-decoration:none;
                      "
                    />
                  </td>
                </tr>

                <tr>
                  <td
                    class="card"
                    style="
                      border-radius:16px;
                      padding:40px;
                    "
                  >

                    <table
                      role="presentation"
                      cellpadding="0"
                      cellspacing="0"
                      style="margin-bottom:24px;"
                    >
                      <tr>
                        <td
                          class="badge"
                          style="
                            border-radius:999px;
                            padding:6px 14px;
                          "
                        >
                          <span
                            class="badge-text"
                            style="
                              font-family:Arial,Helvetica,sans-serif;
                              font-size:12px;
                              font-weight:600;
                            "
                          >
                            ${badge}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <h1
                      class="heading"
                      style="
                        margin:0 0 12px 0;
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:26px;
                        font-weight:700;
                        letter-spacing:-0.02em;
                      "
                    >
                      ${heading}
                    </h1>

                    ${content}

                    <hr
                      class="divider"
                      style="margin:32px 0;"
                    />

                    <p
                      class="footer-text"
                      style="
                        margin:0;
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:12px;
                        line-height:1.6;
                      "
                    >
                      ${footer}
                    </p>

                  </td>
                </tr>

              </table>

            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
}
