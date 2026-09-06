import mongoose from 'mongoose';

async function main() {
  await mongoose.connect('mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority');
  const Msg = mongoose.model('WhatsappMessage', new mongoose.Schema({}, { collection: 'whatsapp_messages', strict: false }));
  
  const query = {
    status: { $in: ['FAILED', 'BLOCKED_TEST_MODE'] },
    templateName: { $ne: 'edkl_september_special_invite_v1' },
    trigger: { $ne: 'marketing_broadcast' },
    eventId: { $in: ['prog-2026-09-07', 'surat-7-september-2026', '2026-09-07'] }
  };
  
  const docs = await Msg.find(query).lean();
  console.log('Matching failed docs:', docs.length);
  docs.forEach(d => console.log(d.inquiryId, d.messageType, d.templateName, d.status, d.lastErrorCode || d.providerErrorCode, d.lastErrorMessage || d.providerErrorMessage));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
