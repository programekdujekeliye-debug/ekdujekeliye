import { Registration } from '../models/Registration.js';
import { Event } from '../models/Event.js';
import { Pass } from '../models/Pass.js';
import { WhatsappMessage } from '../models/WhatsappMessage.js';
import { WhatsappConversation } from '../models/WhatsappConversation.js';
import { qrPassService } from '../modules/passes/qrPass.service.js';
import { invitationCardService } from './invitationCard.service.js';
import { communicationSchedulerService } from './communicationScheduler.service.js';
import { sendUtilityTemplate, normalizePhoneNumber } from '../integrations/whatsapp/whatsapp.service.js';

export class TransferNotificationService {
  /**
   * Process complete post-transfer operations for a transferred registration:
   * 1. Cryptographic Pass re-signing and cascading for target event.
   * 2. Personalized invitation card image generation.
   * 3. WhatsApp dispatch with updated invitation card and digital pass button (if approved/VIP/captured).
   * 4. Lifecycle reminder rescheduling for the new event date.
   * 5. Two-Way WhatsApp conversation metadata sync.
   */
  async processTransfer({ registrationOrId, targetProgramOrId, oldInquiryId, newInquiryId, source = 'single_transfer' }) {
    try {
      let reg = registrationOrId;
      if (typeof registrationOrId === 'string') {
        reg = await Registration.findById(registrationOrId);
      }
      if (!reg) {
        console.warn('[TransferNotificationService] Registration not found for transfer notification.');
        return { success: false, error: 'Registration not found' };
      }

      let targetProgram = targetProgramOrId;
      if (typeof targetProgramOrId === 'string') {
        targetProgram = await Event.findOne({
          $or: [{ id: targetProgramOrId }, { slug: targetProgramOrId }, { date: targetProgramOrId }]
        });
      }
      if (!targetProgram) {
        console.warn('[TransferNotificationService] Target program not found for transfer notification.');
        return { success: false, error: 'Target program not found' };
      }

      const activeInquiryId = newInquiryId || reg.inquiryId;

      // 1. Ensure / update cryptographic QR pass for the new event
      try {
        let pass = await Pass.findOne({
          $or: [
            { registrationId: reg._id },
            ...(oldInquiryId ? [{ inquiryId: oldInquiryId }] : []),
            { inquiryId: activeInquiryId }
          ]
        });

        if (pass) {
          pass.eventId = targetProgram.id;
          pass.inquiryId = activeInquiryId;
          pass.version = (pass.version || 1) + 1;
          const payload = {
            v: 1,
            eventId: targetProgram.id,
            passId: pass.passId,
            version: pass.version,
            issuedAt: Math.floor(Date.now() / 1000),
            keyId: 'edkl-k1'
          };
          pass.qrToken = qrPassService.signPassPayload(payload);
          await pass.save();
        } else {
          await qrPassService.ensurePass(reg, targetProgram);
        }
      } catch (passErr) {
        console.warn(`[TransferNotificationService] Pass update error for ${activeInquiryId}:`, passErr.message);
      }

      // 2. Generate updated personalized invitation card with new event date & venue
      let headerImageUrl = reg.couplePhoto || 'https://www.ekdujekeliye.in/sample_couple.png';
      try {
        const cardRes = await invitationCardService.ensureInvitationCardImage(reg, targetProgram);
        if (cardRes && cardRes.cardUrl) {
          headerImageUrl = cardRes.cardUrl;
        }
      } catch (cardErr) {
        console.warn(`[TransferNotificationService] Invitation card rendering error for ${activeInquiryId}:`, cardErr.message);
      }

      // 3. Check if attendee is eligible for active pass notification (approved / paid / VIP)
      const isApprovedOrPaid = reg.status === 'approved' || reg.isVip || reg.payment?.status === 'captured';

      let dispatchResult = null;
      if (isApprovedOrPaid && reg.phoneNumber) {
        const customerName = reg.husbandName && reg.wifeName
          ? `${reg.husbandName} & ${reg.wifeName}`.trim()
          : (reg.husbandName || reg.wifeName || 'Respected Couple');

        dispatchResult = await sendUtilityTemplate({
          recipientPhone: reg.phoneNumber,
          templateKey: 'edkl_personal_invitation_24h_v2',
          languageCode: 'en_US',
          variables: {
            customerName,
            eventName: targetProgram.name || reg.programName || 'Ek Duje Ke Liye Seminar',
            eventDate: targetProgram.date || reg.programDate || 'Upcoming',
            eventTime: targetProgram.time || reg.programTime || '8:30 PM',
            venue: targetProgram.venue || reg.venue || 'Sardar Smruti Bhavan, Surat',
            registrationId: activeInquiryId,
            inquiryId: activeInquiryId,
            headerImageUrl
          },
          idempotencyKey: `EVENT_TRANSFER:${reg._id}:${activeInquiryId}:${Date.now()}`,
          registrationId: reg._id,
          eventId: targetProgram.id,
          inquiryId: activeInquiryId,
          trigger: 'event_transfer'
        });

        console.log(`[TransferNotificationService] Dispatched transfer invitation to ${reg.phoneNumber} (${activeInquiryId}):`, dispatchResult?.status || dispatchResult?.success);
      }

      // 4. Cancel old queued reminders and reschedule lifecycle for target event
      try {
        await WhatsappMessage.deleteMany({
          registrationId: reg._id,
          status: 'QUEUED'
        });

        await communicationSchedulerService.scheduleRegistrationLifecycle(reg, targetProgram, {
          executionSource: 'EVENT_TRANSFER'
        });
      } catch (schedErr) {
        console.warn(`[TransferNotificationService] Rescheduling error for ${activeInquiryId}:`, schedErr.message);
      }

      // 5. Sync Two-Way WhatsApp conversation metadata
      try {
        const normPhone = normalizePhoneNumber(reg.phoneNumber);
        if (normPhone) {
          await WhatsappConversation.updateMany(
            {
              $or: [
                { registrationId: reg._id },
                { phone: normPhone },
                ...(oldInquiryId ? [{ inquiryId: oldInquiryId }] : [])
              ]
            },
            {
              $set: {
                registrationId: reg._id,
                inquiryId: activeInquiryId,
                eventId: targetProgram.id
              }
            }
          );
        }
      } catch (convErr) {
        console.warn(`[TransferNotificationService] Conversation sync error for ${activeInquiryId}:`, convErr.message);
      }

      return {
        success: true,
        dispatched: Boolean(dispatchResult?.success),
        inquiryId: activeInquiryId
      };
    } catch (err) {
      console.error('[TransferNotificationService] Process transfer error:', err);
      return { success: false, error: err.message };
    }
  }
}

export const transferNotificationService = new TransferNotificationService();
