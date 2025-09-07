const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.init();
  }

  init() {
    try {
      // Use environment variables for email configuration
      const emailConfig = {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      };

      // If no email credentials are provided, use a test account
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('⚠️  No email credentials found. Using development mode - emails will be logged instead of sent.');
        this.isConfigured = false;
        return;
      }

      this.transporter = nodemailer.createTransporter(emailConfig);
      this.isConfigured = true;
      console.log('✅ Email service configured successfully');
    } catch (error) {
      console.error('❌ Failed to configure email service:', error);
      this.isConfigured = false;
    }
  }

  async sendPasswordResetEmail(email, resetToken, userName) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@trampolinetracker.com',
      to: email,
      subject: 'Reset Your Password - Trampoline Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50; text-align: center;">Password Reset Request</h2>
          
          <p>Hi ${userName},</p>
          
          <p>A password reset has been requested for your Trampoline Tracker account. If you didn't request this, you can safely ignore this email.</p>
          
          <p>To reset your password, click the button below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Reset My Password
            </a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666; font-size: 14px;">${resetUrl}</p>
          
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
            This link will expire in 1 hour for security reasons.<br>
            If you continue to have problems, please contact your club administrator.
          </p>
          
          <p style="font-size: 12px; color: #666;">
            Best regards,<br>
            The Trampoline Tracker Team
          </p>
        </div>
      `,
      text: `
        Hi ${userName},

        A password reset has been requested for your Trampoline Tracker account.

        To reset your password, visit: ${resetUrl}

        This link will expire in 1 hour for security reasons.

        If you didn't request this, you can safely ignore this email.

        Best regards,
        The Trampoline Tracker Team
      `
    };

    try {
      if (this.isConfigured && this.transporter) {
        const info = await this.transporter.sendMail(mailOptions);
        console.log('✅ Password reset email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
      } else {
        // Development mode - log the email instead of sending
        console.log('📧 Password reset email (DEV MODE):');
        console.log('To:', email);
        console.log('Subject:', mailOptions.subject);
        console.log('Reset URL:', resetUrl);
        console.log('User:', userName);
        return { 
          success: true, 
          dev: true, 
          resetUrl: resetUrl,
          message: 'Email logged in development mode'
        };
      }
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendWelcomeEmail(email, userName, tempPassword) {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@trampolinetracker.com',
      to: email,
      subject: 'Welcome to Trampoline Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50; text-align: center;">Welcome to Trampoline Tracker!</h2>
          
          <p>Hi ${userName},</p>
          
          <p>Your account has been created by your club administrator. You can now access the Trampoline Tracker to monitor skill progress and achievements.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">Your Login Credentials:</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px;">${tempPassword}</code></p>
          </div>
          
          <p><strong>Important:</strong> Please log in and change your password as soon as possible for security.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
               style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Log In Now
            </a>
          </div>
          
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
            If you have any questions, please contact your club administrator.
          </p>
          
          <p style="font-size: 12px; color: #666;">
            Best regards,<br>
            The Trampoline Tracker Team
          </p>
        </div>
      `
    };

    try {
      if (this.isConfigured && this.transporter) {
        const info = await this.transporter.sendMail(mailOptions);
        console.log('✅ Welcome email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
      } else {
        console.log('📧 Welcome email (DEV MODE):');
        console.log('To:', email);
        console.log('Temp Password:', tempPassword);
        return { success: true, dev: true };
      }
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendInviteEmail(email, role, clubName, invitedByName, inviteToken) {
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invite?token=${inviteToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@trampolinetracker.com',
      to: email,
      subject: `You're invited to join ${clubName} - Trampoline Tracker`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50; text-align: center;">You're Invited to Join ${clubName}</h2>
          
          <p>Hello!</p>
          
          <p><strong>${invitedByName}</strong> has invited you to join <strong>${clubName}</strong> as a <strong>${role}</strong> on Trampoline Tracker.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h3 style="color: #495057; margin-top: 0;">What is Trampoline Tracker?</h3>
            <p style="margin-bottom: 0;">A comprehensive system for managing trampoline gymnasts, tracking their progress through levels and skills, and generating certificates for achievements.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" 
               style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <p style="color: #6c757d; font-size: 14px;">
            If the button doesn't work, you can copy and paste this link into your browser:<br>
            <a href="${inviteUrl}" style="color: #007bff;">${inviteUrl}</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
          
          <p style="color: #6c757d; font-size: 12px; text-align: center;">
            This invitation will expire in 7 days. If you don't want to join, you can simply ignore this email.
          </p>
        </div>
      `
    };

    try {
      if (this.isConfigured && this.transporter) {
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Invite email sent to ${email}:`, info.messageId);
        return { success: true, messageId: info.messageId };
      } else {
        // Development mode - log the email instead of sending
        console.log('📧 Invite email (DEV MODE):');
        console.log('To:', email);
        console.log('Subject:', mailOptions.subject);
        console.log('Club:', clubName);
        console.log('Role:', role);
        console.log('Invited by:', invitedByName);
        console.log('Invite URL:', inviteUrl);
        return { 
          success: true, 
          dev: true, 
          message: 'Email logged in development mode'
        };
      }
    } catch (error) {
      console.error('❌ Failed to send invite email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendCertificateAwardNotification(parentEmail, parentName, gymnast, certificate, level) {
    const certificateTypeText = certificate.type === 'LEVEL_COMPLETION' ? 'Level Completion' :
                               certificate.type === 'SPECIAL_ACHIEVEMENT' ? 'Special Achievement' :
                               certificate.type === 'PARTICIPATION' ? 'Participation' : certificate.type;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@trampolinetracker.com',
      to: parentEmail,
      subject: `🏆 ${gymnast.firstName} has been awarded a certificate!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2c3e50; margin-bottom: 10px;">🏆 Certificate Awarded!</h1>
              <div style="font-size: 48px; margin: 20px 0;">🎉</div>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6; color: #34495e;">
              Hello ${parentName},
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; color: #34495e;">
              We're excited to let you know that <strong>${gymnast.firstName} ${gymnast.lastName}</strong> has been awarded a certificate!
            </p>
            
            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 10px; margin: 25px 0; border-left: 5px solid #27ae60;">
              <h3 style="color: #27ae60; margin-top: 0; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">🏆</span>
                Certificate Details
              </h3>
              <div style="margin: 15px 0;">
                <p style="margin: 8px 0; font-size: 16px;"><strong>Type:</strong> ${certificateTypeText}</p>
                <p style="margin: 8px 0; font-size: 16px;"><strong>Level:</strong> ${level.identifier} - ${level.name}</p>
                <p style="margin: 8px 0; font-size: 16px;"><strong>Awarded:</strong> ${new Date(certificate.awardedAt).toLocaleDateString()}</p>
                <p style="margin: 8px 0; font-size: 16px;"><strong>Awarded by:</strong> ${certificate.awardedBy.firstName} ${certificate.awardedBy.lastName}</p>
              </div>
            </div>
            
            ${certificate.notes ? `
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4 style="color: #2c3e50; margin-top: 0;">Notes:</h4>
              <p style="margin: 0; font-style: italic; color: #5a6c7d;">${certificate.notes}</p>
            </div>
            ` : ''}
            
            <p style="font-size: 16px; line-height: 1.6; color: #34495e;">
              This is a fantastic achievement! ${gymnast.firstName} has shown great dedication and skill in reaching this milestone.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/progress/${gymnast.id}" 
                 style="background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                View ${gymnast.firstName}'s Progress
              </a>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 5px solid #ffc107;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>📜 Physical Certificate:</strong> A printed certificate will be prepared and delivered to ${gymnast.firstName} at the club.
              </p>
            </div>
            
            <p style="font-size: 14px; color: #7f8c8d; text-align: center; margin-top: 30px;">
              Congratulations to ${gymnast.firstName} on this achievement! 🎊
            </p>
          </div>
        </div>
      `,
      text: `
        🏆 Certificate Awarded!

        Hello ${parentName},

        We're excited to let you know that ${gymnast.firstName} ${gymnast.lastName} has been awarded a certificate!

        Certificate Details:
        - Type: ${certificateTypeText}
        - Level: ${level.identifier} - ${level.name}
        - Awarded: ${new Date(certificate.awardedAt).toLocaleDateString()}
        - Awarded by: ${certificate.awardedBy.firstName} ${certificate.awardedBy.lastName}

        ${certificate.notes ? `Notes: ${certificate.notes}` : ''}

        This is a fantastic achievement! ${gymnast.firstName} has shown great dedication and skill in reaching this milestone.

        View ${gymnast.firstName}'s progress: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/progress/${gymnast.id}

        A printed certificate will be prepared and delivered to ${gymnast.firstName} at the club.

        Congratulations to ${gymnast.firstName} on this achievement!

        Best regards,
        The Trampoline Tracker Team
      `
    };

    try {
      if (this.isConfigured && this.transporter) {
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Certificate notification email sent to ${parentEmail}:`, info.messageId);
        return { success: true, messageId: info.messageId };
      } else {
        // Development mode - log the email instead of sending
        console.log('📧 Certificate notification email (DEV MODE):');
        console.log('To:', parentEmail);
        console.log('Subject:', mailOptions.subject);
        console.log('Gymnast:', `${gymnast.firstName} ${gymnast.lastName}`);
        console.log('Certificate:', `${certificateTypeText} for ${level.identifier}`);
        return { 
          success: true, 
          dev: true, 
          message: 'Email logged in development mode'
        };
      }
    } catch (error) {
      console.error('❌ Failed to send certificate notification email:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService(); 