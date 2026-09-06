import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority');
  
  const WhatsappMessage = mongoose.model('WhatsappMessage', new mongoose.Schema({}, { collection: 'whatsapp_messages', strict: false }));
  
  const total = await WhatsappMessage.countDocuments();
  const byStatus = await WhatsappMessage.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  
  console.log('Total Messages:', total);
  console.log('By Status:', byStatus);

  const lastDelivered = await WhatsappMessage.findOne({ status: 'DELIVERED' }).sort({ deliveredAt: -1 }).lean();
  const lastRead = await WhatsappMessage.findOne({ status: 'READ' }).sort({ readAt: -1 }).lean();
  const lastFailed = await WhatsappMessage.findOne({ status: 'FAILED' }).sort({ failedAt: -1 }).lean();
  const lastAccepted = await WhatsappMessage.findOne({ providerAcceptedAt: { $ne: null } }).sort({ providerAcceptedAt: -1 }).lean();

  console.log('Last DELIVERED at:', lastDelivered?.deliveredAt, 'to:', lastDelivered?.recipientMasked, 'template:', lastDelivered?.templateName);
  console.log('Last READ at:', lastRead?.readAt, 'to:', lastRead?.recipientMasked, 'template:', lastRead?.templateName);
  console.log('Last FAILED at:', lastFailed?.failedAt, 'inquiry:', lastFailed?.inquiryId, 'error:', lastFailed?.lastErrorMessage, 'code:', lastFailed?.lastErrorCode, 'template:', lastFailed?.templateName);
  console.log('Last ACCEPTED at:', lastAccepted?.providerAcceptedAt, 'inquiry:', lastAccepted?.inquiryId, 'template:', lastAccepted?.templateName);

  // Group failures by error code
  const failedCodes = await WhatsappMessage.aggregate([
    { $match: { status: 'FAILED' } },
    { $group: { _id: { code: '$lastErrorCode', msg: '$lastErrorMessage' }, count: { $sum: 1 } } }
  ]);
  console.log('Failures by Code:', failedCodes);

  // Check how many failed messages are for event prog-2026-09-07
  const failedSept7 = await WhatsappMessage.countDocuments({ eventId: 'prog-2026-09-07', status: 'FAILED' });
  console.log('Failed for prog-2026-09-07:', failedSept7);

  // Print all failed messages for prog-2026-09-07
  const failedList = await WhatsappMessage.find({ eventId: 'prog-2026-09-07', status: 'FAILED' }).lean();
  console.log('Failed Messages for prog-2026-09-07:');
  console.log(failedList.map(f => ({
    inquiryId: f.inquiryId,
    recipient: f.recipientPhone,
    template: f.templateName,
    messageType: f.messageType,
    failedAt: f.failedAt,
    error: f.lastErrorMessage,
    code: f.lastErrorCode
  })));

  process.exit(0);
}

run().catch(console.error);
