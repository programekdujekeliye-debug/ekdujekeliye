import crypto from 'crypto';
import { env, getMetaGraphApiUrl, normalizePhoneNumber, maskSecret } from '../../config/env.js';
import { TEMPLATE_REGISTRY, validateTemplateVariables } from './templateRegistry.js';
import { WhatsappMessage } from '../../models/WhatsappMessage.js';
import { Registration } from '../../models/Registration.js';
import { whatsappTemplateService } from './whatsappTemplate.service.js';

// In-Memory cache of Meta template statuses (refreshed every 5 minutes)
let metaTemplateStatusCache = new Map();
let lastTemplateCacheFetch = 0;

/**
 * Refresh and retrieve cached template statuses from Meta WABA
 */
export async function getCachedMetaTemplateStatus(metaName, language = 'en_US') {
  const now = Date.now();
  if (now - lastTemplateCacheFetch > 5 * 60 * 1000 || metaTemplateStatusCache.size === 0) {
    try {
      const res = await whatsappTemplateService.fetchMetaTemplates();
      if (res.success && res.templates) {
        metaTemplateStatusCache.clear();
        res.templates.forEach(t => {
          metaTemplateStatusCache.set(`${t.name}_${t.language}`, t.status);
        });
        lastTemplateCacheFetch = now;
      }
    } catch (_) {}
  }

  return metaTemplateStatusCache.get(`${metaName}_${language}`) || null;
}

/**
 * Hash a phone number for privacy-compliant index lookups
 */
export function hashPhoneNumber(phone) {
  if (!phone) return '';
  return crypto.createHash('sha256').update(phone).digest('hex').substring(0, 16);
}

/**
 * Mask phone number for safe logging (e.g. 918320****29)
 */
export function maskPhoneNumber(phone) {
  if (!phone) return '';
  const str = String(phone);
  if (str.length <= 6) return '******';
  return str.substring(0, 6) + '****' + str.substring(str.length - 2);
}

/**
 * Normalizes a recipient phone number (canonical export)
 */
export const normalizeWhatsAppRecipient = normalizePhoneNumber;

/**
 * Safely get WhatsApp configuration status without exposing raw secrets
 */
export function getWhatsAppConfigStatus() {
  return {
    wabaIdConfigured: Boolean(env.WHATSAPP_WABA_ID),
    phoneIdConfigured: Boolean(env.WHATSAPP_PHONE_NUMBER_ID),
    tokenConfigured: Boolean(env.WHATSAPP_ACCESS_TOKEN),
    webhookConfigured: Boolean(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
    isReady: Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID),
    sendEnabled: env.WHATSAPP_SEND_ENABLED,
    mode: env.WHATSAPP_MODE,
    apiVersion: env.META_GRAPH_API_VERSION
  };
}

/**
 * Master WhatsApp Message Dispatcher
 * Strictly validates all Master Send Guards
 */
export async function sendWhatsAppMessage({
  recipientPhone,
  templateKey,
  languageCode,
  variables = {},
  idempotencyKey,
  registrationId = null,
  paymentId = null,
  passId = null,
  eventId = null,
  inquiryId = null,
  customerId = null,
  trigger = 'manual',
  category = 'UTILITY',
  executionSource = 'NORMAL',
  providerMode = 'META'
}) {
  // 1. Send Enabled Guard
  if (!env.WHATSAPP_SEND_ENABLED) {
    return {
      success: false,
      status: 'BLOCKED_DISABLED',
      error: 'WHATSAPP_SEND_ENABLED is false in configuration.'
    };
  }

  // 2. Normalize Recipient Number
  const normalizedPhone = normalizePhoneNumber(recipientPhone);
  if (!normalizedPhone || normalizedPhone.length < 10) {
    return {
      success: false,
      status: 'INVALID_RECIPIENT',
      error: `Invalid phone number format: '${recipientPhone}'`
    };
  }

  const maskedPhone = maskPhoneNumber(normalizedPhone);
  const phoneHash = hashPhoneNumber(normalizedPhone);

  // 3. Test Mode Allowlist Guard
  if (env.WHATSAPP_MODE === 'test' || env.APP_ENV !== 'production') {
    const isAllowed = env.WHATSAPP_TEST_RECIPIENTS.includes(normalizedPhone);
    if (!isAllowed) {
      console.warn(`[WhatsApp Master Guard] Blocked test dispatch to non-allowlisted number: ${maskedPhone}`);
      try {
        await WhatsappMessage.findOneAndUpdate(
          { idempotencyKey: idempotencyKey || `BLOCKED:${Date.now()}:${phoneHash}` },
          {
            messageId: `WA-BLK-${crypto.randomBytes(8).toString('hex')}`,
            eventId,
            registrationId,
            paymentId,
            passId,
            inquiryId,
            customerId,
            recipientPhone: normalizedPhone,
            recipientMasked: maskedPhone,
            recipientHash: phoneHash,
            templateName: templateKey,
            templateLanguage: languageCode || 'en_US',
            templateCategory: category,
            trigger,
            executionSource: executionSource || 'NORMAL',
            providerMode: providerMode || 'META',
            status: 'BLOCKED_TEST_MODE',
            lastErrorCode: 'TEST_RECIPIENT_NOT_ALLOWED',
            lastErrorMessage: `Recipient '${maskedPhone}' is not in WHATSAPP_TEST_RECIPIENTS allowlist.`
          },
          { upsert: true }
        );
      } catch (_) {}

      return {
        success: false,
        status: 'BLOCKED_TEST_MODE',
        error: 'TEST_RECIPIENT_NOT_ALLOWED',
        message: `Recipient '${maskedPhone}' is not in WHATSAPP_TEST_RECIPIENTS allowlist.`
      };
    }
  }

  // 4. Opt-Out & Opt-In Verification from Database
  if (registrationId || inquiryId || normalizedPhone) {
    try {
      const reg = await Registration.findOne({
        $or: [
          ...(registrationId ? [{ _id: registrationId }] : []),
          ...(inquiryId ? [{ inquiryId }] : []),
          { phoneNumber: normalizedPhone }
        ]
      }).lean();

      if (reg) {
        if (reg.whatsappOptOutAt) {
          console.warn(`[WhatsApp Master Guard] Blocked dispatch to opted-out recipient: ${maskedPhone}`);
          return {
            success: false,
            status: 'BLOCKED_OPT_OUT',
            error: 'RECIPIENT_OPTED_OUT',
            message: 'Recipient has explicitly opted out of WhatsApp messages.'
          };
        }

        if (category === 'MARKETING' && !reg.whatsappMarketingOptIn) {
          console.warn(`[WhatsApp Master Guard] Blocked marketing dispatch: No explicit marketing consent.`);
          return {
            success: false,
            status: 'BLOCKED_NO_CONSENT',
            error: 'NO_MARKETING_CONSENT',
            message: 'Recipient has not granted explicit marketing consent.'
          };
        }

        if (category === 'UTILITY' && reg.whatsappOptIn === false) {
          return {
            success: false,
            status: 'BLOCKED_NO_CONSENT',
            error: 'NO_UTILITY_CONSENT',
            message: 'Recipient opted out of WhatsApp service notifications.'
          };
        }
      }
    } catch (e) {
      console.warn('[WhatsApp Master Guard] Warning checking opt-in status:', e.message);
    }
  }

  // 5. Template Registry Existence & Schema Check
  const templateDef = TEMPLATE_REGISTRY[templateKey];
  if (!templateDef) {
    return {
      success: false,
      status: 'INVALID_TEMPLATE',
      error: `Template '${templateKey}' is not registered in TEMPLATE_REGISTRY.`
    };
  }

  const resolvedLang = languageCode || templateDef.language || 'en_US';

  // 6. Template Variable Validation
  const varValidation = validateTemplateVariables(templateKey, variables);
  if (!varValidation.valid) {
    return {
      success: false,
      status: 'INVALID_VARIABLES',
      error: varValidation.error
    };
  }

  // 7. Idempotency Check
  const finalIdempotencyKey = idempotencyKey || `${templateKey}:${inquiryId || normalizedPhone}:${Date.now()}`;
  let existingMsg = await WhatsappMessage.findOne({ idempotencyKey: finalIdempotencyKey });

  if (existingMsg && (existingMsg.status === 'SENT' || existingMsg.status === 'DELIVERED' || existingMsg.status === 'READ')) {
    return {
      success: true,
      status: 'ALREADY_SENT',
      providerMessageId: existingMsg.providerMessageId,
      messageRecord: existingMsg
    };
  }

  // 8. Create or Update Ledger Record
  const internalMessageId = existingMsg?.messageId || `WA-MSG-${crypto.randomBytes(8).toString('hex')}`;
  const messageRecord = await WhatsappMessage.findOneAndUpdate(
    { idempotencyKey: finalIdempotencyKey },
    {
      messageId: internalMessageId,
      eventId,
      registrationId,
      paymentId,
      passId,
      inquiryId,
      customerId,
      recipientPhone: normalizedPhone,
      recipientMasked: maskedPhone,
      recipientHash: phoneHash,
      templateName: templateDef.metaName,
      languageCode: resolvedLang,
      templateLanguage: resolvedLang,
      templateCategory: templateDef.category,
      trigger,
      executionSource: executionSource || 'NORMAL',
      providerMode: providerMode || 'META',
      idempotencyKey: finalIdempotencyKey,
      templateParameters: variables,
      status: 'SENDING',
      attemptCount: (existingMsg?.attemptCount || 0) + 1,
      lastAttemptAt: new Date()
    },
    { upsert: true, returnDocument: 'after' }
  );

  // 9. Check Credentials
  if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN) {
    const errorMsg = 'Meta WhatsApp Cloud API credentials missing.';
    messageRecord.status = 'FAILED';
    messageRecord.lastErrorMessage = errorMsg;
    messageRecord.failedAt = new Date();
    await messageRecord.save();
    return { success: false, status: 'FAILED', error: errorMsg };
  }

  // 10. Construct Meta Template Payload
  const bodyComponent = templateDef.components.find(c => c.type === 'BODY');
  const buttonComponent = templateDef.components.find(c => c.type === 'BUTTONS');

  const bodyParameters = [];
  const bodyVars = templateDef.bodyVariables || templateDef.requiredVariables || [];
  if (bodyComponent && bodyVars.length > 0) {
    bodyVars.forEach(varKey => {
      bodyParameters.push({
        type: 'text',
        text: String(variables[varKey] || '')
      });
    });
  }

  const componentsPayload = [];
  if (bodyParameters.length > 0) {
    componentsPayload.push({
      type: 'body',
      parameters: bodyParameters
    });
  }

  if (buttonComponent && (variables.inquiryId || variables.registrationId)) {
    const buttonValue = String(variables.inquiryId || variables.registrationId || '');
    componentsPayload.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [
        {
          type: 'text',
          text: buttonValue
        }
      ]
    });
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedPhone,
    type: 'template',
    template: {
      name: templateDef.metaName,
      language: {
        code: resolvedLang
      },
      ...(componentsPayload.length > 0 ? { components: componentsPayload } : {})
    }
  };

  const metaUrl = getMetaGraphApiUrl(`${env.WHATSAPP_PHONE_NUMBER_ID}/messages`);

  // 11. Send HTTPS Request to Meta Graph API
  try {
    const response = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const errCode = String(data.error?.code || response.status);
      const errTitle = data.error?.message || `HTTP ${response.status}`;

      console.warn(`[WhatsApp API Error] Meta dispatch rejected for ${templateDef.metaName}: Code ${errCode} - ${errTitle}`);

      messageRecord.lastErrorCode = errCode;
      messageRecord.lastErrorMessage = errTitle;
      messageRecord.rawProviderResponse = data;

      if (messageRecord.attemptCount >= (messageRecord.maxAttempts || 3)) {
        messageRecord.status = 'FAILED';
        messageRecord.failedAt = new Date();
      } else {
        messageRecord.status = 'QUEUED';
      }
      await messageRecord.save();

      return {
        success: false,
        status: messageRecord.status,
        error: errTitle,
        code: errCode,
        data
      };
    }

    // 12. Success: Set Status to SENT (Accepted by Meta)
    const providerMessageId = data.messages?.[0]?.id || '';
    messageRecord.status = 'SENT';
    messageRecord.providerMessageId = providerMessageId;
    messageRecord.providerMode = (providerMessageId && providerMessageId.startsWith('wamid.MOCK_TEST_')) ? 'MOCK' : 'META';
    messageRecord.providerAcceptedAt = new Date();
    messageRecord.sentAt = new Date();
    messageRecord.rawProviderResponse = data;
    await messageRecord.save();

    console.log(`[WhatsApp Success] Meta accepted message '${templateDef.metaName}' for ${maskedPhone} -> ${providerMessageId}`);

    return {
      success: true,
      status: 'SENT',
      providerMessageId,
      messageRecord
    };
  } catch (netErr) {
    console.error(`[WhatsApp Network Error] Exception dispatching to ${maskedPhone}:`, netErr.message);
    messageRecord.lastErrorMessage = netErr.message;
    if (messageRecord.attemptCount >= (messageRecord.maxAttempts || 3)) {
      messageRecord.status = 'FAILED';
      messageRecord.failedAt = new Date();
    } else {
      messageRecord.status = 'QUEUED';
    }
    await messageRecord.save();
    return { success: false, status: messageRecord.status, error: netErr.message };
  }
}

/**
 * Send Transactional Utility Template
 */
export async function sendUtilityTemplate(params) {
  return sendWhatsAppMessage({ ...params, category: 'UTILITY' });
}

/**
 * Send Promotional Marketing Template
 */
export async function sendMarketingTemplate(params) {
  return sendWhatsAppMessage({ ...params, category: 'MARKETING' });
}

export const dispatchTemplateMessage = sendWhatsAppMessage;

/**
 * Helper to queue registration pass confirmation message
 */
export async function queuePassConfirmationMessage({ registration, pass, event }) {
  if (!registration || !registration.phoneNumber) return null;

  const inquiryId = registration.inquiryId;
  const idempotencyKey = `pass_ready:${inquiryId}:${pass?.version || 1}`;

  const eventName = event?.name || registration.programName || 'Ek Duje Ke Liye Seminar';
  const eventDate = event?.date || registration.programDate || '';
  const customerName = `${registration.husbandName || ''} & ${registration.wifeName || ''}`.trim() || 'Guest';

  return sendUtilityTemplate({
    recipientPhone: registration.phoneNumber,
    templateKey: 'edkl_payment_confirmed_pass_v1',
    languageCode: 'en_US',
    variables: {
      customerName,
      eventName,
      eventDate,
      eventTime: event?.time || '8:30 PM',
      venue: event?.venue || 'Sardar Smruti Bhavan, Surat',
      registrationId: inquiryId,
      inquiryId
    },
    idempotencyKey,
    registrationId: registration._id,
    eventId: registration.programId,
    inquiryId,
    trigger: 'payment_verified'
  });
}

/**
 * Webhook Inbound Event Handler with STOP / Opt-Out Support
 */
export const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp Webhook] Meta subscription verified successfully.');
    return res.status(200).send(challenge);
  }

  console.warn('[WhatsApp Webhook] Verification challenge rejected.');
  return res.status(403).send('Forbidden');
};

export const handleWebhookEvent = async (req, res) => {
  try {
    const body = req.body;
    if (!body || body.object !== 'whatsapp_business_account') {
      return res.status(200).json({ status: 'ignored' });
    }

    res.status(200).json({ status: 'received' });

    if (Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        if (!Array.isArray(entry.changes)) continue;

        for (const change of entry.changes) {
          const value = change.value;
          if (!value) continue;

          // 1. Process Status Updates (sent, delivered, read, failed)
          if (Array.isArray(value.statuses)) {
            for (const statusObj of value.statuses) {
              const providerMessageId = statusObj.id;
              const statusName = (statusObj.status || '').toLowerCase();
              const timestamp = statusObj.timestamp ? new Date(Number(statusObj.timestamp) * 1000) : new Date();

              const updateFields = {};
              if (statusName === 'sent') {
                updateFields.status = 'SENT';
                updateFields.sentAt = timestamp;
              } else if (statusName === 'delivered') {
                updateFields.status = 'DELIVERED';
                updateFields.deliveredAt = timestamp;
              } else if (statusName === 'read') {
                updateFields.status = 'READ';
                updateFields.readAt = timestamp;
              } else if (statusName === 'failed') {
                updateFields.status = 'FAILED';
                updateFields.failedAt = timestamp;
                if (statusObj.errors && statusObj.errors.length > 0) {
                  const errCode = statusObj.errors[0].code;
                  const errTitle = statusObj.errors[0].title || statusObj.errors[0].message || '';
                  updateFields.providerErrorCode = String(errCode || '');
                  updateFields.providerErrorMessage = errTitle;
                }
              }

              if (Object.keys(updateFields).length > 0 && providerMessageId) {
                await WhatsappMessage.updateOne({ providerMessageId }, { $set: updateFields });
              }
            }
          }

          // 2. Process Inbound Messages (Opt-Out / STOP commands)
          if (Array.isArray(value.messages)) {
            for (const msg of value.messages) {
              const senderPhone = normalizePhoneNumber(msg.from);
              const textBody = (msg.text?.body || '').trim().toUpperCase();

              const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'OPT OUT', 'OPTOUT', 'બંધ કરો', 'રોકો'];
              if (optOutKeywords.includes(textBody)) {
                console.log(`[WhatsApp Opt-Out] User '${maskPhoneNumber(senderPhone)}' requested opt-out with keyword: "${textBody}"`);

                await Registration.updateMany(
                  { phoneNumber: senderPhone },
                  {
                    $set: {
                      whatsappOptOutAt: new Date(),
                      whatsappOptOutReason: `Inbound keyword: ${textBody}`
                    }
                  }
                );
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[WhatsApp Webhook Error]:', err.message);
  }
};
