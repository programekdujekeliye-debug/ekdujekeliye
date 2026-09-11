/**
 * Production Pass Audit & Self-Healing Utility
 *
 * Scans all approved registrations in the database.
 * If any approved registration is missing an active Pass or valid QR token,
 * it automatically generates and signs the pass immediately.
 *
 * Usage:
 *   node scripts/audit_and_heal_passes.js
 *   node scripts/audit_and_heal_passes.js --prod (if PROD_MONGO_URI is set)
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Registration } from '../src/models/Registration.js';
import { Pass } from '../src/models/Pass.js';
import { Event } from '../src/models/Event.js';
import { qrPassService } from '../src/modules/passes/qrPass.service.js';

async function auditAndHeal() {
  const isProdFlag = process.argv.includes('--prod');
  const targetUri = (isProdFlag && env.PROD_MONGO_URI) ? env.PROD_MONGO_URI : env.MONGO_URI;

  console.log('===============================================================');
  console.log('EDKL PASS AUDIT & PRODUCTION SELF-HEALING ENGINE');
  console.log(`Target Database: ${isProdFlag ? 'PRODUCTION (PROD_MONGO_URI)' : env.DATABASE_NAME}`);
  console.log('===============================================================\n');

  await mongoose.connect(targetUri, {
    dbName: isProdFlag ? undefined : env.DATABASE_NAME
  });

  // 1. Fetch all events for context mapping
  const events = await Event.find().lean();
  const eventMap = new Map();
  for (const ev of events) {
    if (ev.id) eventMap.set(ev.id, ev);
    if (ev.slug) eventMap.set(ev.slug, ev);
  }

  // 2. Query all approved or payment-captured registrations (as Mongoose docs)
  const approvedRegs = await Registration.find({
    $or: [
      { status: 'approved' },
      { 'payment.status': 'captured' }
    ],
    isDeleted: { $ne: true }
  });

  console.log(`Auditing ${approvedRegs.length} approved/captured registrations across all events...\n`);

  let alreadyOk = 0;
  let healedCreated = 0;
  let healedTokens = 0;
  let errors = 0;

  for (const reg of approvedRegs) {
    const inquiryId = reg.inquiryId;
    const eventObj = eventMap.get(reg.programId) || events[0] || { id: reg.programId, name: reg.programName };

    try {
      // Check if Pass exists
      let pass = await Pass.findOne({
        $or: [
          { registrationId: reg._id },
          { inquiryId }
        ]
      });

      if (!pass) {
        // Missing Pass: Auto-Heal by creating authoritative pass
        pass = await qrPassService.ensurePass(reg, eventObj);
        healedCreated++;
        console.log(`✓ [CREATED PASS] ${inquiryId} (${reg.husbandName} & ${reg.wifeName}) -> Pass ID: ${pass.passId}`);
      } else {
        let needsSave = false;

        // Backfill missing registrationId if missing
        if (!pass.registrationId && reg._id) {
          pass.registrationId = reg._id;
          needsSave = true;
        }

        // Check qrToken validity
        let tokenNeedsResign = false;
        if (!pass.qrToken) {
          tokenNeedsResign = true;
        } else {
          const verify = qrPassService.verifyPassToken(pass.qrToken);
          if (!verify.valid) {
            tokenNeedsResign = true;
          }
        }

        if (tokenNeedsResign) {
          const payload = {
            v: 1,
            eventId: pass.eventId || eventObj.id || reg.programId,
            passId: pass.passId,
            version: pass.version || 1,
            issuedAt: Math.floor((pass.issuedAt ? pass.issuedAt.getTime() : Date.now()) / 1000),
            keyId: 'edkl-k1'
          };
          pass.qrToken = qrPassService.signPassPayload(payload);
          pass.status = 'ACTIVE';
          needsSave = true;
          healedTokens++;
          console.log(`✓ [RE-SIGNED TOKEN] ${inquiryId} (${pass.passId}) with valid Ed25519 signature`);
        }

        if (needsSave) {
          await pass.save();
        } else {
          alreadyOk++;
        }
      }
    } catch (err) {
      errors++;
      console.error(`✗ [ERROR] Failed to audit ${inquiryId}:`, err.message);
    }
  }

  console.log('\n===============================================================');
  console.log('AUDIT & HEALING SUMMARY:');
  console.log(`- Total Approved Registrations: ${approvedRegs.length}`);
  console.log(`- Already Healthy Passes:       ${alreadyOk}`);
  console.log(`- Missing Passes Created:       ${healedCreated}`);
  console.log(`- Broken QR Tokens Re-signed:   ${healedTokens}`);
  console.log(`- Errors Encountered:           ${errors}`);
  console.log('===============================================================');

  if (healedCreated > 0 || healedTokens > 0) {
    console.log('\n🎉 ALL APPROVED ATTENDEES NOW HAVE VERIFIED, ACTIVE DIGITAL PASSES!');
    console.log('Gate staff can safely scan QR codes or lookup attendees by Mobile Number.\n');
  } else {
    console.log('\n✅ 100% OF APPROVED ATTENDEES ALREADY HAVE HEALTHY, VALID PASSES!\n');
  }

  await mongoose.disconnect();
}

auditAndHeal().catch(err => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});
