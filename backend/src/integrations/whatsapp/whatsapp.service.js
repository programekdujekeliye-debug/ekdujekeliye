import crypto from 'crypto';
import { env, getMetaGraphApiUrl, normalizePhoneNumber, maskSecret } from '../../config/env.js';
import { TEMPLATE_REGISTRY, validateTemplateVariables } from './templateRegistry.js';
import { WhatsappMessage } from '../../models/WhatsappMessage.js';
import { WhatsappConversation } from '../../models/WhatsappConversation.js';
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

  // 3. Test Mode Allowlist Guard (Only applies when calling real Meta API in non-prod)
  const isMock = providerMode === 'MOCK' || executionSource === 'AUTOMATED_TEST' || env.WHATSAPP_MODE === 'mock' || process.env.WHATSAPP_MODE === 'mock';
  if (!isMock && (env.WHATSAPP_MODE === 'test' || env.APP_ENV !== 'production')) {
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

  const headerComponent = templateDef.components?.find(c => c.type === 'HEADER');
  if (headerComponent && headerComponent.format === 'IMAGE') {
    const mediaUrl = variables.headerImageUrl || variables.imageUrl || variables.invitationImageUrl || 'https://www.ekdujekeliye.in/sample_couple.png';
    componentsPayload.push({
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: {
            link: mediaUrl
          }
        }
      ]
    });
  }

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

  // 10.5. Mock Provider Interceptor for Automated Tests and Local Testing
  if (providerMode === 'MOCK' || executionSource === 'AUTOMATED_TEST' || env.WHATSAPP_MODE === 'mock') {
    const mockWamid = `wamid.MOCK_TEST_${Date.now()}`;
    messageRecord.status = 'SENT';
    messageRecord.providerMessageId = mockWamid;
    messageRecord.providerMode = 'MOCK';
    messageRecord.providerAcceptedAt = new Date();
    messageRecord.sentAt = new Date();
    messageRecord.rawProviderResponse = {
      messaging_product: 'whatsapp',
      contacts: [{ input: normalizedPhone, wa_id: normalizedPhone }],
      messages: [{ id: mockWamid, message_status: 'accepted' }]
    };
    await messageRecord.save();

    console.log(`[WhatsApp Mock Dispatch] Simulated message '${templateDef.metaName}' for ${maskedPhone} -> ${mockWamid}`);

    return {
      success: true,
      status: 'SENT',
      providerMessageId: mockWamid,
      messageRecord: messageRecord.toObject ? messageRecord.toObject() : messageRecord
    };
  }

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
 * Dispatch free-text reply to an open 24-hour customer service window
 */
export async function sendFreeTextMessage({
  recipientPhone,
  text,
  conversationId,
  registrationId = null,
  eventId = null,
  inquiryId = null,
  adminId = null,
  adminName = 'Admin',
  replyToMessageId = null,
  executionSource = 'ADMIN_REPLY',
  providerMode = 'META'
}) {
  const normalizedPhone = normalizePhoneNumber(recipientPhone);
  if (!normalizedPhone || normalizedPhone.length < 10) {
    throw new Error(`Invalid recipient phone: ${recipientPhone}`);
  }

  const maskedPhone = maskPhoneNumber(normalizedPhone);
  const idempotencyKey = `REPLY:${conversationId || normalizedPhone}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`;

  const messageRecord = await WhatsappMessage.create({
    messageId: `WA-REP-${crypto.randomBytes(8).toString('hex')}`,
    conversationId,
    direction: 'OUTBOUND',
    eventId,
    registrationId,
    inquiryId,
    recipientPhone: normalizedPhone,
    recipientMasked: maskedPhone,
    recipientHash: hashPhoneNumber(normalizedPhone),
    content: text,
    contentType: 'text',
    replyToMessageId,
    sentByAdminId: adminId,
    sentByAdminName: adminName,
    messageType: 'admin_reply',
    trigger: 'support_reply',
    executionSource,
    providerMode: env.WHATSAPP_MODE === 'test' ? 'MOCK' : providerMode,
    idempotencyKey,
    status: 'SENDING',
    attemptCount: 1,
    lastAttemptAt: new Date()
  });

  // Mock Provider for automated tests / local test mode
  if (providerMode === 'MOCK' || executionSource === 'AUTOMATED_TEST' || env.WHATSAPP_MODE === 'mock' || env.WHATSAPP_MODE === 'test') {
    const mockWamid = `wamid.MOCK_TEST_${Date.now()}`;
    messageRecord.status = 'SENT';
    messageRecord.providerMessageId = mockWamid;
    messageRecord.providerMode = 'MOCK';
    messageRecord.providerAcceptedAt = new Date();
    messageRecord.sentAt = new Date();
    messageRecord.rawProviderResponse = {
      messaging_product: 'whatsapp',
      contacts: [{ input: normalizedPhone, wa_id: normalizedPhone }],
      messages: [{ id: mockWamid, message_status: 'accepted' }]
    };
    await messageRecord.save();

    if (conversationId) {
      await WhatsappConversation.updateOne(
        { _id: conversationId },
        {
          $set: {
            lastOutboundAt: new Date(),
            lastMessageAt: new Date(),
            lastMessagePreview: text,
            lastMessageDirection: 'OUTBOUND',
            lastMessageStatus: 'SENT'
          }
        }
      );
    }

    return {
      success: true,
      status: 'SENT',
      providerMessageId: mockWamid,
      messageRecord
    };
  }

  // Dispatch via Meta Graph API
  const metaUrl = getMetaGraphApiUrl(`${env.WHATSAPP_PHONE_NUMBER_ID}/messages`);
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedPhone,
    type: 'text',
    text: {
      preview_url: false,
      body: text
    },
    ...(replyToMessageId ? { context: { message_id: replyToMessageId } } : {})
  };

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
      messageRecord.status = 'FAILED';
      messageRecord.lastErrorCode = errCode;
      messageRecord.lastErrorMessage = errTitle;
      messageRecord.failedAt = new Date();
      messageRecord.rawProviderResponse = data;
      await messageRecord.save();
      return { success: false, status: 'FAILED', error: errTitle, code: errCode };
    }

    const providerMessageId = data.messages?.[0]?.id || '';
    messageRecord.status = 'SENT';
    messageRecord.providerMessageId = providerMessageId;
    messageRecord.providerAcceptedAt = new Date();
    messageRecord.sentAt = new Date();
    messageRecord.rawProviderResponse = data;
    await messageRecord.save();

    if (conversationId) {
      await WhatsappConversation.updateOne(
        { _id: conversationId },
        {
          $set: {
            lastOutboundAt: new Date(),
            lastMessageAt: new Date(),
            lastMessagePreview: text,
            lastMessageDirection: 'OUTBOUND',
            lastMessageStatus: 'SENT'
          }
        }
      );
    }

    return { success: true, status: 'SENT', providerMessageId, messageRecord };
  } catch (netErr) {
    messageRecord.status = 'FAILED';
    messageRecord.lastErrorMessage = netErr.message;
    messageRecord.failedAt = new Date();
    await messageRecord.save();
    return { success: false, status: 'FAILED', error: netErr.message };
  }
}

/**
 * Webhook Inbound Event Handler with Status Updates, STOP / Opt-Out, and Two-Way Inbox Inbound Messages
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

          // 2. Process Inbound Messages (Two-Way Support Chat + Opt-Out)
          if (Array.isArray(value.messages)) {
            for (const msg of value.messages) {
              const providerMessageId = msg.id;
              const senderPhone = normalizePhoneNumber(msg.from);
              if (!senderPhone || senderPhone.length < 10) continue;

              const timestamp = msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date();

              // Idempotency: Ignore duplicate webhook delivery from Meta
              if (providerMessageId) {
                const existing = await WhatsappMessage.findOne({ providerMessageId });
                if (existing) continue;
              }

              const msgType = msg.type || 'text';
              let textBody = '';
              let mediaId = null;
              let mediaMimeType = null;
              let mediaCaption = null;

              if (msgType === 'text') {
                textBody = (msg.text?.body || '').trim();
              } else if (msgType === 'button') {
                textBody = msg.button?.text || '';
              } else if (msgType === 'interactive') {
                textBody = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
              } else if (msg[msgType]) {
                mediaId = msg[msgType]?.id || null;
                mediaMimeType = msg[msgType]?.mime_type || null;
                mediaCaption = msg[msgType]?.caption || '';
                textBody = mediaCaption || `[${msgType.toUpperCase()}]`;
              }

              // Check Opt-Out Keywords
              const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'OPT OUT', 'OPTOUT', 'બંધ કરો', 'રોકો'];
              if (optOutKeywords.includes(textBody.toUpperCase())) {
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

              // Match Customer to Registration (Prefer active/upcoming, then latest)
              const registrations = await Registration.find({
                phoneNumber: senderPhone,
                isDeleted: { $ne: true }
              }).sort({ createdAt: -1 });

              const activeReg = registrations.find(r => r.status === 'approved' || r.status === 'pending') || registrations[0] || null;

              const customerName = activeReg
                ? `${activeReg.husbandName || ''} & ${activeReg.wifeName || ''}`.trim() || activeReg.coupleName || 'Respected Couple'
                : (value.contacts?.[0]?.profile?.name || 'WhatsApp Guest');

              // Find or create Conversation and set 24h Customer Service Window
              const windowExpiry = new Date(timestamp.getTime() + 24 * 60 * 60 * 1000);
              let conversation = await WhatsappConversation.findOne({ phone: senderPhone });

              if (!conversation) {
                conversation = await WhatsappConversation.create({
                  phone: senderPhone,
                  phoneMasked: maskPhoneNumber(senderPhone),
                  phoneHash: hashPhoneNumber(senderPhone),
                  registrationId: activeReg?._id || null,
                  inquiryId: activeReg?.inquiryId || null,
                  eventId: activeReg?.programId || null,
                  customerName,
                  status: 'OPEN',
                  unreadCount: 1,
                  lastMessageAt: timestamp,
                  lastMessagePreview: textBody || `[${msgType.toUpperCase()}]`,
                  lastMessageDirection: 'INBOUND',
                  lastMessageStatus: 'RECEIVED',
                  lastInboundAt: timestamp,
                  customerServiceWindowExpiresAt: windowExpiry
                });
              } else {
                conversation.status = 'OPEN'; // Reopen conversation on new inbound message
                conversation.unreadCount = (conversation.unreadCount || 0) + 1;
                conversation.lastMessageAt = timestamp;
                conversation.lastMessagePreview = textBody || `[${msgType.toUpperCase()}]`;
                conversation.lastMessageDirection = 'INBOUND';
                conversation.lastMessageStatus = 'RECEIVED';
                conversation.lastInboundAt = timestamp;
                conversation.customerServiceWindowExpiresAt = windowExpiry;
                if (activeReg && !conversation.registrationId) {
                  conversation.registrationId = activeReg._id;
                  conversation.inquiryId = activeReg.inquiryId;
                  conversation.eventId = activeReg.programId;
                  conversation.customerName = customerName;
                }
                await conversation.save();
              }

              // Store Inbound Message Record
              const displayBusinessNumber = value.metadata?.display_phone_number || env.WHATSAPP_PHONE_NUMBER_ID || 'business';
              await WhatsappMessage.create({
                messageId: `WA-IN-${providerMessageId || crypto.randomBytes(8).toString('hex')}`,
                conversationId: conversation._id,
                direction: 'INBOUND',
                eventId: conversation.eventId,
                registrationId: conversation.registrationId,
                inquiryId: conversation.inquiryId,
                recipientPhone: normalizePhoneNumber(displayBusinessNumber),
                recipientMasked: maskPhoneNumber(displayBusinessNumber),
                recipientHash: hashPhoneNumber(displayBusinessNumber),
                senderPhone,
                senderMasked: maskPhoneNumber(senderPhone),
                content: textBody,
                contentType: msgType,
                mediaId,
                mediaMimeType,
                mediaCaption,
                replyToMessageId: msg.context?.id || null,
                messageType: 'chat_message',
                executionSource: 'INBOUND_WEBHOOK',
                providerMode: (providerMessageId && providerMessageId.startsWith('wamid.MOCK_TEST_')) ? 'MOCK' : 'META',
                idempotencyKey: `INBOUND:${providerMessageId || crypto.randomBytes(8).toString('hex')}`,
                status: 'RECEIVED',
                providerMessageId,
                receivedAt: timestamp,
                rawProviderResponse: msg
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[WhatsApp Webhook Error]:', err.message);
  }
};
