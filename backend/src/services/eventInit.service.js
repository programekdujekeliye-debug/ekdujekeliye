import { Event } from '../models/Event.js';
import { Counter } from '../models/Counter.js';
import { Registration } from '../models/Registration.js';

/**
 * Startup Event Config Initializer
 * Automatically ensures 7 September 2026 (EK06) and 11 September 2026 (EK07) events exist
 * with Early Registration Mode active (isPaymentEnabled: false, earlyRegistrationMode: true).
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
    await Event.findOneAndUpdate(
      { date: '2026-09-07' },
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
          isPaymentEnabled: false,
          earlyRegistrationMode: true,
          paymentOpenedAt: null,
          paymentOpeningNote: 'Online payment will open shortly. Payment link will be sent on your registered WhatsApp number.',
          isDateFinal: true,
          capacity: 1184,
          time: '8:30 PM'
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    // 2. Ensure 11 September 2026 Program (Sequence 7 -> EK07-XX)
    await Event.findOneAndUpdate(
      { date: '2026-09-11' },
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
          isPaymentEnabled: false,
          earlyRegistrationMode: true,
          paymentOpenedAt: null,
          paymentOpeningNote: 'Online payment will open shortly. Payment link will be sent on your registered WhatsApp number.',
          isDateFinal: true,
          capacity: 1184,
          time: '8:30 PM'
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    // 3. Migrate any inadvertent EK01-XX for 7 September 2026 to EK06-XX
    try {
      const ek01Regs = await Registration.find({
        programDate: '2026-09-07',
        inquiryId: { $regex: '^EK01-' }
      });

      for (const reg of ek01Regs) {
        const targetInquiryId = reg.inquiryId.replace('EK01-', 'EK06-');
        const conflict = await Registration.findOne({ inquiryId: targetInquiryId });
        if (!conflict) {
          await Registration.updateOne({ _id: reg._id }, { $set: { inquiryId: targetInquiryId } });
          console.log(`[EventInit] Auto-migrated ${reg.inquiryId} -> ${targetInquiryId}`);
        }
      }
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
      }
    } catch (cntErr) {
      console.warn('[EventInit] Counter sync notice:', cntErr.message);
    }

    console.log('[EventInit] Ensured 7 Sep (EK06) & 11 Sep (EK07) Early Registration Mode in DB.');
  } catch (err) {
    console.error('[EventInit] Failed to ensure early registration events:', err.message);
  }
}
