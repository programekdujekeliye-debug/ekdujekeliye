import { Event } from '../models/Event.js';

/**
 * Startup Event Config Initializer
 * Automatically ensures 7 September 2026 and 11 September 2026 events exist
 * with Early Registration Mode active (isPaymentEnabled: false, earlyRegistrationMode: true).
 */
export async function ensureEarlyRegistrationEvents() {
  try {
    const PROGRAM_NAME = 'Ek Duje Ke Liye - Sardar Patel Smruti Bhavan';
    const VENUE_NAME = 'Sardar Patel Smruti Bhavan, Varachha, Surat';
    const MAP_URL = 'https://share.google/y1jtFAZXuKusYTiUD';

    // 1. Ensure 7 September 2026 Program
    await Event.findOneAndUpdate(
      { date: '2026-09-07' },
      {
        $set: {
          id: 'prog-2026-09-07',
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

    // 2. Ensure 11 September 2026 Program
    await Event.findOneAndUpdate(
      { date: '2026-09-11' },
      {
        $set: {
          id: 'prog-2026-09-11',
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

    console.log('[EventInit] Ensured 7 & 11 September 2026 Early Registration Mode in DB.');
  } catch (err) {
    console.error('[EventInit] Failed to ensure early registration events:', err.message);
  }
}
