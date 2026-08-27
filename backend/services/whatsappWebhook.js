/**
 * WhatsApp Cloud API Webhook Service
 * 
 * Handles Meta Webhook verification (GET) and incoming event notifications (POST).
 */

/**
 * Verification handler for Meta Webhook (GET /api/webhooks/whatsapp)
 * 
 * Query Parameters sent by Meta:
 * - hub.mode: Must equal 'subscribe'
 * - hub.verify_token: Must match process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
 * - hub.challenge: Random challenge string to be echoed back on successful verification
 */
export const verifyWebhook = (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

    if (!verifyToken) {
      console.warn('[WhatsApp Webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN is not configured in environment variables.');
      return res.status(403).send('Forbidden: Webhook verify token not configured on server.');
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

/**
 * Event receiver for Meta Webhook (POST /api/webhooks/whatsapp)
 * 
 * Handles incoming notification payloads from Meta (inbound messages, status updates).
 * Meta requires a prompt HTTP 200 response to acknowledge receipt.
 */
export const handleWebhookEvent = (req, res) => {
  try {
    const body = req.body;

    // Check if the payload is from WhatsApp Business Account
    if (!body || body.object !== 'whatsapp_business_account') {
      return res.status(200).json({ status: 'ignored', message: 'Not a WhatsApp Business Account event.' });
    }

    // Immediately acknowledge receipt to Meta to prevent retry loops
    res.status(200).json({ status: 'received' });

    // Process entries asynchronously without blocking the HTTP response
    if (Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        const changes = entry.changes;
        if (!Array.isArray(changes)) continue;

        for (const change of changes) {
          const value = change.value;
          if (!value) continue;

          const metadata = value.metadata || {};

          // 1. Handle incoming user messages
          if (Array.isArray(value.messages)) {
            for (const message of value.messages) {
              handleIncomingMessage(message, metadata);
            }
          }

          // 2. Handle message status updates (sent, delivered, read, failed)
          if (Array.isArray(value.statuses)) {
            for (const status of value.statuses) {
              handleStatusUpdate(status, metadata);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[WhatsApp Webhook] Error processing event:', err);
    // Ensure response is returned if not already sent
    if (!res.headersSent) {
      res.status(200).json({ status: 'error_handled' });
    }
  }
};

/**
 * Handler for Inbound Messages
 * (Structure prepared for future phase implementation)
 */
function handleIncomingMessage(message, metadata) {
  const messageType = message.type || 'unknown';
  const messageId = message.id || 'unknown';
  
  // Safe development logging without dumping customer PII or message contents
  console.log(`[WhatsApp Webhook] Inbound message received | Type: ${messageType} | ID: ${messageId}`);
}

/**
 * Handler for Message Status Updates
 * (Structure prepared for future phase implementation to track sent, delivered, read, failed)
 */
function handleStatusUpdate(status, metadata) {
  const statusType = status.status || 'unknown'; // 'sent', 'delivered', 'read', 'failed'
  const messageId = status.id || 'unknown';
  
  if (statusType === 'failed') {
    const errorSummary = Array.isArray(status.errors) && status.errors.length > 0
      ? status.errors.map(e => `Code ${e.code}: ${e.title}`).join(', ')
      : 'No error details provided';
    console.warn(`[WhatsApp Webhook] Status update | ID: ${messageId} | Status: failed | Error: ${errorSummary}`);
  } else {
    console.log(`[WhatsApp Webhook] Status update | ID: ${messageId} | Status: ${statusType}`);
  }
}
