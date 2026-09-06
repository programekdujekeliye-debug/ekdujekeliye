import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import crypto from 'crypto';
import { MongoClient } from 'mongodb';

const prodUri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let clean = String(phone).replace(/\D/g, '');
  if (clean.length === 11 && clean.startsWith('0')) clean = clean.substring(1);
  if (clean.length === 10) clean = '91' + clean;
  return clean;
}

function maskPhoneNumber(phone) {
  const norm = normalizePhoneNumber(phone);
  if (!norm || norm.length < 6) return '****';
  return norm.substring(0, 4) + '****' + norm.substring(norm.length - 2);
}

async function run() {
  console.log('================================================================');
  console.log('EDKL PRODUCTION ACTIVATION: EK06 + EK07 NORMAL PAID MODE');
  console.log('7 SEPTEMBER 2026 + 11 SEPTEMBER 2026');
  console.log('================================================================\n');

  const client = new MongoClient(prodUri, {
    family: 4,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 15000
  });

  await client.connect();
  const db = client.db('ekdujekeliye');
  console.log('✓ Connected to MongoDB Atlas production database (ekdujekeliye).\n');

  const PROGRAM_NAME = 'Ek Duje Ke Liye - Sardar Patel Smruti Bhavan';
  const VENUE_NAME = 'Sardar Patel Smruti Bhavan, Varachha, Surat';
  const MAP_URL = 'https://share.google/y1jtFAZXuKusYTiUD';
  const activationTimestamp = new Date();

  // -------------------------------------------------------------------------
  // STEP 0 — SNAPSHOT & VERIFICATION OF EVENTS
  // -------------------------------------------------------------------------
  console.log('================ STEP 0: EVENT VERIFICATION ================');
  
  // Verify EK06
  const ek06Event = await db.collection('program').findOne({
    $or: [{ sequenceNumber: 6 }, { id: 'prog-2026-09-07' }, { date: '2026-09-07' }]
  });

  if (!ek06Event) {
    throw new Error('[FATAL] EK06 Event record not found in production DB.');
  }

  console.log(`✓ EK06 Found -> ID: "${ek06Event.id}" | Date: ${ek06Event.date} | Slug: "${ek06Event.slug}" | Price: ₹${ek06Event.price || 1500} | Cap: ${ek06Event.capacity || 500}`);

  // Verify EK07 (and clean any legacy 12-Sep / prog-2026-09-12 references)
  const ek07Event = await db.collection('program').findOne({
    $or: [{ sequenceNumber: 7 }, { id: 'prog-2026-09-11' }, { id: 'prog-2026-09-12' }, { date: '2026-09-11' }, { date: '2026-09-12' }]
  });

  if (!ek07Event) {
    throw new Error('[FATAL] EK07 Event record not found in production DB.');
  }

  console.log(`✓ EK07 Found -> ID: "${ek07Event.id}" | Existing Date: ${ek07Event.date} | Slug: "${ek07Event.slug}" | Price: ₹${ek07Event.price || 1500} | Cap: ${ek07Event.capacity || 500}`);

  // -------------------------------------------------------------------------
  // STEP 1 — 11 SEPTEMBER UNIFICATION & EVENT CONFIGURATION UPDATE
  // -------------------------------------------------------------------------
  console.log('\n================ STEP 1: EVENT NORMAL MODE ACTIVATION ================');

  // Update EK06 in 'program' and 'programs'
  const ek06OpenedAt = ek06Event.paymentOpenedAt ? new Date(ek06Event.paymentOpenedAt) : activationTimestamp;
  const ek06Update = {
    $set: {
      id: 'prog-2026-09-07',
      sequenceNumber: 6,
      name: PROGRAM_NAME,
      slug: 'surat-7-september-2026',
      city: 'Surat',
      venue: VENUE_NAME,
      mapUrl: MAP_URL,
      price: ek06Event.price || 1500,
      status: 'upcoming',
      isInquiryClosed: false,
      isRegistrationOpen: true,
      isPaymentEnabled: true,
      earlyRegistrationMode: false,
      personalizedInvitationEnabled: false,
      communicationsEnabled: true,
      paymentOpenedAt: ek06OpenedAt,
      paymentOpeningNote: '',
      isDateFinal: true,
      capacity: ek06Event.capacity || 500,
      time: '8:30 PM',
      date: '2026-09-07'
    }
  };

  await db.collection('program').updateOne({ _id: ek06Event._id }, ek06Update);
  await db.collection('programs').updateOne(
    { $or: [{ sequenceNumber: 6 }, { id: 'prog-2026-09-07' }] },
    ek06Update,
    { upsert: true }
  );
  console.log('✓ EK06 (7 Sep) updated -> Normal Mode: isPaymentEnabled=true, earlyRegistrationMode=false, personalizedInvitationEnabled=false');

  // Update EK07 in 'program' and 'programs' (Standardizing strictly to 11 September 2026)
  const ek07OpenedAt = ek07Event.paymentOpenedAt ? new Date(ek07Event.paymentOpenedAt) : activationTimestamp;
  const ek07Update = {
    $set: {
      id: 'prog-2026-09-11',
      sequenceNumber: 7,
      name: PROGRAM_NAME,
      slug: 'surat-11-september-2026',
      city: 'Surat',
      venue: VENUE_NAME,
      mapUrl: MAP_URL,
      price: ek07Event.price || 1500,
      status: 'upcoming',
      isInquiryClosed: false,
      isRegistrationOpen: true,
      isPaymentEnabled: true,
      earlyRegistrationMode: false,
      personalizedInvitationEnabled: false,
      communicationsEnabled: true,
      paymentOpenedAt: ek07OpenedAt,
      paymentOpeningNote: '',
      isDateFinal: true,
      capacity: ek07Event.capacity || 500,
      time: '8:30 PM',
      date: '2026-09-11'
    }
  };

  await db.collection('program').updateOne({ _id: ek07Event._id }, ek07Update);
  await db.collection('programs').updateOne(
    { $or: [{ sequenceNumber: 7 }, { id: 'prog-2026-09-11' }, { id: 'prog-2026-09-12' }] },
    ek07Update,
    { upsert: true }
  );

  // Clean duplicate legacy prog-2026-09-12 records if any
  await db.collection('program').deleteMany({ id: 'prog-2026-09-12' });
  await db.collection('programs').deleteMany({ id: 'prog-2026-09-12' });
  console.log('✓ EK07 (11 Sep) updated -> Normal Mode: isPaymentEnabled=true, earlyRegistrationMode=false, personalizedInvitationEnabled=false (Legacy 12 Sep cleaned)');

  // -------------------------------------------------------------------------
  // STEP 2 — UNIFY ALL REGISTRATIONS & COUNTERS
  // -------------------------------------------------------------------------
  console.log('\n================ STEP 2: REGISTRATIONS & COUNTER UNIFICATION ================');

  // EK06 Registrations
  const ek06RegSync = await db.collection('submission').updateMany(
    {
      isDeleted: { $ne: true },
      $or: [
        { inquiryId: /^EK06-/ },
        { programDate: '2026-09-07' },
        { programId: 'prog-2026-09-07' }
      ]
    },
    {
      $set: {
        programId: 'prog-2026-09-07',
        programDate: '2026-09-07',
        programName: PROGRAM_NAME,
        programVenue: VENUE_NAME,
        programTime: '8:30 PM'
      }
    }
  );
  console.log(`✓ EK06 Submissions synchronized: ${ek06RegSync.modifiedCount} updated`);

  // EK07 Registrations -> Strictly 11 September 2026
  const ek07RegSync = await db.collection('submission').updateMany(
    {
      isDeleted: { $ne: true },
      $or: [
        { inquiryId: /^EK07-/ },
        { programDate: { $in: ['2026-09-11', '2026-09-12'] } },
        { programId: { $in: ['prog-2026-09-11', 'prog-2026-09-12', 'prog-1787844313509-02'] } }
      ]
    },
    {
      $set: {
        programId: 'prog-2026-09-11',
        programDate: '2026-09-11',
        programName: PROGRAM_NAME,
        programVenue: VENUE_NAME,
        programTime: '8:30 PM'
      }
    }
  );
  console.log(`✓ EK07 Submissions unified to 11 September: ${ek07RegSync.modifiedCount} updated`);

  // Synchronize Counter for EK07 -> inquiryNumber_prog-2026-09-11
  const ek07All = await db.collection('submission').find({ inquiryId: /^EK07-/ }).toArray();
  let maxEk07 = 0;
  ek07All.forEach(r => {
    const m = r.inquiryId.match(/^EK07-(\d+)/);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num > maxEk07) maxEk07 = num;
    }
  });

  if (maxEk07 > 0) {
    await db.collection('counter').findOneAndUpdate(
      { $or: [{ _id: 'inquiryNumber_prog-2026-09-11' }, { name: 'inquiryNumber_prog-2026-09-11' }, { _id: 'inquiryNumber_prog-2026-09-12' }, { name: 'inquiryNumber_prog-2026-09-12' }] },
      { $set: { name: 'inquiryNumber_prog-2026-09-11', seq: maxEk07 } },
      { upsert: true }
    );
    await db.collection('counter').deleteMany({
      $or: [{ _id: 'inquiryNumber_prog-2026-09-12' }, { name: 'inquiryNumber_prog-2026-09-12' }]
    });
    console.log(`✓ Counter synchronized: inquiryNumber_prog-2026-09-11 at seq ${maxEk07}`);
  }

  // Update existing messages / passes for EK07 to 11 September
  await db.collection('whatsapp_messages').updateMany(
    {
      $or: [
        { inquiryId: /^EK07-/ },
        { eventId: { $in: ['prog-2026-09-11', 'prog-2026-09-12'] } }
      ]
    },
    {
      $set: {
        eventId: 'prog-2026-09-11',
        'templateParameters.eventDate': '11 September 2026',
        'templateParameters.eventName': PROGRAM_NAME,
        'templateParameters.venue': VENUE_NAME,
        'templateParameters.eventTime': '8:30 PM'
      }
    }
  );

  await db.collection('passes').updateMany(
    {
      $or: [
        { inquiryId: /^EK07-/ },
        { eventId: { $in: ['prog-2026-09-11', 'prog-2026-09-12'] } }
      ]
    },
    {
      $set: {
        eventId: 'prog-2026-09-11',
        eventDate: '2026-09-11',
        eventName: PROGRAM_NAME,
        venue: VENUE_NAME
      }
    }
  );

  // -------------------------------------------------------------------------
  // STEP 3 — CANCEL FUTURE PERSONALIZED INVITATION JOBS (DISABLED_FOR_EVENT)
  // -------------------------------------------------------------------------
  console.log('\n================ STEP 3: CANCEL 48H INVITATIONS ================');
  const cancelInvRes = await db.collection('whatsapp_messages').updateMany(
    {
      $or: [
        { eventId: { $in: ['prog-2026-09-07', 'prog-2026-09-11', 'prog-2026-09-12'] } },
        { inquiryId: /^EK0[67]-/ }
      ],
      templateName: 'edkl_personal_invitation_48h_v1',
      status: { $in: ['QUEUED', 'SENDING'] }
    },
    {
      $set: {
        status: 'CANCELLED',
        lastErrorMessage: 'DISABLED_FOR_EVENT',
        updatedAt: new Date()
      }
    }
  );
  console.log(`✓ Cancelled pending 48h invitation jobs: ${cancelInvRes.modifiedCount} jobs marked DISABLED_FOR_EVENT`);

  // -------------------------------------------------------------------------
  // STEP 4 — AUDIT RECIPIENTS & QUEUE PAYMENT OPEN MESSAGES
  // -------------------------------------------------------------------------
  console.log('\n================ STEP 4: QUEUE PAYMENT OPEN MESSAGES ================');

  // EK06 Cohort
  const ek06AllRegs = await db.collection('submission').find({
    isDeleted: { $ne: true },
    programId: 'prog-2026-09-07'
  }).toArray();

  let ek06Paid = 0, ek06UnpaidEligible = [];
  ek06AllRegs.forEach(r => {
    const isPaid = r.status === 'approved' || r.payment?.status === 'captured';
    if (isPaid) {
      ek06Paid++;
    } else {
      const phone = normalizePhoneNumber(r.phoneNumber);
      if (phone && phone.length >= 10 && r.whatsappOptIn !== false) {
        ek06UnpaidEligible.push(r);
      }
    }
  });

  console.log(`EK06 Total: ${ek06AllRegs.length} | Already Paid: ${ek06Paid} | Unpaid Eligible for Payment Open: ${ek06UnpaidEligible.length}`);

  // EK07 Cohort
  const ek07AllRegs = await db.collection('submission').find({
    isDeleted: { $ne: true },
    programId: 'prog-2026-09-11'
  }).toArray();

  let ek07Paid = 0, ek07UnpaidEligible = [];
  ek07AllRegs.forEach(r => {
    const isPaid = r.status === 'approved' || r.payment?.status === 'captured';
    if (isPaid) {
      ek07Paid++;
    } else {
      const phone = normalizePhoneNumber(r.phoneNumber);
      if (phone && phone.length >= 10 && r.whatsappOptIn !== false) {
        ek07UnpaidEligible.push(r);
      }
    }
  });

  console.log(`EK07 Total: ${ek07AllRegs.length} | Already Paid: ${ek07Paid} | Unpaid Eligible for Payment Open: ${ek07UnpaidEligible.length}`);

  let ek06QueuedOpen = 0, ek06ScheduledRem24 = 0;
  let ek07QueuedOpen = 0, ek07ScheduledRem24 = 0;

  // Queue for EK06
  const ek06EventDoc = await db.collection('program').findOne({ id: 'prog-2026-09-07' });
  const ek06OpenTimestamp = ek06EventDoc.paymentOpenedAt || activationTimestamp;
  const ek06Rem24Time = new Date(ek06OpenTimestamp.getTime() + 24 * 60 * 60 * 1000);

  for (const reg of ek06UnpaidEligible) {
    const customerName = `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim() || 'Valued Couple';
    const inquiryId = reg.inquiryId;
    const normPhone = normalizePhoneNumber(reg.phoneNumber);
    const maskedPhone = maskPhoneNumber(reg.phoneNumber);

    // 1. Payment Open Job
    const openKey = `PAYMENT_OPEN:prog-2026-09-07:${reg._id}:${ek06OpenTimestamp.getTime()}`;
    const openResult = await db.collection('whatsapp_messages').findOneAndUpdate(
      { idempotencyKey: openKey },
      {
        $setOnInsert: {
          messageId: `WA-OPEN-${crypto.randomBytes(8).toString('hex')}`,
          eventId: 'prog-2026-09-07',
          registrationId: reg._id,
          inquiryId,
          recipientPhone: normPhone,
          recipientMasked: maskedPhone,
          templateName: 'edkl_payment_pending_v1',
          templateLanguage: 'en_US',
          templateCategory: 'UTILITY',
          messageType: 'payment_pending',
          trigger: 'payment_activation_open',
          executionSource: 'NORMAL',
          providerMode: 'META',
          idempotencyKey: openKey,
          status: 'QUEUED',
          scheduledFor: new Date(),
          templateParameters: {
            customerName,
            eventName: PROGRAM_NAME,
            registrationId: inquiryId,
            eventDate: '7 September 2026',
            eventTime: '8:30 PM',
            venue: VENUE_NAME,
            feeAmount: '₹1500',
            inquiryId
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    if (openResult) ek06QueuedOpen++;

    // 2. Follow-up 24h Reminder Job
    const remKey = `PAYMENT_REMINDER_24H:prog-2026-09-07:${reg._id}`;
    const remResult = await db.collection('whatsapp_messages').findOneAndUpdate(
      { idempotencyKey: remKey },
      {
        $setOnInsert: {
          messageId: `WA-REM24-${crypto.randomBytes(8).toString('hex')}`,
          eventId: 'prog-2026-09-07',
          registrationId: reg._id,
          inquiryId,
          recipientPhone: normPhone,
          recipientMasked: maskedPhone,
          templateName: 'edkl_payment_pending_v1',
          templateLanguage: 'en_US',
          templateCategory: 'UTILITY',
          messageType: 'payment_pending',
          trigger: 'payment_reminder_24h',
          executionSource: 'NORMAL',
          providerMode: 'META',
          idempotencyKey: remKey,
          status: 'QUEUED',
          scheduledFor: ek06Rem24Time,
          templateParameters: {
            customerName,
            eventName: PROGRAM_NAME,
            registrationId: inquiryId,
            eventDate: '7 September 2026',
            eventTime: '8:30 PM',
            venue: VENUE_NAME,
            feeAmount: '₹1500',
            inquiryId
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    if (remResult) ek06ScheduledRem24++;
  }

  // Queue for EK07
  const ek07EventDoc = await db.collection('program').findOne({ id: 'prog-2026-09-11' });
  const ek07OpenTimestamp = ek07EventDoc.paymentOpenedAt || activationTimestamp;
  const ek07Rem24Time = new Date(ek07OpenTimestamp.getTime() + 24 * 60 * 60 * 1000);

  for (const reg of ek07UnpaidEligible) {
    const customerName = `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim() || 'Valued Couple';
    const inquiryId = reg.inquiryId;
    const normPhone = normalizePhoneNumber(reg.phoneNumber);
    const maskedPhone = maskPhoneNumber(reg.phoneNumber);

    // 1. Payment Open Job
    const openKey = `PAYMENT_OPEN:prog-2026-09-11:${reg._id}:${ek07OpenTimestamp.getTime()}`;
    const openResult = await db.collection('whatsapp_messages').findOneAndUpdate(
      { idempotencyKey: openKey },
      {
        $setOnInsert: {
          messageId: `WA-OPEN-${crypto.randomBytes(8).toString('hex')}`,
          eventId: 'prog-2026-09-11',
          registrationId: reg._id,
          inquiryId,
          recipientPhone: normPhone,
          recipientMasked: maskedPhone,
          templateName: 'edkl_payment_pending_v1',
          templateLanguage: 'en_US',
          templateCategory: 'UTILITY',
          messageType: 'payment_pending',
          trigger: 'payment_activation_open',
          executionSource: 'NORMAL',
          providerMode: 'META',
          idempotencyKey: openKey,
          status: 'QUEUED',
          scheduledFor: new Date(),
          templateParameters: {
            customerName,
            eventName: PROGRAM_NAME,
            registrationId: inquiryId,
            eventDate: '11 September 2026',
            eventTime: '8:30 PM',
            venue: VENUE_NAME,
            feeAmount: '₹1500',
            inquiryId
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    if (openResult) ek07QueuedOpen++;

    // 2. Follow-up 24h Reminder Job
    const remKey = `PAYMENT_REMINDER_24H:prog-2026-09-11:${reg._id}`;
    const remResult = await db.collection('whatsapp_messages').findOneAndUpdate(
      { idempotencyKey: remKey },
      {
        $setOnInsert: {
          messageId: `WA-REM24-${crypto.randomBytes(8).toString('hex')}`,
          eventId: 'prog-2026-09-11',
          registrationId: reg._id,
          inquiryId,
          recipientPhone: normPhone,
          recipientMasked: maskedPhone,
          templateName: 'edkl_payment_pending_v1',
          templateLanguage: 'en_US',
          templateCategory: 'UTILITY',
          messageType: 'payment_pending',
          trigger: 'payment_reminder_24h',
          executionSource: 'NORMAL',
          providerMode: 'META',
          idempotencyKey: remKey,
          status: 'QUEUED',
          scheduledFor: ek07Rem24Time,
          templateParameters: {
            customerName,
            eventName: PROGRAM_NAME,
            registrationId: inquiryId,
            eventDate: '11 September 2026',
            eventTime: '8:30 PM',
            venue: VENUE_NAME,
            feeAmount: '₹1500',
            inquiryId
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    if (remResult) ek07ScheduledRem24++;
  }

  console.log(`✓ EK06 Payment Open jobs queued: ${ek06QueuedOpen} | 24h Reminders scheduled: ${ek06ScheduledRem24}`);
  console.log(`✓ EK07 Payment Open jobs queued: ${ek07QueuedOpen} | 24h Reminders scheduled: ${ek07ScheduledRem24}`);

  // -------------------------------------------------------------------------
  // FINAL VERIFICATION QUERY
  // -------------------------------------------------------------------------
  console.log('\n================ FINAL VERIFICATION ================');
  const finalEk06 = await db.collection('program').findOne({ id: 'prog-2026-09-07' });
  const finalEk07 = await db.collection('program').findOne({ id: 'prog-2026-09-11' });
  const legacyEk07Check = await db.collection('program').find({
    $or: [{ id: 'prog-2026-09-12' }, { date: '2026-09-12' }]
  }).toArray();

  const totalOpenQueued = await db.collection('whatsapp_messages').countDocuments({
    trigger: 'payment_activation_open',
    status: 'QUEUED'
  });

  const totalPendingInv = await db.collection('whatsapp_messages').countDocuments({
    templateName: 'edkl_personal_invitation_48h_v1',
    status: 'QUEUED'
  });

  console.log('EK06 Payment Enabled:', finalEk06.isPaymentEnabled, '| Early Mode:', finalEk06.earlyRegistrationMode, '| Inv Enabled:', finalEk06.personalizedInvitationEnabled);
  console.log('EK07 Payment Enabled:', finalEk07.isPaymentEnabled, '| Early Mode:', finalEk07.earlyRegistrationMode, '| Inv Enabled:', finalEk07.personalizedInvitationEnabled, '| Date:', finalEk07.date, '| Slug:', finalEk07.slug);
  console.log('Legacy 12 September Events in DB:', legacyEk07Check.length);
  console.log('Total Payment Open WhatsApp jobs queued:', totalOpenQueued);
  console.log('Total Pending 48h Invitation WhatsApp jobs:', totalPendingInv);

  await client.close();
  console.log('\n✓ ACTIVATION SCRIPT COMPLETED SUCCESSFULLY.');
  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ Activation failed:', err);
  process.exit(1);
});
