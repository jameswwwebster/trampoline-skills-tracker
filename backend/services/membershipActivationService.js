/**
 * Activates a SCHEDULED membership:
 * - Creates Stripe customer if needed
 * - Applies available credits
 * - Creates Stripe subscription
 * - Updates membership status to ACTIVE or PENDING_PAYMENT
 * - Sends membership created email
 */
async function activateMembership(membershipId, prisma, options = {}) {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: {
      gymnast: {
        include: { guardians: { orderBy: { createdAt: 'asc' }, take: 1 } },
      },
    },
  });

  if (!membership) throw new Error(`Membership ${membershipId} not found`);
  if (membership.status !== 'SCHEDULED') {
    throw new Error(`Membership ${membershipId} is not SCHEDULED (current: ${membership.status})`);
  }

  const gymnast = membership.gymnast;
  const guardian = gymnast.guardians[0];
  if (!guardian) {
    console.error(`No guardian for membership ${membershipId}, skipping activation`);
    return;
  }

  let newStatus = 'ACTIVE';
  let stripeSubscriptionId = null;
  let needsPaymentMethod = false;

  if (membership.monthlyAmount === 0) {
    // No Stripe subscription for free memberships — defaults already correct
  } else if (process.env.STRIPE_SECRET_KEY) {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    // Create or retrieve Stripe customer
    let stripeCustomerId = guardian.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: guardian.email,
        name: `${guardian.firstName} ${guardian.lastName}`,
        metadata: { userId: guardian.id },
      });
      stripeCustomerId = customer.id;
      await prisma.user.update({ where: { id: guardian.id }, data: { stripeCustomerId } });
    }

    // Apply available credits as Stripe customer balance before subscription creation
    const availableCredits = await prisma.credit.findMany({
      where: { userId: guardian.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
    });
    const totalCreditAmount = availableCredits.reduce((sum, c) => sum + c.amount, 0);

    if (totalCreditAmount > 0) {
      await stripe.customers.createBalanceTransaction(stripeCustomerId, {
        amount: -totalCreditAmount,
        currency: 'gbp',
        description: 'Session credits applied to first membership payment',
      });
    }

    // billing_cycle_anchor = 1st of the month after startDate (UTC)
    const startDate = new Date(membership.startDate);
    const anchorDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1));
    const billingCycleAnchor = Math.floor(anchorDate.getTime() / 1000);

    // If startDate midnight is in the future, use trial_end so the first full billing
    // period aligns exactly with startDate → no pro-ration for partial activation-day hours.
    const startDateMidnightUTC = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const now = new Date();
    const trialEnd = startDateMidnightUTC > now ? Math.floor(startDateMidnightUTC.getTime() / 1000) : undefined;

    // Find a usable card on the customer. The previous check only honoured
    // `invoice_settings.default_payment_method`, but our sub-creation uses
    // `save_default_payment_method: 'on_subscription'` which attaches the
    // card to the *subscription* and not the customer's invoice default.
    // Once that sub is cancelled the customer is left with attached payment
    // methods but no invoice default — and we'd create the next sub with no
    // card, so recurring charges never auto-fired.
    const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);
    let defaultPaymentMethodId = stripeCustomer.invoice_settings?.default_payment_method ?? null;
    if (typeof defaultPaymentMethodId === 'object' && defaultPaymentMethodId) {
      defaultPaymentMethodId = defaultPaymentMethodId.id;
    }
    if (!defaultPaymentMethodId) {
      const pms = await stripe.paymentMethods.list({ customer: stripeCustomerId, type: 'card', limit: 5 });
      if (pms.data.length > 0) {
        defaultPaymentMethodId = pms.data[0].id;
        await stripe.customers.update(stripeCustomerId, {
          invoice_settings: { default_payment_method: defaultPaymentMethodId },
        });
      }
    }
    const hasDefaultPaymentMethod = !!defaultPaymentMethodId;
    // When charging a fixed first-month amount, always use default_incomplete so Stripe
    // creates an immediate invoice (which picks up the invoice item). With allow_incomplete
    // and proration_behavior:'none', Stripe skips the initial invoice entirely and the
    // invoice item floats to the next billing date, causing a double charge.
    const useFixedFirstMonth = options.firstMonthAmount !== undefined && options.firstMonthAmount !== null;
    const paymentBehavior = (hasDefaultPaymentMethod && !useFixedFirstMonth) ? 'allow_incomplete' : 'default_incomplete';

    const stripeProduct = await stripe.products.create({
      name: `Trampoline Life Membership — ${gymnast.firstName} ${gymnast.lastName}`,
    });

    // If a fixed first-month amount is specified, add it as an invoice item that will
    // be picked up on the subscription's initial invoice (created because default_incomplete
    // always generates one). Otherwise Stripe prorates from startDate to anchor.
    if (useFixedFirstMonth && options.firstMonthAmount > 0) {
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        amount: options.firstMonthAmount,
        currency: 'gbp',
        description: `First month membership — ${gymnast.firstName} ${gymnast.lastName}`,
      });
    }

    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{
        price_data: {
          currency: 'gbp',
          product: stripeProduct.id,
          unit_amount: membership.monthlyAmount,
          recurring: { interval: 'month' },
        },
      }],
      billing_cycle_anchor: billingCycleAnchor,
      proration_behavior: useFixedFirstMonth ? 'none' : 'create_prorations',
      ...(trialEnd ? { trial_end: trialEnd } : {}),
      payment_behavior: paymentBehavior,
      payment_settings: { save_default_payment_method: 'on_subscription' },
      ...(defaultPaymentMethodId ? { default_payment_method: defaultPaymentMethodId } : {}),
      expand: ['latest_invoice'],
      metadata: { clubId: membership.clubId, gymnastId: gymnast.id },
    });

    stripeSubscriptionId = subscription.id;

    const firstInvoice = subscription.latest_invoice;
    const invoiceTotal = firstInvoice?.total ?? 0;
    const invoiceAmountDue = firstInvoice?.amount_due ?? 0;
    const creditsConsumed = Math.max(0, invoiceTotal - invoiceAmountDue);

    // Mark consumed credits as used (oldest first, split if needed)
    if (creditsConsumed > 0) {
      let remaining = creditsConsumed;
      for (const credit of availableCredits) {
        if (remaining <= 0) break;
        if (credit.amount <= remaining) {
          await prisma.credit.update({ where: { id: credit.id }, data: { usedAt: new Date() } });
          remaining -= credit.amount;
        } else {
          await prisma.credit.update({ where: { id: credit.id }, data: { amount: remaining, usedAt: new Date() } });
          await prisma.credit.create({
            data: {
              userId: guardian.id,
              amount: credit.amount - remaining,
              expiresAt: credit.expiresAt,
              sourceBookingId: credit.sourceBookingId,
            },
          });
          remaining = 0;
        }
      }
    }

    // Restore any unused credit balance
    if (totalCreditAmount > creditsConsumed) {
      await stripe.customers.createBalanceTransaction(stripeCustomerId, {
        amount: totalCreditAmount - creditsConsumed,
        currency: 'gbp',
        description: 'Unused session credit balance restored',
      });
    }

    newStatus = invoiceAmountDue === 0 ? 'ACTIVE' : 'PENDING_PAYMENT';
    // needsPaymentMethod = true only when there's no PM on file (e.g. credits
    // covered the first invoice but no card saved for future recurring charges).
    // If a PM already exists, Stripe will auto-charge future invoices.
    needsPaymentMethod = newStatus === 'ACTIVE' && !hasDefaultPaymentMethod;
  }

  await prisma.membership.update({
    where: { id: membershipId },
    data: { stripeSubscriptionId, status: newStatus, needsPaymentMethod },
  });

  // Send email to guardian
  if (!options.skipEmail) {
    try {
      const emailService = require('./emailService');
      await emailService.sendMembershipCreatedEmail(
        guardian.email,
        guardian.firstName,
        gymnast,
        membership.monthlyAmount,
      );
    } catch (emailErr) {
      console.error('Failed to send membership activation email:', emailErr);
    }
  }

  // If we ended up ACTIVE without a card on file (e.g. Stripe customer
  // balance covered the first invoice), flag this to coaches/admins so
  // they can chase the parent before the next cycle silently fails.
  if (needsPaymentMethod && !options.skipEmail) {
    try {
      const emailService = require('./emailService');
      const club = await prisma.club.findUnique({ where: { id: membership.clubId }, select: { emailEnabled: true } });
      if (club?.emailEnabled) {
        const coaches = await prisma.user.findMany({
          where: {
            clubId: membership.clubId,
            role: { in: ['CLUB_ADMIN', 'COACH'] },
            isArchived: false,
            email: { not: null },
            coachLapseAlerts: true,
          },
          select: { email: true, firstName: true },
        });
        const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
        const membershipsUrl = `${FRONTEND_URL}/booking/admin/memberships`;
        for (const coach of coaches) {
          await emailService.sendMembershipActivatedWithoutCardEmail({
            coachEmail: coach.email,
            coachName: coach.firstName,
            gymnast,
            parentName: `${guardian.firstName} ${guardian.lastName}`,
            monthlyAmount: membership.monthlyAmount,
            membershipsUrl,
          }).catch(err => console.error('Coach no-card email failed:', err.message));
        }
      }
    } catch (err) {
      console.error('Failed to alert coaches about missing card:', err.message);
    }
  }

  console.log(`Activated membership ${membershipId} → ${newStatus}${needsPaymentMethod ? ' (no card on file)' : ''}`);
}

module.exports = { activateMembership };
