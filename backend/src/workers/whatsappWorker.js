import { WhatsappMessage } from '../models/WhatsappMessage.js';
import { dispatchTemplateMessage } from '../integrations/whatsapp/whatsapp.service.js';

let isProcessing = false;

/**
 * Process queued WhatsApp messages in batches
 */
export async function runAutomaticWhatsAppWorker({ batchSize = 10 } = {}) {
  if (isProcessing) {
    return { status: 'already_running', processed: 0 };
  }

  isProcessing = true;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    const queuedMessages = await WhatsappMessage.find({
      status: 'QUEUED',
      attemptCount: { $lt: 3 }
    })
      .sort({ createdAt: 1 })
      .limit(batchSize);

    if (queuedMessages.length === 0) {
      isProcessing = false;
      return { status: 'idle', processed: 0, succeeded: 0, failed: 0 };
    }

    for (const msg of queuedMessages) {
      processed++;
      const result = await dispatchTemplateMessage(msg);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
      // Small 150ms delay between dispatches to avoid throttling
      await new Promise(r => setTimeout(r, 150));
    }

    isProcessing = false;
    return { status: 'completed', processed, succeeded, failed };
  } catch (err) {
    console.error('[WhatsApp Worker] Error during queue processing:', err);
    isProcessing = false;
    return { status: 'error', error: err.message, processed, succeeded, failed };
  }
}
