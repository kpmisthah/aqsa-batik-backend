import { log } from 'console';
import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

const initTransporter = async () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.ethereal.email';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    // Real SMTP configuration provided
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    console.log('📬 Configured custom SMTP email provider.');
  } else {
    // Generate virtual ethereal email account for zero-config testing
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`📬 Configured virtual test email account: ${testAccount.user}`);
    } catch (err) {
      // Hard fallback to console logger
      transporter = null;
      console.warn('⚠️ Failed to generate Ethereal email test account. OTPs will be logged directly to the console.');
    }
  }

  return transporter;
};

/**
 * Send an OTP code to a recipient email address
 */
export const sendOtpEmail = async (email: string, otp: string, name: string): Promise<string | null> => {
  const t = await initTransporter();

  const subject = '🔒 Aqsha Batik Store - Verify Your Account';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #5A2A1F/10; border-radius: 12px; background-color: #FDFBF7;">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 10px; font-weight: bold; letter-spacing: 2px; color: #8B3A2B; text-transform: uppercase;">AQSHA STORE</span>
        <h2 style="color: #5A2A1F; font-family: Georgia, serif; margin: 10px 0 0 0;">Verify Your Account</h2>
      </div>
      <p style="color: #5A2A1F; font-size: 14px; line-height: 1.5;">Hi <strong>${name}</strong>,</p>
      <p style="color: #5A2A1F; font-size: 14px; line-height: 1.5;">Thank you for registering at Aqsha Batik Store. Please use the following One-Time Password (OTP) to complete your signup process. This code is valid for 10 minutes:</p>
      <div style="text-align: center; margin: 30px 0;">
        <div style="display: inline-block; padding: 15px 40px; background-color: #5A2A1F; color: #ffffff; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 8px; font-family: monospace; box-shadow: 0 4px 6px rgba(90,42,31,0.15);">${otp}</div>
      </div>
      <p style="color: #5A2A1F; font-size: 12px; line-height: 1.5; color: #5A2A1F/60;">If you didn't request this verification code, please ignore this email or contact support.</p>
      <hr style="border: 0; border-top: 1px solid rgba(90,42,31,0.1); margin: 30px 0 10px 0;">
      <p style="text-align: center; font-size: 10px; color: #5A2A1F/40; margin: 0;">© ${new Date().getFullYear()} Aqsha Batik Cloth. All rights reserved.</p>
    </div>
  `;

  // Log to console so developer always sees the OTP immediately in the terminal
  console.log(`\n🔑 [OTP CODE] Sending OTP to ${email}: ${otp} (User: ${name})\n`);

  if (!t) {
    return 'logged_to_console';
  }

  try {
    const info = await t.sendMail({
      from: '"Aqsha Batik Store" <no-reply@aqshabatik.com>',
      to: email,
      subject,
      html: htmlContent,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`✉️ Email verification sent! View preview: ${previewUrl}`);
      return previewUrl;
    }
    console.log(previewUrl, 'preview');

    return 'sent';
  } catch (error) {
    console.error('Failed to send SMTP email:', error);
    return null;
  }
};
