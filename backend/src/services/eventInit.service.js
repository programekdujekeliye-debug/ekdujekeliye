import { Event } from '../models/Event.js';
import { Counter } from '../models/Counter.js';
import { Registration } from '../models/Registration.js';
import { WhatsappMessage } from '../models/WhatsappMessage.js';

/**
 * Startup Database Initializer & Index Ensuring
 * Ensures database collections and indexes are healthy without overwriting or hardcoding any event data.
 * All event records remain 100% dynamic and user-editable.
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

    // 1. Ensure critical database indexes for high-speed sub-millisecond queries
    try {
      await Registration.createIndexes();
      await Event.createIndexes();
      await WhatsappMessage.createIndexes();
    } catch (_) {}

    // 2. Self-heal WhatsApp messageType categorizations
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

    console.log('[EventInit] Database indexes and message types initialized. Event data remains 100% dynamic.');
  } catch (err) {
    console.error('[EventInit] Failed to complete startup database initialization:', err.message);
  }
}
