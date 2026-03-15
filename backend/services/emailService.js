const nodemailer = require('nodemailer');

// ---------------------------------------------------------------------------
// Shared branded template helpers
// ---------------------------------------------------------------------------

const BASE_URL = () => process.env.FRONTEND_URL || 'http://localhost:3000';

function brandedHtml(subtitle, bodyHtml) {
  const base = BASE_URL();
  return `<div style="font-family:'Exo 2',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #d4d4d8">
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
  </div>`;
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
        <p>Your account has been created by your club administrator. You can now log in to Trampoline Life to manage bookings and track progress.</p>
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
    const acceptUrl = `${BASE_URL()}/parent-connection-request?requestId=${requestId}`;
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
        <p>As a guardian you'll be able to view ${gymnastName}'s progress, receive certificate notifications, and manage bookings.</p>
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
      `),
      text: `Hi ${userName},\n\nWe've received your membership payment of ${amount} for ${gymnast.firstName} ${gymnast.lastName}.\n\nYour next payment of ${amount} will be taken on ${nextDate}.\n\nThanks for being a member of Trampoline Life!`,
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

        ${h3('Flexibility')}
        <p style="margin-top:0">Your membership covers your agreed number of sessions each week, but you have flexibility in how you use them. If you normally train on a Tuesday but a Thursday works better one week, that's absolutely fine — just attend the session you need. As a member, you no longer need to sign up to individual sessions in advance.</p>

        ${h3('Your first payment')}
        <p style="margin-top:0">Your first payment will be a pro-rated amount covering the remainder of the current month. From the 1st of next month you'll be charged the full ${amount} each month.</p>

        ${h3('Getting started')}
        <p style="margin-top:0">To activate your membership, please log in to your account and complete the payment setup.</p>
        ${ctaButton(loginUrl, 'Set up payment')}
        ${muted('If you have any questions, please contact the club.')}
      `),
      text: `Hi ${guardianName},\n\nA monthly membership of ${amount}/month has been set up for ${gymnast.firstName} ${gymnast.lastName}.\n\nHOW YOUR FEE IS CALCULATED\nYour monthly fee is based on a training year of 46 weeks, using the number of sessions per week we have agreed together. We divide the total annual cost by 12 to give you a consistent monthly payment.\n\nFLEXIBILITY\nYou have flexibility in how you use your sessions. If you normally train on a Tuesday but a Thursday works better one week, that's fine — just attend the session you need. As a member, you no longer need to sign up to individual sessions in advance.\n\nYOUR FIRST PAYMENT\nYour first payment will be a pro-rated amount covering the remainder of the current month. From the 1st of next month you'll be charged the full ${amount} each month.\n\nGETTING STARTED\nTo activate your membership, log in and complete the payment setup:\n${loginUrl}\n\nIf you have any questions, please contact the club.`,
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
        <p>Here's a look at what's available to book this week:</p>
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
        ${ctaButton(`${base}/booking`, 'Book a session')}
        ${muted('To stop receiving these weekly emails, log in and update your notification preferences in My Account.')}
      `),
      text: `Hi ${firstName},\n\nHere are the sessions available to book this week:\n\n${sessions.map(s => {
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
        </table>`,
      ),
    });
  }

  async sendChargeCreatedEmail(email, firstName, description, amountPence, dueDate) {
    const amount = `£${(amountPence / 100).toFixed(2)}`;
    const due = new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: 'A charge has been added to your account',
      html: brandedHtml('Charge added', `
        <p style="margin-top:0">Hi ${firstName},</p>
        <p>A charge of <strong style="color:#e74c3c">${amount}</strong> has been added to your account.</p>
        ${infoBox(`
          <p style="margin:0.2rem 0"><strong>Description:</strong> ${description}</p>
          <p style="margin:0.2rem 0"><strong>Due by:</strong> ${due}</p>
        `)}
        <p>You can pay this via the cart when you next book.</p>
        ${muted('If you have any questions, please contact the club.')}
      `),
      text: `Hi ${firstName},\n\nA charge of ${amount} has been added to your account.\n\nDescription: ${description}\nDue by: ${due}\n\nYou can pay this via the cart when you next book.\n\nIf you have any questions, please contact the club.`,
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
        ${muted('If you have any questions, please contact the club.')}
      `),
      text: `Hi ${firstName},\n\nA charge of ${amount} (${description}) has been cancelled. No payment is required.\n\nIf you have any questions, please contact the club.`,
    }, { to: email, amount, description });
  }

  async sendCreditAssignedEmail(email, firstName, amountPence, expiresAt) {
    const amount = `£${(amountPence / 100).toFixed(2)}`;
    const expiry = new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return this._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: email,
      subject: 'A credit has been added to your account',
      html: brandedHtml('Credit added', `
        <p style="margin-top:0">Hi ${firstName},</p>
        <p>A credit of <strong style="color:#7c35e8">${amount}</strong> has been added to your account.</p>
        ${infoBox(`<p style="margin:0">Expires: <strong>${expiry}</strong></p>`)}
        <p>Credits are applied automatically at checkout.</p>
        ${muted('If you have any questions, please contact the club.')}
      `),
      text: `Hi ${firstName},\n\nA credit of ${amount} has been added to your account. It expires on ${expiry}.\n\nCredits are applied automatically at checkout.\n\nIf you have any questions, please contact the club.`,
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
        <p>You can now view ${gymnastName}'s progress, receive certificate notifications, and manage bookings.</p>
        ${muted('Welcome to Trampoline Life!')}
      `),
      text: `Hello ${guardianName},\n\nYou have been connected as a guardian for ${gymnastName} at ${clubName}.\n\nRelationship: ${relationship}\n\nWelcome to Trampoline Life!`,
    }, { to: guardianEmail, gymnast: gymnastName, club: clubName });
  }
}

module.exports = new EmailService();
