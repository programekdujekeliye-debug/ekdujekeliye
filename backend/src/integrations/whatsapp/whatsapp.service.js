import { env } from '../../config/env.js';

export const verifyWebhook = (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

    if (!verifyToken) {
      console.warn('[WhatsApp Webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN is not configured.');
      return res.status(403).send('Forbidden: Webhook verify token not configured.');
    }

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[WhatsApp Webhook] Meta subscription verified successfully.');
      return res.status(200).send(challenge);
    }

    console.warn('[WhatsApp Webhook] Verification failed: Invalid mode or token mismatch.');
    return res.status(403).send('Forbidden: Verification token mismatch.');
  } catch (err) {
    console.error('[WhatsApp Webhook] Error during verification:', err);
    return res.status(500).send('Internal Server Error');
  }
};

export const handleWebhookEvent = (req, res) => {
  try {
    const body = req.body;

    if (!body || body.object !== 'whatsapp_business_account') {
      return res.status(200).json({ status: 'ignored', message: 'Not a WhatsApp Business Account event.' });
    }

    // Acknowledge immediately to Meta
    res.status(200).json({ status: 'received' });

    // Asynchronously inspect notifications
    if (Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        const changes = entry.changes;
        if (!Array.isArray(changes)) continue;

        for (const change of changes) {
          const value = change.value;
          if (!value) continue;

          // Process status updates & messages
          if (Array.isArray(value.statuses)) {
            for (const status of value.statuses) {
              console.log(`[WhatsApp Webhook] Status update: ID ${status.id} -> ${status.status}`);
            }
          }
          if (Array.isArray(value.messages)) {
            for (const msg of value.messages) {
              console.log(`[WhatsApp Webhook] Inbound message received: Type ${msg.type} from ${msg.from}`);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[WhatsApp Webhook] Error processing event:', err);
    if (!res.headersSent) {
      res.status(200).json({ status: 'error_handled' });
    }
  }
};
