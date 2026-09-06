import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';
import { WhatsappMessage, WHATSAPP_MESSAGE_STATUSES } from '../src/models/WhatsappMessage.js';
import { Event } from '../src/models/Event.js';
import { Pass } from '../src/models/Pass.js';
import { qrPassService } from '../src/modules/passes/qrPass.service.js';
import { communicationSchedulerService } from '../src/services/communicationScheduler.service.js';

const uri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function run() {
  const isApply = process.argv.includes('--apply');
  console.log(`=== EVENT 2026-09-07 LIFECYCLE SYNC (${isApply ? 'APPLY MODE' : 'DRY RUN'}) ===\n`);

  await mongoose.connect(uri);

  const event7 = await Event.findOne({ id: 'prog-2026-09-07' }).lean();
  const event11 = await Event.findOne({ id: 'prog-2026-09-11' }).lean();

  if (!event7 || !event11) {
    console.error('Events not found in database!');
    process.exit(1);
  }

  // 1. Fix EK06-03 post-event message eventId
  const ek03Post = await WhatsappMessage.findOne({ inquiryId: 'EK06-03', trigger: 'post_event_memories_feedback' });
  if (ek03Post && ek03Post.eventId !== 'prog-2026-09-07') {
    console.log(`[1] EK06-03 post-event message has old eventId '${ek03Post.eventId}' -> updating to 'prog-2026-09-07'`);
    if (isApply) {
      ek03Post.eventId = 'prog-2026-09-07';
      await ek03Post.save();
      console.log('    ✓ Updated EK06-03 post-event eventId');
    }
  } else {
    console.log('[1] EK06-03 post-event message is already correct.');
  }

  // 2. Fix EK06-248: Reschedule to prog-2026-09-11
  const ek248 = await Registration.findOne({ inquiryId: 'EK06-248' });
  if (ek248 && ek248.programId === 'prog-2026-09-11') {
    console.log('\n[2] EK06-248 belongs to prog-2026-09-11. Cleaning up erroneous prog-2026-09-07 queued messages...');
    const queued248Old = await WhatsappMessage.find({
      inquiryId: 'EK06-248',
      eventId: 'prog-2026-09-07',
      status: 'QUEUED'
    });
    console.log(`    Found ${queued248Old.length} queued messages under prog-2026-09-07.`);
    if (isApply) {
      await WhatsappMessage.deleteMany({
        inquiryId: 'EK06-248',
        eventId: 'prog-2026-09-07',
        status: 'QUEUED'
      });
      console.log('    ✓ Deleted old prog-2026-09-07 queued messages.');
      // Reschedule for prog-2026-09-11
      await communicationSchedulerService.scheduleRegistrationLifecycle(ek248, event11);
      console.log('    ✓ Scheduled lifecycle for EK06-248 under prog-2026-09-11.');
    }
  }

  // 3. Fix EK06-312: Generate Pass and Schedule Lifecycle for prog-2026-09-07
  const ek312 = await Registration.findOne({ inquiryId: 'EK06-312' });
  if (ek312) {
    console.log('\n[3] Checking EK06-312 (Ashwinbhai & Hetalben Vaghani)...');
    let pass312 = await Pass.findOne({ inquiryId: 'EK06-312' });
    if (!pass312) {
      console.log('    Generating missing Pass for EK06-312...');
      if (isApply) {
        pass312 = await qrPassService.ensurePass(ek312, event7);
        console.log(`    ✓ Pass created: ${pass312.passNumber}`);
      }
    } else {
      console.log(`    Pass already exists: ${pass312.passNumber}`);
    }

    if (isApply) {
      // Delete any previous cancelled or pending
      await WhatsappMessage.deleteMany({
        inquiryId: 'EK06-312',
        trigger: { $in: ['scheduled_48h_pass_reminder', 'scheduled_24h_invitation', 'post_event_memories_feedback'] }
      });
      await communicationSchedulerService.scheduleRegistrationLifecycle(ek312, event7);
      console.log('    ✓ Scheduled lifecycle communications for EK06-312 under prog-2026-09-07.');
    }
  }

  // 4. Fix VIPs EK06-IP-01, EK06-IP-02, EK06-IP-03, EK06-IP-04
  const vips = ['EK06-IP-01', 'EK06-IP-02', 'EK06-IP-03', 'EK06-IP-04'];
  console.log('\n[4] Re-scheduling lifecycle for VIPs: ' + vips.join(', '));
  for (const vipId of vips) {
    const vipReg = await Registration.findOne({ inquiryId: vipId });
    if (vipReg) {
      console.log(`    Processing ${vipId} (${vipReg.husbandName} & ${vipReg.wifeName})...`);
      if (isApply) {
        // Remove previous CANCELLED messages so scheduleRegistrationLifecycle can insert fresh QUEUED ones
        await WhatsappMessage.deleteMany({
          inquiryId: vipId,
          trigger: { $in: ['scheduled_48h_pass_reminder', 'scheduled_24h_invitation', 'post_event_memories_feedback'] },
          status: 'CANCELLED'
        });
        await communicationSchedulerService.scheduleRegistrationLifecycle(vipReg, event7);
        console.log(`    ✓ Scheduled lifecycle communications for ${vipId}.`);
      }
    }
  }

  // 5. Final verification of queue counts
  if (isApply) {
    console.log('\n=== POST-SYNC VERIFICATION ===');
    const queuedCount7 = await WhatsappMessage.aggregate([
      { $match: { eventId: 'prog-2026-09-07', status: 'QUEUED' } },
      { $group: { _id: '$trigger', count: { $sum: 1 } } }
    ]);
    console.log('Queued messages for prog-2026-09-07:');
    console.log(queuedCount7);

    const totalQueued7 = await WhatsappMessage.countDocuments({
      eventId: 'prog-2026-09-07',
      status: 'QUEUED'
    });
    console.log(`Total Queued for prog-2026-09-07: ${totalQueued7}`);
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

run().catch(console.error);
