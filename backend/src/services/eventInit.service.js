import { Event } from '../models/Event.js';
import { Counter } from '../models/Counter.js';
import { Registration } from '../models/Registration.js';
import { WhatsappMessage } from '../models/WhatsappMessage.js';

/**
 * Startup Event Config Initializer
 * Automatically ensures 7 September 2026 (EK06) and 11 September 2026 (EK07) events exist
 * with normal registration & payment enabled (EK06 & EK07 active upcoming paid events).
 */
export async function ensureEarlyRegistrationEvents() {
  try {
    // 0. Auto-Heal Counter Collection: Drop legacy name_1 unique index if present
    try {
      const indexes = await Counter.collection.indexes();
      const legacyIdx = indexes.find(i => i.name === 'name_1');
      if (legacyIdx) {
        await Counter.collection.dropIndex('name_1');
        console.log('[EventInit] Successfully dropped legacy counter unique index: name_1');
      }
    } catch (_) {}

    const PROGRAM_NAME = 'Ek Duje Ke Liye - Sardar Patel Smruti Bhavan';
    const VENUE_NAME = 'Sardar Patel Smruti Bhavan, Varachha, Surat';
    const MAP_URL = 'https://share.google/y1jtFAZXuKusYTiUD';

    // 1. Ensure 7 September 2026 Program (Sequence 6 -> EK06-XX)
    const existingEvent7 = await Event.findOne({
      $or: [{ sequenceNumber: 6 }, { id: 'prog-2026-09-07' }, { date: '2026-09-07' }]
    });

    const isEarlyMode6 = existingEvent7 ? Boolean(existingEvent7.earlyRegistrationMode) : false;
    const isPaymentEnabled6 = existingEvent7 ? Boolean(existingEvent7.isPaymentEnabled) : true;

    await Event.findOneAndUpdate(
      { $or: [{ sequenceNumber: 6 }, { id: 'prog-2026-09-07' }, { date: '2026-09-07' }] },
      {
        $set: {
          id: 'prog-2026-09-07',
          sequenceNumber: 6,
          name: PROGRAM_NAME,
          slug: 'surat-7-september-2026',
          city: 'Surat',
          venue: VENUE_NAME,
          mapUrl: MAP_URL,
          price: 1500,
          status: 'upcoming',
          isInquiryClosed: false,
          isRegistrationOpen: true,
          isPaymentEnabled: isPaymentEnabled6,
          earlyRegistrationMode: isEarlyMode6,
          personalizedInvitationEnabled: false,
          communicationsEnabled: true,
          isDateFinal: true,
          capacity: existingEvent7?.capacity || 500,
          time: '8:30 PM',
          date: '2026-09-07'
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    // 2. Ensure 11 September 2026 Program (Sequence 7 -> EK07-XX)
    const existingEvent11 = await Event.findOne({
      $or: [{ sequenceNumber: 7 }, { id: 'prog-2026-09-11' }, { id: 'prog-2026-09-12' }, { date: '2026-09-11' }, { date: '2026-09-12' }]
    });

    const isEarlyMode7 = existingEvent11 ? Boolean(existingEvent11.earlyRegistrationMode) : false;
    const isPaymentEnabled7 = existingEvent11 ? Boolean(existingEvent11.isPaymentEnabled) : true;

    await Event.findOneAndUpdate(
      { $or: [{ sequenceNumber: 7 }, { id: 'prog-2026-09-11' }, { id: 'prog-2026-09-12' }, { date: '2026-09-11' }, { date: '2026-09-12' }] },
      {
        $set: {
          id: 'prog-2026-09-11',
          sequenceNumber: 7,
          name: PROGRAM_NAME,
          slug: 'surat-11-september-2026',
          city: 'Surat',
          venue: VENUE_NAME,
          mapUrl: MAP_URL,
          price: 1500,
          status: 'upcoming',
          isInquiryClosed: false,
          isRegistrationOpen: true,
          isPaymentEnabled: isPaymentEnabled7,
          earlyRegistrationMode: isEarlyMode7,
          personalizedInvitationEnabled: false,
          communicationsEnabled: true,
          isDateFinal: true,
          capacity: existingEvent11?.capacity || 500,
          time: '8:30 PM',
          date: '2026-09-11'
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Clean up any stale legacy prog-2026-09-12 record if it exists as duplicate
    try {
      await Event.deleteMany({ id: 'prog-2026-09-12', sequenceNumber: { $ne: 7 } });
    } catch (_) {}

    // 3. Link and standardize all 7 September registrations to EK06
    try {
      const ek01Regs = await Registration.find({
        $or: [
          { inquiryId: { $regex: '^EK01-' } },
          { phoneNumber: { $in: ['9974446563', '9909150367'] } }
        ]
      });

      for (const reg of ek01Regs) {
        let targetInquiryId = reg.inquiryId;
        if (targetInquiryId.startsWith('EK01-')) {
          targetInquiryId = targetInquiryId.replace('EK01-', 'EK06-');
        } else if (reg.phoneNumber === '9974446563') {
          targetInquiryId = 'EK06-05';
        } else if (reg.phoneNumber === '9909150367') {
          targetInquiryId = 'EK06-06';
        }

        await Registration.updateOne(
          { _id: reg._id },
          {
            $set: {
              inquiryId: targetInquiryId,
              programId: 'prog-2026-09-07',
              programDate: '2026-09-07',
              programName: PROGRAM_NAME,
              isDeleted: false
            }
          }
        );
        console.log(`[EventInit] Linked and renamed registration ${reg.inquiryId} -> ${targetInquiryId}`);
      }

      // Ensure all EK06 registrations are mapped to 7 September 2026
      await Registration.updateMany(
        { inquiryId: { $regex: '^EK06-' } },
        {
          $set: {
            programId: 'prog-2026-09-07',
            programDate: '2026-09-07',
            programName: PROGRAM_NAME,
            isDeleted: false
          }
        }
      );

      // Ensure all EK07 registrations are mapped to 11 September 2026
      await Registration.updateMany(
        {
          $or: [
            { inquiryId: { $regex: '^EK07-' } },
            { programId: 'prog-2026-09-12' },
            { programId: 'prog-1787844313509-02' },
            { programDate: '2026-09-12' }
          ]
        },
        {
          $set: {
            programId: 'prog-2026-09-11',
            programDate: '2026-09-11',
            programName: PROGRAM_NAME,
            isDeleted: false
          }
        }
      );

      // Ensure TBD Event (Date To Be Announced) is active as date_tba and map legacy TBD submissions
      await Event.findOneAndUpdate(
        {
          $or: [
            { id: 'prog-1785924307713' },
            { slug: 'ek-duje-ke-liye-date-tba' },
            { date: 'TBD' }
          ]
        },
        {
          $set: {
            id: 'prog-1785924307713',
            name: 'Ek Duje Ke Liye (Date To Be Announced)',
            slug: 'ek-duje-ke-liye-date-tba',
            date: 'TBD',
            isDateFinal: false,
            status: 'date_tba',
            isInquiryClosed: false,
            isRegistrationOpen: true,
            isPaymentEnabled: false,
            earlyRegistrationMode: true,
            price: 1500
          },
          $setOnInsert: {
            sequenceNumber: 3,
            capacity: 1000
          }
        },
        { upsert: true }
      );

      // Map any orphaned TBD submissions to prog-1785924307713
      await Registration.updateMany(
        {
          $or: [
            { programId: 'prog-1785919856181' },
            { programId: 'TBD' },
            { programId: 'tbd' },
            { programDate: 'TBD' },
            { programDate: 'TBA' },
            { programDate: 'tbd' },
            { programDate: 'tba' }
          ]
        },
        {
          $set: {
            programId: 'prog-1785924307713',
            programDate: 'TBD',
            programName: 'Ek Duje Ke Liye (Date To Be Announced)'
          }
        }
      );
    } catch (migErr) {
      console.warn('[EventInit] Migration notice:', migErr.message);
    }

    // 4. Synchronize counters to avoid any collision
    try {
      const ek06Regs = await Registration.find({ inquiryId: { $regex: '^EK06-' } }).lean();
      let maxEk06 = 0;
      for (const r of ek06Regs) {
        const match = r.inquiryId.match(/^EK06-(\d+)/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (n > maxEk06) maxEk06 = n;
        }
      }
      if (maxEk06 > 0) {
        await Counter.findOneAndUpdate(
          { $or: [{ _id: 'inquiryNumber_prog-2026-09-07' }, { name: 'inquiryNumber_prog-2026-09-07' }] },
          { $max: { seq: maxEk06 }, $set: { name: 'inquiryNumber_prog-2026-09-07' } },
          { upsert: true }
        );
      }

      const ek07Regs = await Registration.find({ inquiryId: { $regex: '^EK07-' } }).lean();
      let maxEk07 = 0;
      for (const r of ek07Regs) {
        const match = r.inquiryId.match(/^EK07-(\d+)/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (n > maxEk07) maxEk07 = n;
        }
      }
      if (maxEk07 > 0) {
        await Counter.findOneAndUpdate(
          { $or: [{ _id: 'inquiryNumber_prog-2026-09-11' }, { name: 'inquiryNumber_prog-2026-09-11' }] },
          { $max: { seq: maxEk07 }, $set: { name: 'inquiryNumber_prog-2026-09-11' } },
          { upsert: true }
        );
        // Clean up legacy counter
        await Counter.deleteMany({
          $or: [{ _id: 'inquiryNumber_prog-2026-09-12' }, { name: 'inquiryNumber_prog-2026-09-12' }]
        });
      }
    } catch (cntErr) {
      console.warn('[EventInit] Counter sync notice:', cntErr.message);
    }

    // 5. Ensure critical database indexes for high-speed sub-millisecond queries
    try {
      await Registration.createIndexes();
      await Event.createIndexes();
      await WhatsappMessage.createIndexes();
    } catch (_) {}

    // 6. Self-heal WhatsApp messageType categorizations
    try {
      await WhatsappMessage.updateMany(
        {
          $or: [
            { templateName: { $regex: 'payment_pending|polite_payment', $options: 'i' } },
            { trigger: 'payment_pending' },
            { trigger: 'registration_created' }
          ]
        },
        { $set: { messageType: 'payment_pending' } }
      );
      await WhatsappMessage.updateMany(
        {
          $or: [
            { templateName: { $regex: 'registration_received', $options: 'i' } },
            { trigger: 'registration_received' }
          ]
        },
        { $set: { messageType: 'registration_received' } }
      );
      await WhatsappMessage.updateMany(
        {
          $and: [
            {
              $or: [
                { templateName: { $regex: 'payment_confirmed|pass_ready', $options: 'i' } },
                { trigger: 'payment_verified' },
                { trigger: 'manual_approval' }
              ]
            },
            { templateName: { $not: { $regex: 'payment_pending|polite_payment', $options: 'i' } } }
          ]
        },
        { $set: { messageType: 'payment_confirmation' } }
      );
    } catch (healErr) {
      console.warn('[EventInit] WhatsApp message self-heal notice:', healErr.message);
    }

    console.log('[EventInit] Ensured 7 Sep (EK06) & 11 Sep (EK07) event configurations and DB indexes.');
  } catch (err) {
    console.error('[EventInit] Failed to ensure event initialization:', err.message);
  }
}
