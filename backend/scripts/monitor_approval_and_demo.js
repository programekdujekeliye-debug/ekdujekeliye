import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { whatsappTemplateService } from '../src/integrations/whatsapp/whatsappTemplate.service.js';
import { sendUtilityTemplate } from '../src/integrations/whatsapp/whatsapp.service.js';
import { deleteTemplateFromMeta } from './delete_meta_template.js';
import { Registration } from '../src/models/Registration.js';
import { Event } from '../src/models/Event.js';
import { invitationCardService } from '../src/services/invitationCard.service.js';

async function checkAndProcess() {
  const res = await whatsappTemplateService.fetchMetaTemplates();
  if (!res.success) {
    console.error('Failed to fetch Meta templates:', res.error);
    return;
  }

  const templates = res.templates || [];
  const statusMap = new Map(templates.map(t => [t.name, t.status]));

  console.log(`\n[${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })} IST] Checking Meta Template Statuses:`);
  console.log(' - edkl_event_pass_reminder_v2:', statusMap.get('edkl_event_pass_reminder_v2'));
  console.log(' - edkl_personal_invitation_24h_v2:', statusMap.get('edkl_personal_invitation_24h_v2'));
  console.log(' - edkl_post_event_memories_feedback_v1:', statusMap.get('edkl_post_event_memories_feedback_v1'));

  const isReminderApproved = statusMap.get('edkl_event_pass_reminder_v2') === 'APPROVED';
  const isInvitationApproved = statusMap.get('edkl_personal_invitation_24h_v2') === 'APPROVED';
  const isFeedbackApproved = statusMap.get('edkl_post_event_memories_feedback_v1') === 'APPROVED';

  // If newly approved, clean up old templates from Meta WABA
  if (isReminderApproved && statusMap.has('edkl_event_reminder_v1')) {
    console.log('edkl_event_pass_reminder_v2 is APPROVED! Deleting obsolete edkl_event_reminder_v1 from Meta...');
    await deleteTemplateFromMeta('edkl_event_reminder_v1');
  }

  if (isInvitationApproved && statusMap.has('edkl_personal_invitation_48h_v1')) {
    console.log('edkl_personal_invitation_24h_v2 is APPROVED! Deleting obsolete edkl_personal_invitation_48h_v1 from Meta...');
    await deleteTemplateFromMeta('edkl_personal_invitation_48h_v1');
  }

  if (isFeedbackApproved && statusMap.has('edkl_event_feedback_v1')) {
    console.log('edkl_post_event_memories_feedback_v1 is APPROVED! Deleting obsolete edkl_event_feedback_v1 from Meta...');
    await deleteTemplateFromMeta('edkl_event_feedback_v1');
  }

  return {
    isReminderApproved,
    isInvitationApproved,
    isFeedbackApproved,
    allApproved: isReminderApproved && isInvitationApproved && isFeedbackApproved
  };
}

async function dispatchLatestDemo() {
  const targetPhone = '918320594829';
  console.log(`\nDispatching latest approved templates to demo phone: +${targetPhone}`);

  const prodUri = env.MONGO_URI.replace('/ekdujekeliye_test', '/ekdujekeliye');
  await mongoose.connect(prodUri);

  const reg = await Registration.findOne({ inquiryId: 'EK06-263' });
  const event = await Event.findOne({ $or: [{ id: 'prog-2026-09-07' }, { slug: 'prog-2026-09-07' }] });

  // Generate high-resolution rendered couple card
  console.log('Rendering high-res couple card image...');
  const cardResult = await invitationCardService.ensureInvitationCardImage(reg, event);
  const cardUrl = cardResult?.cardUrl || 'https://res.cloudinary.com/rh3wmfta/image/upload/v1788380528/invitation-cards/invitation_EK06-263_demo_1788380526517.jpg';
  console.log('Using rendered card URL:', cardUrl);

  const customerName = `${reg.husbandName} & ${reg.wifeName}`;
  const inquiryId = reg.inquiryId;
  const eventName = event.name;
  const eventDate = event.date;
  const eventTime = event.time;
  const venue = event.venue;

  // 1. Send 48h Reminder
  console.log('\nSending 48h Reminder...');
  const res1 = await sendUtilityTemplate({
    recipientPhone: targetPhone,
    templateKey: 'edkl_event_pass_reminder_v2',
    languageCode: 'en_US',
    variables: {
      customerName,
      eventName,
      eventDate,
      eventTime,
      venue,
      registrationId: inquiryId,
      inquiryId
    },
    idempotencyKey: `DEMO_V2_REMINDER:${targetPhone}:${Date.now()}`,
    trigger: 'manual_admin_demo',
    executionSource: 'MANUAL_TEST',
    inquiryId
  });
  console.log('Reminder Result:', res1.status, res1.providerMessageId || res1.error);

  await new Promise(r => setTimeout(r, 2000));

  // 2. Send 24h Invitation with Couple Card Image
  console.log('\nSending 24h Personalized Couple Invitation with Image Card...');
  const res2 = await sendUtilityTemplate({
    recipientPhone: targetPhone,
    templateKey: 'edkl_personal_invitation_24h_v2',
    languageCode: 'en_US',
    variables: {
      customerName,
      eventName,
      eventDate,
      eventTime,
      venue,
      registrationId: inquiryId,
      inquiryId,
      headerImageUrl: cardUrl
    },
    idempotencyKey: `DEMO_V2_INVITATION:${targetPhone}:${Date.now()}`,
    trigger: 'manual_admin_demo',
    executionSource: 'MANUAL_TEST',
    inquiryId
  });
  console.log('Invitation Result:', res2.status, res2.providerMessageId || res2.error);

  await new Promise(r => setTimeout(r, 2000));

  // 3. Send Post-Event Feedback & Memories
  console.log('\nSending Post-Event Memories & Feedback...');
  const res3 = await sendUtilityTemplate({
    recipientPhone: targetPhone,
    templateKey: 'edkl_post_event_memories_feedback_v1',
    languageCode: 'en_US',
    variables: {
      customerName,
      eventName,
      registrationId: inquiryId,
      galleryToken: inquiryId,
      feedbackToken: 'demo-feedback'
    },
    idempotencyKey: `DEMO_V2_FEEDBACK:${targetPhone}:${Date.now()}`,
    trigger: 'manual_admin_demo',
    executionSource: 'MANUAL_TEST',
    inquiryId
  });
  console.log('Feedback Result:', res3.status, res3.providerMessageId || res3.error);

  await mongoose.disconnect();
}

async function run() {
  const status = await checkAndProcess();
  if (status && status.allApproved) {
    console.log('\nALL 3 TEMPLATES ARE APPROVED BY META! Dispatching demo now...');
    await dispatchLatestDemo();
  } else {
    console.log('\nTemplates are still pending Meta review. We will recheck periodically.');
  }
}

run().catch(console.error);
