const nodemailer = require('nodemailer');

// ---------------------------------------------------------------------------
// Shared branded template helpers
// ---------------------------------------------------------------------------

const BASE_URL = () => process.env.FRONTEND_URL || 'http://localhost:3000';

function brandedHtml(subtitle, bodyHtml) {
  const base = BASE_URL();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:16px;background:#f4f4f6">
<div style="font-family:'Exo 2',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #d4d4d8">
    <div style="background-color:#6a1fd4;padding:28px 32px">
      <h1 style="margin:0;color:#ffffff;font-size:1.4rem;font-weight:800;letter-spacing:0.01em">Trampoline Life</h1>
      <p style="margin:6px 0 0;color:#e0d0f8;font-size:0.9rem">${subtitle}</p>
    </div>
    <div style="padding:28px 32px;color:#1a1a1a;font-size:0.95rem;line-height:1.6">
      ${bodyHtml}
    </div>
    <div style="background-color:#eaeaec;padding:16px 32px;text-align:center">
      <p style="margin:0;font-size:0.78rem;color:#888888">Trampoline Life &middot; <a href="${base}/booking" style="color:#7c35e8;text-decoration:none">Log in</a></p>
    </div>
  </div>
</body>
</html>`;
}

function ctaButton(url, label) {
  return `<div style="text-align:center;margin:28px 0"><a href="${url}" style="background-color:#6a1fd4;color:#ffffff;padding:13px 32px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:700;font-size:0.95rem">${label}</a></div>`;
}

function h3(text) {
  return `<h3 style="color:#7c35e8;font-size:0.95rem;margin:1.5rem 0 0.4rem">${text}</h3>`;
}

function infoBox(html) {
  return `<div style="background:#f3eefe;border-left:4px solid #7c35e8;border-radius:0 6px 6px 0;padding:14px 18px;margin:1rem 0">${html}</div>`;
}

function muted(text) {
  return `<p style="margin-bottom:0;color:#888888;font-size:0.85rem">${text}</p>`;
}

// ---------------------------------------------------------------------------

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.init();
  }

  init() {
    try {
      const emailConfig = {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      };

      console.log(`📧 Email env: EMAIL_USER="${process.env.EMAIL_USER || '(not set)'}", EMAIL_PASS length=${process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0}`);
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('⚠️  No email credentials found. Using development mode - emails will be logged instead of sent.');
        this.isConfigured = false;
        return;
      }

      this.transporter = nodemailer.createTransport(emailConfig);
      this.isConfigured = true;
      console.log('✅ Email service configured successfully');
    } catch (error) {
      console.error('❌ Failed to configure email service:', error);
      this.isConfigured = false;
    }
  }

  async _send(mailOptions, devLog) {
    try {
      if (this.isConfigured && this.transporter) {
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Email sent (${mailOptions.subject}):`, info.messageId);
        return { success: true, messageId: info.messageId };
      } else {
        console.log(`📧 ${mailOptions.subject} (DEV MODE):`, devLog);
        return { success: true, dev: true };
      }
    } catch (error) {
      console.error(`❌ Failed to send email (${mailOptions.subject}):`, error);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordResetEmail(email, resetToken, userName) {
    const resetUrl = `${BASE_URL()}/reset-password?token=${resetToken}`;
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: 'Reset your password — Trampoline Life',
      html: brandedHtml('Password reset', `
        <p style="margin-top:0">Hi ${userName},</p>
        <p>A password reset has been requested for your Trampoline Life account. If you didn't request this, you can safely ignore this email.</p>
        ${ctaButton(resetUrl, 'Reset my password')}
        <p style="font-size:0.85rem;color:#888888">Or copy and paste this link into your browser:<br>
        <a href="${resetUrl}" style="color:#7c35e8;word-break:break-all">${resetUrl}</a></p>
        ${muted('This link will expire in 1 hour. If you continue to have problems, please contact your club administrator.')}
      `),
      text: `Hi ${userName},\n\nA password reset has been requested for your Trampoline Life account.\n\nTo reset your password, visit: ${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.`,
    }, { to: email, resetUrl });
  }

  async sendAccountCreatedEmail(email, resetToken, userName) {
    const setPasswordUrl = `${BASE_URL()}/reset-password?token=${resetToken}`;
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: 'Your Trampoline Life account has been created',
      html: brandedHtml('Account created', `
        <p style="margin-top:0">Hi ${userName},</p>
        <p>An account has been created for you on Trampoline Life by your club administrator. Please set your password to get started.</p>
        ${ctaButton(setPasswordUrl, 'Set my password')}
        <p style="font-size:0.85rem;color:#888888">Or copy and paste this link into your browser:<br>
        <a href="${setPasswordUrl}" style="color:#7c35e8;word-break:break-all">${setPasswordUrl}</a></p>
        ${muted('This link will expire in 1 hour. If you have any problems, please contact your club administrator.')}
      `),
      text: `Hi ${userName},\n\nAn account has been created for you on Trampoline Life by your club administrator.\n\nPlease set your password by visiting: ${setPasswordUrl}\n\nThis link will expire in 1 hour.`,
    }, { to: email, setPasswordUrl });
  }

  async sendWelcomeEmail(email, userName, tempPassword) {
    const loginUrl = `${BASE_URL()}/login`;
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: 'Welcome to Trampoline Life',
      html: brandedHtml('Welcome!', `
        <p style="margin-top:0">Hi ${userName},</p>
        <p>Your account has been created by your club administrator. You can now log in to Trampoline Life to manage your membership and track progress.</p>
        ${infoBox(`
          <p style="margin:0 0 0.5rem;font-weight:700">Your login details</p>
          <p style="margin:0.25rem 0"><strong>Email:</strong> ${email}</p>
          <p style="margin:0.25rem 0"><strong>Temporary password:</strong> <code style="background:#e9e4f8;padding:2px 6px;border-radius:4px">${tempPassword}</code></p>
        `)}
        <p>Please log in and change your password as soon as possible.</p>
        ${ctaButton(loginUrl, 'Log in now')}
        ${muted('If you have any questions, please contact your club administrator.')}
      `),
      text: `Hi ${userName},\n\nYour Trampoline Life account has been created.\n\nEmail: ${email}\nTemporary password: ${tempPassword}\n\nPlease log in and change your password: ${loginUrl}`,
    }, { to: email });
  }

  async sendInviteEmail(email, role, clubName, invitedByName, inviteToken) {
    const inviteUrl = `${BASE_URL()}/accept-invite?token=${inviteToken}`;
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: `You've been invited to join ${clubName} — Trampoline Life`,
      html: brandedHtml(`Invitation to join ${clubName}`, `
        <p style="margin-top:0">Hello!</p>
        <p><strong>${invitedByName}</strong> has invited you to join <strong>${clubName}</strong> as a <strong>${role}</strong> on Trampoline Life.</p>
        ${ctaButton(inviteUrl, 'Accept invitation')}
        <p style="font-size:0.85rem;color:#888888">Or copy and paste this link:<br>
        <a href="${inviteUrl}" style="color:#7c35e8;word-break:break-all">${inviteUrl}</a></p>
        ${muted('This invitation will expire in 7 days. If you don\'t want to join, you can safely ignore this email.')}
      `),
      text: `You've been invited to join ${clubName} as a ${role} on Trampoline Life.\n\nInvited by: ${invitedByName}\n\nAccept here: ${inviteUrl}\n\nThis invitation expires in 7 days.`,
    }, { to: email, clubName, role, invitedByName, inviteUrl });
  }

  async sendCertificateAwardNotification(parentEmail, parentName, gymnast, certificate, level) {
    const typeText = certificate.type === 'LEVEL_COMPLETION' ? 'Level Completion'
      : certificate.type === 'SPECIAL_ACHIEVEMENT' ? 'Special Achievement'
      : certificate.type === 'PARTICIPATION' ? 'Participation'
      : certificate.type;
    const progressUrl = `${BASE_URL()}/progress/${gymnast.id}`;
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: parentEmail,
      subject: `🏆 ${gymnast.firstName} has been awarded a certificate!`,
      html: brandedHtml('Certificate awarded', `
        <p style="margin-top:0">Hi ${parentName},</p>
        <p>Congratulations — <strong>${gymnast.firstName} ${gymnast.lastName}</strong> has been awarded a certificate!</p>
        ${infoBox(`
          <p style="margin:0 0 0.5rem;font-weight:700">Certificate details</p>
          <p style="margin:0.2rem 0"><strong>Type:</strong> ${typeText}</p>
          <p style="margin:0.2rem 0"><strong>Level:</strong> ${level.identifier} – ${level.name}</p>
          <p style="margin:0.2rem 0"><strong>Awarded:</strong> ${new Date(certificate.awardedAt).toLocaleDateString('en-GB')}</p>
          <p style="margin:0.2rem 0"><strong>Awarded by:</strong> ${certificate.awardedBy.firstName} ${certificate.awardedBy.lastName}</p>
          ${certificate.notes ? `<p style="margin:0.5rem 0 0;font-style:italic;color:#555">${certificate.notes}</p>` : ''}
        `)}
        <p>${gymnast.firstName} has shown great dedication and skill in reaching this milestone. Well done!</p>
        ${ctaButton(progressUrl, `View ${gymnast.firstName}'s progress`)}
        ${muted('A printed certificate will be prepared and delivered to ' + gymnast.firstName + ' at the club.')}
      `),
      text: `Hi ${parentName},\n\n${gymnast.firstName} ${gymnast.lastName} has been awarded a certificate!\n\nType: ${typeText}\nLevel: ${level.identifier} - ${level.name}\nAwarded: ${new Date(certificate.awardedAt).toLocaleDateString('en-GB')}\nAwarded by: ${certificate.awardedBy.firstName} ${certificate.awardedBy.lastName}\n${certificate.notes ? `\nNotes: ${certificate.notes}` : ''}\n\nView progress: ${progressUrl}\n\nA printed certificate will be prepared at the club.`,
    }, { to: parentEmail, gymnast: `${gymnast.firstName} ${gymnast.lastName}`, level: level.identifier });
  }

  async sendGuardianInvitationEmail(guardianEmail, guardianFirstName, guardianLastName, gymnastName, clubName, relationship, requestId) {
    const acceptUrl = `${BASE_URL()}/adult-connection-request?requestId=${requestId}`;
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: guardianEmail,
      subject: `Guardian invitation from ${gymnastName} — ${clubName}`,
      html: brandedHtml('Guardian invitation', `
        <p style="margin-top:0">Hello ${guardianFirstName} ${guardianLastName},</p>
        <p><strong>${gymnastName}</strong> has invited you to be their guardian at <strong>${clubName}</strong> on Trampoline Life.</p>
        ${infoBox(`
          <p style="margin:0.2rem 0"><strong>Gymnast:</strong> ${gymnastName}</p>
          <p style="margin:0.2rem 0"><strong>Club:</strong> ${clubName}</p>
          <p style="margin:0.2rem 0"><strong>Relationship:</strong> ${relationship}</p>
        `)}
        <p>As a guardian you'll be able to view ${gymnastName}'s progress, receive certificate notifications, and manage your account and membership.</p>
        ${ctaButton(acceptUrl, 'Accept invitation')}
        ${muted(`If you're not ${gymnastName}'s guardian or this was sent in error, you can safely ignore this email.`)}
      `),
      text: `Hello ${guardianFirstName} ${guardianLastName},\n\n${gymnastName} has invited you to be their guardian at ${clubName}.\n\nRelationship: ${relationship}\n\nAccept here: ${acceptUrl}\n\nIf this was sent in error, please ignore it.`,
    }, { to: guardianEmail, gymnast: gymnastName, club: clubName, acceptUrl });
  }

  async sendEmail({ to, subject, html, text }) {
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to,
      subject,
      html,
      text,
    }, { to, subject });
  }

  async sendMembershipPaymentSuccessEmail(email, userName, gymnast, amountPence, nextBillingDate) {
    const amount = `£${(amountPence / 100).toFixed(2)}`;
    const nextDate = new Date(nextBillingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: `Membership payment received — ${gymnast.firstName} ${gymnast.lastName}`,
      html: brandedHtml('Payment received', `
        <p style="margin-top:0">Hi ${userName},</p>
        <p>We've received your membership payment of <strong style="color:#7c35e8">${amount}</strong> for <strong>${gymnast.firstName} ${gymnast.lastName}</strong>.</p>
        ${infoBox(`<p style="margin:0">Your next payment of <strong>${amount}</strong> will be taken on <strong>${nextDate}</strong>.</p>`)}
        <p>Thanks for being a member of Trampoline Life!</p>
        ${ctaButton(`${BASE_URL()}/booking/my-account`, 'Log in to your account')}
      `),
      text: `Hi ${userName},\n\nWe've received your membership payment of ${amount} for ${gymnast.firstName} ${gymnast.lastName}.\n\nYour next payment of ${amount} will be taken on ${nextDate}.\n\nThanks for being a member of Trampoline Life!\n\n${BASE_URL()}/booking/my-account`,
    }, { to: email, gymnast: `${gymnast.firstName} ${gymnast.lastName}`, amount });
  }

  async sendMembershipPaymentFailedEmail(email, userName, gymnast, amountPence) {
    const amount = `£${(amountPence / 100).toFixed(2)}`;
    const loginUrl = `${BASE_URL()}/booking/my-account`;
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: `Membership payment failed — ${gymnast.firstName} ${gymnast.lastName}`,
      html: brandedHtml('Payment failed', `
        <p style="margin-top:0">Hi ${userName},</p>
        <p>We were unable to collect your membership payment of <strong style="color:#e74c3c">${amount}</strong> for <strong>${gymnast.firstName} ${gymnast.lastName}</strong>.</p>
        <p>Please log in to your account and update your payment details to avoid any interruption to your membership.</p>
        ${ctaButton(loginUrl, 'Update payment details')}
        ${muted('If you have any questions, please contact the club.')}
      `),
      text: `Hi ${userName},\n\nWe were unable to collect your membership payment of ${amount} for ${gymnast.firstName} ${gymnast.lastName}.\n\nPlease log in and update your payment details: ${loginUrl}\n\nIf you have any questions, please contact the club.`,
    }, { to: email, gymnast: `${gymnast.firstName} ${gymnast.lastName}`, amount });
  }

  async sendMembershipCreatedEmail(email, guardianName, gymnast, amountPence) {
    const amount = `£${(amountPence / 100).toFixed(2)}`;
    const loginUrl = `${BASE_URL()}/booking/my-account`;
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: `Membership set up for ${gymnast.firstName} ${gymnast.lastName} — action required`,
      html: brandedHtml('Membership set up', `
        <p style="margin-top:0">Hi ${guardianName},</p>
        <p>A monthly membership of <strong style="color:#7c35e8">${amount}/month</strong> has been set up for <strong>${gymnast.firstName} ${gymnast.lastName}</strong>.</p>

        ${h3('How your fee is calculated')}
        <p style="margin-top:0">Your monthly fee is based on a training year of <strong>46 weeks</strong>, using the number of sessions per week we have agreed together. We divide the total annual cost by 12 to give you a consistent monthly payment — so you pay the same amount every month regardless of how many sessions fall in that particular month.</p>

        ${h3('Commitments')}
        <p style="margin-top:0">Your membership is tied to a specific session or sessions each week. Please attend your committed session — if you need to change which session you train at, speak to your coach.</p>

        ${h3('Your first payment')}
        <p style="margin-top:0">Your first payment will be a pro-rated amount covering the remainder of the current month. From the 1st of next month you'll be charged the full ${amount} each month.</p>

        ${h3('Getting started')}
        <p style="margin-top:0">To activate your membership, please log in to your account and complete the payment setup.</p>
        ${ctaButton(loginUrl, 'Set up payment')}
        ${muted('If a membership was previously set up for you, you may be receiving this email to set up a new payment method.')}
        ${muted('If you have any questions, please contact the club.')}
      `),
      text: `Hi ${guardianName},\n\nA monthly membership of ${amount}/month has been set up for ${gymnast.firstName} ${gymnast.lastName}.\n\nHOW YOUR FEE IS CALCULATED\nYour monthly fee is based on a training year of 46 weeks, using the number of sessions per week we have agreed together. We divide the total annual cost by 12 to give you a consistent monthly payment.\n\nCOMMITMENTS\nYour membership is tied to a specific session or sessions each week. Please attend your committed session — if you need to change which session you train at, speak to your coach.\n\nYOUR FIRST PAYMENT\nYour first payment will be a pro-rated amount covering the remainder of the current month. From the 1st of next month you'll be charged the full ${amount} each month.\n\nGETTING STARTED\nTo activate your membership, log in and complete the payment setup:\n${loginUrl}\n\nIf a membership was previously set up for you, you may be receiving this email to set up a new payment method.\n\nIf you have any questions, please contact the club.`,
    }, { to: email, gymnast: `${gymnast.firstName} ${gymnast.lastName}`, amount, loginUrl });
  }

  async sendWeeklySessionReminderEmail(email, firstName, sessions) {
    // sessions: [{ date, startTime, endTime, availableSlots }]
    const rows = sessions.map(s => {
      const dateStr = new Date(s.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      return `<tr>
        <td style="padding:7px 10px;border-bottom:1px solid #eee">${dateStr}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee">${s.startTime}–${s.endTime}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right">${s.availableSlots} space${s.availableSlots !== 1 ? 's' : ''}</td>
      </tr>`;
    }).join('');

    const base = BASE_URL();
    return this.sendEmail({
      to: email,
      subject: 'Sessions available this week — Trampoline Life',
      html: brandedHtml('Sessions this week', `
        <p style="margin-top:0">Hi ${firstName},</p>
        <p>Here's a look at the sessions running this week:</p>
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem;margin-bottom:1rem">
          <thead>
            <tr style="background-color:#f3eefe">
              <th style="padding:7px 10px;text-align:left">Date</th>
              <th style="padding:7px 10px;text-align:left">Time</th>
              <th style="padding:7px 10px;text-align:right">Spaces</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${ctaButton(`${base}/booking`, 'View sessions')}
        ${muted('To stop receiving these weekly emails, log in and update your notification preferences in My Account.')}
      `),
      text: `Hi ${firstName},\n\nHere are the sessions running this week:\n\n${sessions.map(s => {
        const dateStr = new Date(s.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        return `${dateStr} ${s.startTime}–${s.endTime} (${s.availableSlots} space${s.availableSlots !== 1 ? 's' : ''})`;
      }).join('\n')}\n\nBook at: ${base}/booking\n\nTo unsubscribe, log in and update your notification preferences in My Account.`,
    });
  }

  async sendMembershipPaymentReminderEmail(email, firstName, gymnast, amountPence, renewalDate) {
    const dateStr = new Date(renewalDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const amount = `£${(amountPence / 100).toFixed(2)}`;
    const subject = `Membership payment reminder — ${gymnast.firstName}`;
    return this.sendEmail({
      to: email,
      subject,
      html: brandedHtml('Membership payment reminder', `
        <p style="margin-top:0">Hi ${firstName},</p>
        <p>A membership payment of <strong>${amount}</strong> for <strong>${gymnast.firstName} ${gymnast.lastName}</strong> will be taken on <strong>${dateStr}</strong>.</p>
        ${ctaButton(`${BASE_URL()}/booking/my-account`, 'Log in to your account')}
        ${muted('If you have any questions, please contact the club.')}
      `),
    });
  }

  async sendInactivityWarningEmail(email, firstName) {
    const loginUrl = `${BASE_URL()}/login`;
    return this.sendEmail({
      to: email,
      subject: 'Your Trampoline Life account will be deleted in one week',
      html: brandedHtml('Account inactivity notice', `
        <p style="margin-top:0">Hi ${firstName},</p>
        <p>Your account has been inactive for nearly 6 months. If we don't hear from you, your account will be <strong>permanently deleted in one week</strong>.</p>
        <p>To keep your account, simply log in.</p>
        ${ctaButton(loginUrl, 'Log in to keep my account')}
      `),
    });
  }

  async sendBgNumberInvalidEmail(guardianEmail, guardianFirstName, gymnastFirstName) {
    return this.sendEmail({
      to: guardianEmail,
      subject: `Action needed — BG membership number for ${gymnastFirstName}`,
      html: brandedHtml(
        `BG membership number for ${gymnastFirstName}`,
        `<p>Hi ${guardianFirstName},</p>
        <p>We weren't able to confirm ${gymnastFirstName}'s British Gymnastics membership number.</p>
        ${infoBox(`<p style="margin:0"><strong>Please check:</strong></p>
          <ul style="margin:0.5rem 0 0;padding-left:1.2rem">
            <li>The number was entered correctly in your account</li>
            <li>You have added <strong>Trampoline Life</strong> as a club on the British Gymnastics portal — if we can't see your membership from our end, we're unable to confirm it</li>
          </ul>`)}
        <p>Once you've updated it, your booking access will be restored within the grace period.</p>
        ${ctaButton(BASE_URL() + '/booking/my-account', 'Update BG number')}`,
      ),
    });
  }

  async sendBgNumberPendingDigestEmail(coachEmail, coachFirstName, pendingGymnasts, adminUrl) {
    const rows = pendingGymnasts.map(g => {
      const days = Math.floor((Date.now() - new Date(g.bgNumberEnteredAt)) / (24 * 60 * 60 * 1000));
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${g.firstName} ${g.lastName}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${g.guardianName}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:monospace">${g.bgNumber}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${days}d</td>
      </tr>`;
    }).join('');

    return this.sendEmail({
      to: coachEmail,
      subject: `${pendingGymnasts.length} BG number${pendingGymnasts.length !== 1 ? 's' : ''} awaiting verification`,
      html: brandedHtml(
        'BG numbers awaiting verification',
        `<p>Hi ${coachFirstName},</p>
        <p>The following gymnasts have a BG membership number that needs verification:</p>
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
          <thead>
            <tr style="background:#f3eefe">
              <th style="padding:6px 10px;text-align:left">Gymnast</th>
              <th style="padding:6px 10px;text-align:left">Parent</th>
              <th style="padding:6px 10px;text-align:left">BG Number</th>
              <th style="padding:6px 10px;text-align:right">Age</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${ctaButton(adminUrl, 'Review BG Numbers')}`,
      ),
    });
  }

  async sendNewMemberDigestEmail(coachEmail, coachFirstName, newMembers) {
    const rows = [];
    const textLines = [];
    for (const m of newMembers) {
      const signedUpAt = new Date(m.createdAt).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      rows.push(`<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${m.firstName} ${m.lastName}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${m.email}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#888">${signedUpAt}</td>
      </tr>`);
      textLines.push(`${m.firstName} ${m.lastName} <${m.email}> — ${signedUpAt}`);
    }

    const text = `Hi ${coachFirstName},\n\nThe following new member${newMembers.length !== 1 ? 's have' : ' has'} signed up in the last 24 hours:\n\n` +
      textLines.join('\n');

    return this.sendEmail({
      to: coachEmail,
      subject: `New members (last 24 hours) — ${newMembers.length} sign-up${newMembers.length !== 1 ? 's' : ''}`,
      text,
      html: brandedHtml(
        'New member sign-ups',
        `<p>Hi ${coachFirstName},</p>
        <p>The following new member${newMembers.length !== 1 ? 's have' : ' has'} signed up in the last 24 hours:</p>
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
          <thead>
            <tr style="background:#f3eefe">
              <th style="padding:6px 10px;text-align:left">Name</th>
              <th style="padding:6px 10px;text-align:left">Email</th>
              <th style="padding:6px 10px;text-align:left">Signed up</th>
            </tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
        ${ctaButton(`${BASE_URL()}/booking/admin/members`, 'View members')}`,
      ),
    });
  }

  async sendChargeCreatedEmail(email, firstName, description, amountPence, dueDate) {
    const amount = `£${(amountPence / 100).toFixed(2)}`;
    const due = new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: 'You have a new charge on your account',
      html: brandedHtml('New charge', `
        <p style="margin-top:0">Hi ${firstName},</p>
        <p>A charge has been added to your account and is due by <strong>${due}</strong>.</p>
        ${infoBox(`
          <p style="margin:0.2rem 0"><strong>Description:</strong> ${description}</p>
          <p style="margin:0.2rem 0"><strong>Amount:</strong> <strong style="color:#e74c3c">${amount}</strong></p>
          <p style="margin:0.2rem 0"><strong>Due by:</strong> ${due}</p>
        `)}
        ${ctaButton(`${BASE_URL()}/booking/my-charges`, 'Pay now')}
        ${muted('If you have any questions, please contact the club.')}
      `),
      text: `Hi ${firstName},\n\nA charge has been added to your account.\n\nDescription: ${description}\nAmount: ${amount}\nDue by: ${due}\n\nPay now: ${BASE_URL()}/booking/my-charges\n\nIf you have any questions, please contact the club.`,
    }, { to: email, amount, description });
  }

  async sendChargePaidWithCreditEmail(email, firstName, description, amountPence) {
    const amount = `£${(amountPence / 100).toFixed(2)}`;
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: 'A charge on your account has been paid using your credit',
      html: brandedHtml('Charge paid with credit', `
        <p style="margin-top:0">Hi ${firstName},</p>
        <p>A charge of <strong>${amount}</strong> (${description}) has been added to your account and automatically paid using your available credit balance.</p>
        <p style="color:#27ae60;font-weight:600">No further payment is required.</p>
        ${ctaButton(`${BASE_URL()}/booking/my-account`, 'Log in to your account')}
        ${muted('If you have any questions, please contact the club.')}
      `),
      text: `Hi ${firstName},\n\nA charge of ${amount} (${description}) has been added to your account and automatically paid using your available credit balance.\n\nNo further payment is required.\n\nIf you have any questions, please contact the club.`,
    }, { to: email, amount, description });
  }

  async sendChargeDeletedEmail(email, firstName, description, amountPence) {
    const amount = `£${(amountPence / 100).toFixed(2)}`;
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: 'A charge on your account has been cancelled',
      html: brandedHtml('Charge cancelled', `
        <p style="margin-top:0">Hi ${firstName},</p>
        <p>A charge of <strong>${amount}</strong> (${description}) has been cancelled.</p>
        <p>No payment is required.</p>
        ${ctaButton(`${BASE_URL()}/booking/my-account`, 'Log in to your account')}
        ${muted('If you have any questions, please contact the club.')}
      `),
      text: `Hi ${firstName},\n\nA charge of ${amount} (${description}) has been cancelled. No payment is required.\n\nIf you have any questions, please contact the club.`,
    }, { to: email, amount, description });
  }

  async sendCreditAssignedEmail(email, firstName, amountPence, expiresAt, note) {
    const amount = `£${(amountPence / 100).toFixed(2)}`;
    const expiry = new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: 'A credit has been added to your account',
      html: brandedHtml('Credit added', `
        <p style="margin-top:0">Hi ${firstName},</p>
        <p>A credit of <strong style="color:#7c35e8">${amount}</strong> has been added to your account.</p>
        ${infoBox(`
          ${note ? `<p style="margin:0 0 0.4rem"><strong>Note:</strong> ${note}</p>` : ''}
          <p style="margin:0">Expires: <strong>${expiry}</strong></p>
        `)}
        <p>Credits are applied automatically at checkout.</p>
        ${ctaButton(`${BASE_URL()}/booking`, 'Log in to book')}
        ${muted('If you have any questions, please contact the club.')}
      `),
      text: `Hi ${firstName},\n\nA credit of ${amount} has been added to your account.${note ? `\n\nNote: ${note}` : ''}\n\nExpires: ${expiry}\n\nCredits are applied automatically at checkout.\n\nIf you have any questions, please contact the club.`,
    }, { to: email, amount });
  }

  async sendCreditDeletedEmail(email, firstName, amountPence) {
    const amount = `£${(amountPence / 100).toFixed(2)}`;
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: 'A credit has been removed from your account',
      html: brandedHtml('Credit removed', `
        <p style="margin-top:0">Hi ${firstName},</p>
        <p>A credit of <strong>${amount}</strong> has been removed from your account.</p>
        ${ctaButton(`${BASE_URL()}/booking/my-account`, 'Log in to your account')}
        ${muted('If you have any questions, please contact the club.')}
      `),
      text: `Hi ${firstName},\n\nA credit of ${amount} has been removed from your account.\n\nIf you have any questions, please contact the club.`,
    }, { to: email, amount });
  }

  async sendGuardianConnectionNotification(guardianEmail, guardianName, gymnastName, clubName, relationship) {
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: guardianEmail,
      subject: `Guardian connection confirmed — ${gymnastName}`,
      html: brandedHtml('Guardian connection confirmed', `
        <p style="margin-top:0">Hello ${guardianName},</p>
        <p>You have been successfully connected as a guardian for <strong>${gymnastName}</strong> at <strong>${clubName}</strong>.</p>
        ${infoBox(`
          <p style="margin:0.2rem 0"><strong>Gymnast:</strong> ${gymnastName}</p>
          <p style="margin:0.2rem 0"><strong>Club:</strong> ${clubName}</p>
          <p style="margin:0.2rem 0"><strong>Relationship:</strong> ${relationship}</p>
        `)}
        <p>You can now view ${gymnastName}'s progress, receive certificate notifications, and manage your account and membership.</p>
        ${ctaButton(`${BASE_URL()}/booking/my-account`, 'Log in to your account')}
        ${muted('Welcome to Trampoline Life!')}
      `),
      text: `Hello ${guardianName},\n\nYou have been connected as a guardian for ${gymnastName} at ${clubName}.\n\nRelationship: ${relationship}\n\nWelcome to Trampoline Life!`,
    }, { to: guardianEmail, gymnast: gymnastName, club: clubName });
  }
  // Sent when a membership is created with a future start date (no Stripe setup yet)
  async sendMembershipScheduledEmail(email, guardianName, gymnast, amountPence, startDate) {
    const amount = `£${(amountPence / 100).toFixed(2)}`;
    const startStr = new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: `Membership scheduled for ${gymnast.firstName} ${gymnast.lastName}`,
      html: brandedHtml('Membership scheduled', `
        <p style="margin-top:0">Hi ${guardianName},</p>
        <p>A monthly membership of <strong style="color:#7c35e8">${amount}/month</strong> has been scheduled for <strong>${gymnast.firstName} ${gymnast.lastName}</strong>, starting on <strong>${startStr}</strong>.</p>

        ${h3('How your fee is calculated')}
        <p style="margin-top:0">Your monthly fee is based on a training year of <strong>46 weeks</strong>, using the number of sessions per week we have agreed together. We divide the total annual cost by 12 to give you a consistent monthly payment — so you pay the same amount every month regardless of how many sessions fall in that particular month.</p>

        ${h3('Commitments')}
        <p style="margin-top:0">Your membership is tied to a specific session or sessions each week. Please attend your committed session — if you need to change which session you train at, speak to your coach.</p>

        ${h3('Getting started')}
        <p style="margin-top:0">To activate your membership, please log in to your account and complete the payment setup. Your membership will begin on <strong>${startStr}</strong>.</p>
        ${ctaButton(`${BASE_URL()}/booking/my-account`, 'Set up payment')}
        ${muted('If you have any questions, please contact the club.')}
      `),
      text: `Hi ${guardianName},\n\nA monthly membership of ${amount}/month has been scheduled for ${gymnast.firstName} ${gymnast.lastName}, starting on ${startStr}.\n\nHOW YOUR FEE IS CALCULATED\nYour monthly fee is based on a training year of 46 weeks, using the number of sessions per week we have agreed together. We divide the total annual cost by 12 to give you a consistent monthly payment.\n\nCOMMITMENTS\nYour membership is tied to a specific session or sessions each week. Please attend your committed session — if you need to change which session you train at, speak to your coach.\n\nGETTING STARTED\nTo activate your membership, log in and complete the payment setup. Your membership will begin on ${startStr}.\n${BASE_URL()}/booking/my-account\n\nIf you have any questions, please contact the club.`,
    }, { to: email, gymnast: `${gymnast.firstName} ${gymnast.lastName}`, amount, startStr });
  }

  // Booking confirmation receipt
  async sendBookingReceiptEmail(email, firstName, sessions, totalAmountPence) {
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const totalStr = totalAmountPence > 0 ? `£${(totalAmountPence / 100).toFixed(2)}` : 'Covered by credits';

    const sessionBlocks = sessions.map(s => {
      const gymnasts = s.gymnasts.map(g => `${g.firstName} ${g.lastName}`).join(', ');
      return `<div style="margin-bottom:0.75rem;padding:0.6rem 0.85rem;background:#f9f9fb;border-radius:6px;border:1px solid #e4e4e8">
        <p style="margin:0 0 0.2rem;font-weight:700;color:#1a1a1a">${fmtDate(s.date)} &mdash; ${s.startTime}–${s.endTime}</p>
        <p style="margin:0;font-size:0.9rem;color:#555">${gymnasts}</p>
      </div>`;
    }).join('');

    const textLines = sessions.map(s => {
      const gymnasts = s.gymnasts.map(g => `${g.firstName} ${g.lastName}`).join(', ');
      return `• ${fmtDate(s.date)} ${s.startTime}–${s.endTime}: ${gymnasts}`;
    }).join('\n');

    const plural = sessions.length !== 1 ? 's' : '';
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: sessions.length === 1
        ? `Booking confirmed — ${fmtDate(sessions[0].date)} ${sessions[0].startTime}`
        : `Booking confirmed — ${sessions.length} session${plural}`,
      html: brandedHtml('Booking confirmed', `
        <p style="margin-top:0">Hi ${firstName},</p>
        <p>Your booking${plural} ${sessions.length === 1 ? 'is' : 'are'} confirmed.</p>
        ${sessionBlocks}
        ${infoBox(`<p style="margin:0"><strong>Total paid:</strong> ${totalStr}</p>`)}
        ${ctaButton(`${BASE_URL()}/booking/my-bookings`, 'View my bookings')}
        ${muted('You can view your upcoming bookings in the app at any time.')}
      `),
      text: `Hi ${firstName},\n\nYour booking${plural} ${sessions.length === 1 ? 'is' : 'are'} confirmed:\n\n${textLines}\n\nTotal paid: ${totalStr}\n\nYou can view upcoming bookings in the app.`,
    }, { to: email, sessions: sessions.length, total: totalStr });
  }

  // Fetch booking data, check preferences, and send receipt — call from routes/webhook
  async trySendBookingReceipt(userId, bookingIds, prisma) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, bookingReceiptEmail: true, club: { select: { emailEnabled: true } } },
      });
      if (!user?.email || user.bookingReceiptEmail === false || !user.club?.emailEnabled) return;

      const bookings = await prisma.booking.findMany({
        where: { id: { in: bookingIds }, status: 'CONFIRMED' },
        include: {
          sessionInstance: { include: { template: { select: { startTime: true, endTime: true } } } },
          lines: { include: { gymnast: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { sessionInstance: { date: 'asc' } },
      });
      if (bookings.length === 0) return;

      const sessions = bookings.map(b => ({
        date: b.sessionInstance.date,
        startTime: b.sessionInstance.template.startTime,
        endTime: b.sessionInstance.template.endTime,
        gymnasts: b.lines.map(l => l.gymnast),
      }));
      const total = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
      await this.sendBookingReceiptEmail(user.email, user.firstName, sessions, total);
    } catch (err) {
      console.error('Booking receipt email failed:', err);
    }
  }

  async sendWaitlistOfferEmail(email, firstName, sessionDate, startTime, endTime, offerType, offerExpiresAt) {
    const d = new Date(sessionDate);
    const dateStr = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = `${startTime}–${endTime}`;

    const isOpen = offerType === 'OPEN';
    const subject = isOpen
      ? `Last-minute slot — ${dateStr} at ${startTime}`
      : `A slot has opened up — ${dateStr} at ${startTime}`;

    const expiryLine = offerExpiresAt
      ? `<p>It's being held for you until <strong>${new Date(offerExpiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</strong>. Open the app to claim it.</p>`
      : `<p>Open the app to claim it — it's first come, first served.</p>`;

    const expiryText = offerExpiresAt
      ? `It's being held for you until ${new Date(offerExpiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. Open the app to claim it.`
      : `Open the app to claim it — it's first come, first served.`;

    const intro = isOpen
      ? `<p>A spot has come up in your session on <strong>${dateStr} at ${timeStr}</strong>. Since it's close to session time, we've let everyone on the waitlist know.</p>`
      : `<p>A spot has become available in your session on <strong>${dateStr} at ${timeStr}</strong>.</p>`;

    const introText = isOpen
      ? `A spot has come up in your session on ${dateStr} at ${timeStr}. Since it's close to session time, we've let everyone on the waitlist know.`
      : `A spot has become available in your session on ${dateStr} at ${timeStr}.`;

    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject,
      html: brandedHtml(subject, `
        <p style="margin-top:0">Hi ${firstName},</p>
        ${intro}
        ${expiryLine}
        ${ctaButton(`${BASE_URL()}/booking`, 'Open the app')}
        ${muted('You can view your waitlist in My Bookings.')}
      `),
      text: `Hi ${firstName},\n\n${introText}\n\n${expiryText}`,
    }, { to: email, session: `${dateStr} ${timeStr}`, offerType });
  }

  async trySendWaitlistOffer(userId, sessionDate, startTime, endTime, offerType, offerExpiresAt, prisma) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, club: { select: { emailEnabled: true } } },
      });
      if (!user?.email || !user.club?.emailEnabled) return;
      await this.sendWaitlistOfferEmail(user.email, user.firstName, sessionDate, startTime, endTime, offerType, offerExpiresAt);
    } catch (err) {
      console.error('Waitlist offer email failed:', err);
    }
  }

  async sendCompetitionInviteEmail(email, firstName, gymnast, event, categoryNames, priceOverridePence) {
    const date = new Date(event.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const deadline = new Date(event.entryDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const categoriesHtml = categoryNames.length > 0
      ? `<p style="margin:0.2rem 0"><strong>Categories:</strong> ${categoryNames.join(', ')}</p>`
      : '';
    const priceHtml = priceOverridePence !== null
      ? `<p style="margin:0.2rem 0"><strong>Entry price:</strong> £${(priceOverridePence / 100).toFixed(2)} (club price)</p>`
      : '';
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: `Competition invitation: ${event.name}`,
      html: brandedHtml('Competition invitation', `
        <p style="margin-top:0">Hi ${firstName},</p>
        <p><strong>${gymnast.firstName} ${gymnast.lastName}</strong> has been invited to enter the following competition:</p>
        ${infoBox(`
          <p style="margin:0.2rem 0"><strong>Competition:</strong> ${event.name}</p>
          <p style="margin:0.2rem 0"><strong>Location:</strong> ${event.location}</p>
          <p style="margin:0.2rem 0"><strong>Date:</strong> ${date}</p>
          <p style="margin:0.2rem 0"><strong>Entry deadline:</strong> ${deadline}</p>
          ${categoriesHtml}
          ${priceHtml}
        `)}
        ${ctaButton(`${BASE_URL()}/booking/competitions`, 'View and respond')}
        ${muted('If you have any questions, please contact the club.')}
      `),
      text: `Hi ${firstName},\n\n${gymnast.firstName} ${gymnast.lastName} has been invited to ${event.name} at ${event.location} on ${date}.\n\nEntry deadline: ${deadline}${categoryNames.length > 0 ? '\nCategories: ' + categoryNames.join(', ') : ''}${priceOverridePence !== null ? '\nEntry price: £' + (priceOverridePence / 100).toFixed(2) : ''}\n\nLog in to respond: ${BASE_URL()}/booking/competitions\n\nIf you have any questions, please contact the club.`,
    }, { to: email, event: event.name, gymnast: `${gymnast.firstName} ${gymnast.lastName}` });
  }

  // ---------------------------------------------------------------------------
  // Incident report emails
  // ---------------------------------------------------------------------------

  async sendIncidentAdultNotification(email, recipientName, gymnast, incident, reportUrl) {
    const gymnástName = `${gymnast.firstName} ${gymnast.lastName}`;
    const SEVERITY_LABEL = { MINOR: 'Minor', MODERATE: 'Moderate', SEVERE: 'Severe' };
    const TYPE_LABEL = { INJURY: 'Injury', NEAR_MISS: 'Near miss', ILLNESS: 'Illness', OTHER: 'Other' };
    const incidentDateStr = new Date(incident.incidentDate).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: `Incident report: ${gymnástName}`,
      html: brandedHtml('Incident report notification', `
        <p style="margin-top:0">Hi ${recipientName},</p>
        <p>An incident report has been filed regarding <strong>${gymnástName}</strong>. Your coach will have spoken to you about this in person. You can view the full report at any time using the link below.</p>
        ${infoBox(`
          <p style="margin:0 0 0.4rem"><strong>Date:</strong> ${incidentDateStr}</p>
          ${incident.location ? `<p style="margin:0 0 0.4rem"><strong>Location:</strong> ${incident.location}</p>` : ''}
          <p style="margin:0 0 0.4rem"><strong>Type:</strong> ${TYPE_LABEL[incident.incidentType] ?? incident.incidentType}</p>
          <p style="margin:0"><strong>Severity:</strong> ${SEVERITY_LABEL[incident.severity] ?? incident.severity}</p>
        `)}
        ${ctaButton(reportUrl, 'View incident report')}
        ${muted('If you have any questions or concerns, please contact your club directly.')}
      `),
      text: `Hi ${recipientName},\n\nAn incident report has been filed regarding ${gymnástName}.\n\nDate: ${incidentDateStr}\nType: ${TYPE_LABEL[incident.incidentType] ?? incident.incidentType}\nSeverity: ${SEVERITY_LABEL[incident.severity] ?? incident.severity}\n\nView the full report at: ${reportUrl}\n\nIf you have any questions, please contact your club directly.`,
    }, { to: email, gymnástName });
  }

  async sendIncidentForwardEmail(toEmail, toName, gymnast, incident, forwardedByName, note, reportUrl) {
    const gymnástName = `${gymnast.firstName} ${gymnast.lastName}`;
    const TYPE_LABEL = { INJURY: 'Injury', NEAR_MISS: 'Near miss', ILLNESS: 'Illness', OTHER: 'Other' };
    const SEVERITY_LABEL = { MINOR: 'Minor', MODERATE: 'Moderate', SEVERE: 'Severe' };
    const incidentDateStr = new Date(incident.incidentDate).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: toEmail,
      subject: `Incident report forwarded: ${gymnástName}`,
      html: brandedHtml('Incident report', `
        <p style="margin-top:0">Hi${toName ? ` ${toName}` : ''},</p>
        <p>An incident report has been forwarded to you by <strong>${forwardedByName}</strong> regarding <strong>${gymnástName}</strong>.</p>
        ${infoBox(`
          <p style="margin:0 0 0.4rem"><strong>Date:</strong> ${incidentDateStr}</p>
          ${incident.location ? `<p style="margin:0 0 0.4rem"><strong>Location:</strong> ${incident.location}</p>` : ''}
          <p style="margin:0 0 0.4rem"><strong>Type:</strong> ${TYPE_LABEL[incident.incidentType] ?? incident.incidentType}</p>
          <p style="margin:0 0 0.4rem"><strong>Severity:</strong> ${SEVERITY_LABEL[incident.severity] ?? incident.severity}</p>
          <p style="margin:0 0 0.4rem"><strong>Description:</strong> ${incident.description}</p>
          ${incident.injuryDetails ? `<p style="margin:0 0 0.4rem"><strong>Injury/Symptoms:</strong> ${incident.injuryDetails}</p>` : ''}
          ${incident.firstAidGiven ? `<p style="margin:0 0 0.4rem"><strong>First aid given:</strong> ${incident.firstAidGiven}</p>` : ''}
          ${incident.outcome ? `<p style="margin:0"><strong>Outcome:</strong> ${incident.outcome}</p>` : ''}
        `)}
        ${note ? `${h3('Note from sender')}<p>${note}</p>` : ''}
        ${muted('This report was forwarded from Trampoline Life. Please contact the club if you have any questions.')}
      `),
      text: `Hi${toName ? ` ${toName}` : ''},\n\nAn incident report has been forwarded to you by ${forwardedByName} regarding ${gymnástName}.\n\nDate: ${incidentDateStr}\nType: ${TYPE_LABEL[incident.incidentType] ?? incident.incidentType}\nSeverity: ${SEVERITY_LABEL[incident.severity] ?? incident.severity}\nDescription: ${incident.description}\n${note ? `\nNote: ${note}\n` : ''}\nPlease contact the club if you have any questions.`,
    }, { to: toEmail, gymnástName });
  }
}


module.exports = new EmailService();
