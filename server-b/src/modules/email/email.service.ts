import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { AppDefaults } from "../../common/constants/defaults";

type Transporter = nodemailer.Transporter;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(): void {
    const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;

    if (gmailUser && gmailPass) {
      if (
        process.env.GMAIL_USER ||
        (!process.env.SMTP_HOST && gmailUser.includes("@gmail.com"))
      ) {
        this.transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: gmailUser,
            pass: gmailPass,
          },
        });
        this.logger.log(
          `📧 Gmail SMTP Transporter initialized for: ${gmailUser}`,
        );
      } else if (process.env.SMTP_HOST) {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: gmailUser,
            pass: gmailPass,
          },
        });
        this.logger.log(
          `📧 Custom SMTP Transporter initialized (${process.env.SMTP_HOST})`,
        );
      }
    } else {
      this.logger.warn(
        "⚠️ No Gmail/SMTP credentials found in .env (GMAIL_USER & GMAIL_APP_PASSWORD). Running in Dev Console Fallback mode.",
      );
    }
  }

  /**
   * Send account verification OTP email
   */
  async sendVerificationEmail(
    to: string,
    otpOrName: string,
    nameOrOtp: string,
  ): Promise<boolean> {
    let otp = otpOrName;
    let displayName = nameOrOtp;
    // Auto-detect in case caller passes (to, displayName, otp) or (to, otp, displayName)
    if (/^\d{6}$/.test(nameOrOtp) && !/^\d{6}$/.test(otpOrName)) {
      otp = nameOrOtp;
      displayName = otpOrName;
    } else if (/^\d{6}$/.test(otpOrName)) {
      otp = otpOrName;
      displayName = nameOrOtp;
    }

    const subject = `🛡️ [${AppDefaults.APP.NAME}] Mã xác thực tài khoản của bạn: ${otp}`;
    const from = process.env.GMAIL_USER || "DaSSO Auth <noreply@dasso.local>";
    const html = this.buildVerificationEmailHtml(displayName, otp);

    if (!this.transporter) {
      this.logger.log(
        `\n======================================================\n📧 [DEV EMAIL FALLBACK] ACCOUNT VERIFICATION\nTo: ${to} (${displayName})\nVerification OTP (5 mins): [ ${otp} ]\n======================================================\n`,
      );
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: `"${AppDefaults.APP.NAME}" <${from}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`✅ Real verification email sent to ${to} [OTP: ${otp}]`);
      return true;
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to send verification email to ${to}: ${error.message}`,
      );
      this.logger.warn(
        `🛡️ [RESCUE LOG] Verification OTP for ${to} is: [ ${otp} ]`,
      );
      return false;
    }
  }

  private buildVerificationEmailHtml(displayName: string, otp: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác thực tài khoản</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F4F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F4F4F5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 500px; background-color: #FFFFFF; border-radius: 20px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #E4E4E7;">
          <tr>
            <td style="padding: 30px; text-align: center; background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%);">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 22px; font-weight: 700;">${AppDefaults.APP.NAME}</h1>
              <p style="margin: 6px 0 0; color: #E0E7FF; font-size: 13px;">Hệ thống xác thực tài khoản an toàn</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 12px; color: #18181B; font-size: 16px; font-weight: 600;">Xin chào ${displayName}! 👋</h2>
              <p style="margin: 0 0 20px; color: #52525B; font-size: 14px; line-height: 1.6;">
                Cảm ơn bạn đã đăng ký tài khoản. Để hoàn tất kích hoạt tài khoản của mình, vui lòng nhập mã OTP xác thực dưới đây vào ứng dụng:
              </p>
              <div style="background-color: #EEF2FF; border: 2px dashed #6366F1; border-radius: 14px; padding: 20px; text-align: center; margin: 0 0 20px;">
                <span style="font-size: 12px; font-weight: 600; color: #4F46E5; text-transform: uppercase; letter-spacing: 1px;">Mã Xác Thực OTP</span>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #4338CA; margin: 8px 0; font-family: monospace;">${otp}</div>
                <span style="font-size: 12px; color: #6B7280;">⏰ Mã có hiệu lực trong vòng <strong>5 phút</strong></span>
              </div>
              <p style="margin: 0; color: #71717A; font-size: 12px; line-height: 1.5; text-align: center;">
                Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 30px; text-align: center; background-color: #FAFAFA; border-top: 1px solid #F4F4F5;">
              <p style="margin: 0; color: #A1A1AA; font-size: 11px;">© 2026 DaSSO System. Tất cả các quyền được bảo lưu.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }
}
