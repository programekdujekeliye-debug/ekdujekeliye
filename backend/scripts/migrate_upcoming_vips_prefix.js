import mongoose from 'mongoose';

const uri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function run() {
  const isApply = process.argv.includes('--apply');
  console.log(`=== MIGRATE UPCOMING VIPS PREFIX (${isApply ? 'APPLY MODE' : 'DRY RUN'}) ===\n`);

  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;

  // Find upcoming VIPs with bare IP- prefix in upcoming events (>= 2026-09-07)
  const upcomingVips = await db.collection('submission').find({
    isVip: true,
    programId: { $in: ['prog-2026-09-07', 'prog-2026-09-11', 'prog-2026-09-19'] },
    inquiryId: { $regex: '^IP-', $options: 'i' }
  }).sort({ createdAt: 1 }).toArray();

  console.log(`Found ${upcomingVips.length} upcoming VIPs to update:`);

  for (let i = 0; i < upcomingVips.length; i++) {
    const vip = upcomingVips[i];
    const oldId = vip.inquiryId;
    // Map IP-01 -> EK06-IP-01, etc.
    const numPart = oldId.replace(/^IP-/i, '');
    const paddedNum = String(parseInt(numPart, 10) || (i + 1)).padStart(2, '0');
    const newId = `EK06-IP-${paddedNum}`;

    console.log(`\n[${i + 1}] ${vip.husbandName} & ${vip.wifeName} (${vip.programId})`);
    console.log(`    Old ID: ${oldId}  -->  New ID: ${newId}`);

    if (isApply) {
      // 1. Update submission
      await db.collection('submission').updateOne(
        { _id: vip._id },
        { $set: { inquiryId: newId } }
      );
      console.log(`    ✓ Updated submission inquiryId to ${newId}`);

      // 2. Update pass
      const passUpdate = await db.collection('passes').updateMany(
        { inquiryId: oldId },
        { $set: { inquiryId: newId } }
      );
      console.log(`    ✓ Updated ${passUpdate.modifiedCount} pass record(s) to ${newId}`);

      // 3. Update whatsapp_messages
      const msgUpdate = await db.collection('whatsapp_messages').updateMany(
        { inquiryId: oldId },
        { $set: { inquiryId: newId } }
      );
      console.log(`    ✓ Updated ${msgUpdate.modifiedCount} whatsapp message(s) to ${newId}`);
    }
  }

  if (isApply) {
    // Set counter for prog-2026-09-07 so next VIP starts at 5
    await db.collection('counters').updateOne(
      { _id: 'manualInquiryNumber_prog-2026-09-07' },
      { $set: { seq: upcomingVips.length } },
      { upsert: true }
    );
    console.log(`\n✓ Initialized counter 'manualInquiryNumber_prog-2026-09-07' to ${upcomingVips.length}`);
  }

  console.log(`\nDone! ${isApply ? 'Changes committed.' : 'Dry run complete. Pass --apply to execute.'}`);
  await mongoose.disconnect();
}

run().catch(console.error);
