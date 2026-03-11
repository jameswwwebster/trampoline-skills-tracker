const emailService = require('./emailService');

// Local copies of emailService template helpers (module-level functions in emailService.js)
function brandedHtml(subtitle, bodyHtml) {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
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

function h3(text) {
  return `<h3 style="color:#7c35e8;font-size:0.95rem;margin:1.5rem 0 0.4rem">${text}</h3>`;
}

function infoBox(html) {
  return `<div style="background:#f3eefe;border-left:4px solid #7c35e8;border-radius:0 6px 6px 0;padding:14px 18px;margin:1rem 0">${html}</div>`;
}

function muted(text) {
  return `<p style="margin-bottom:0;color:#888888;font-size:0.85rem">${text}</p>`;
}

class ShopEmailService {
  // Called from webhook when payment_intent.succeeded for a shop order
  async sendOrderConfirmationEmail(user, order) {
    const itemsHtml = order.items
      .map(item => `
        <tr>
          <td style="padding: 6px 0;">${item.productName}</td>
          <td style="padding: 6px 0;">${item.size}${item.customisation ? ` (${item.customisation})` : ''}</td>
          <td style="padding: 6px 0;">×${item.quantity}</td>
          <td style="padding: 6px 0; text-align:right;">£${((item.price * item.quantity) / 100).toFixed(2)}</td>
        </tr>
      `)
      .join('');

    const bodyHtml = `
      ${h3('Your order has been placed!')}
      <p>Hi ${user.firstName},</p>
      <p>Thanks for your order. We'll let you know by email when your kit arrives at the club.</p>
      ${infoBox(`
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="border-bottom: 1px solid #ddd;">
              <th style="text-align:left; padding: 6px 0;">Item</th>
              <th style="text-align:left; padding: 6px 0;">Size</th>
              <th style="text-align:left; padding: 6px 0;">Qty</th>
              <th style="text-align:right; padding: 6px 0;">Price</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
          <tfoot>
            <tr style="border-top: 1px solid #ddd;">
              <td colspan="3" style="padding: 8px 0; font-weight: bold;">Total</td>
              <td style="padding: 8px 0; text-align:right; font-weight: bold;">£${(order.total / 100).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      `)}
      ${muted('Kit is collected from the club — no delivery.')}
    `;

    return emailService._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: user.email,
      subject: 'Your Trampoline Life kit order',
      html: brandedHtml('Kit Order Confirmation', bodyHtml),
    }, `[SHOP] Order confirmation → ${user.email}`);
  }

  async sendOrderArrivedEmail(user, order) {
    const bodyHtml = `
      ${h3('Your kit has arrived!')}
      <p>Hi ${user.firstName},</p>
      <p>Your kit order has arrived at the club. You can collect it at your next session.</p>
      ${muted(`Order reference: ${order.id}`)}
    `;

    return emailService._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: user.email,
      subject: 'Your Trampoline Life kit has arrived',
      html: brandedHtml('Kit Order Arrived', bodyHtml),
    }, `[SHOP] Order arrived → ${user.email}`);
  }

  async sendOrderFulfilledEmail(user, order) {
    const bodyHtml = `
      ${h3('Order collected — enjoy!')}
      <p>Hi ${user.firstName},</p>
      <p>Your kit order has been marked as collected. Enjoy your new kit!</p>
      ${muted(`Order reference: ${order.id}`)}
    `;

    return emailService._send({
      from: process.env.EMAIL_FROM || 'noreply@trampolinelife.com',
      to: user.email,
      subject: 'Your Trampoline Life kit — order complete',
      html: brandedHtml('Kit Order Complete', bodyHtml),
    }, `[SHOP] Order fulfilled → ${user.email}`);
  }
}

module.exports = new ShopEmailService();
