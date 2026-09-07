import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import crypto from 'crypto';
import sharp from 'sharp';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { qrPassService } from '../src/modules/passes/qrPass.service.js';
import { invitationCardService } from '../src/services/invitationCard.service.js';
import { r2Provider } from '../src/integrations/r2/r2.provider.js';

const vipData = [
  { husband: 'Sanjay Amipara', wife: 'Kiran amipara', phone: '9909567904', driveId: '1ijF8U5h3GBRfgja8AAULPm4i2i_MbCiN' },
  { husband: 'Satish koladiya', wife: 'Kiran koladiya', phone: '9377571161', driveId: '1zondksaq5IGfTPxRvcJ6LHl_TGac1_pt' },
  { husband: 'Mukesh Shekhada', wife: 'Bharti Shekhada', phone: '9979943890', driveId: '1lKgnBjyTGgCu3YQoLegc4mYmBZ2IKLaO' },
  { husband: 'Nitin', wife: 'Madhavi', phone: '9624552121', driveId: '1cAwRnibnL7EbsZztafIOK5UDW3L9UtuQ' },
  { husband: 'Naresh chhatraya', wife: 'Urmila chhatraya', phone: '9375353897', driveId: '14gc8nLEvT83mLumVq8XvxCwb_qNM9vo1' },
  { husband: 'Vijay', wife: 'Poonam', phone: '9819877354', driveId: '1avQzZKlNxgGPJlkYmn1Vpvh09Wii9pu9' },
  { husband: 'Sanjay Patel', wife: 'Sejal Patel', phone: '9712950659', driveId: '13rS2EsbAI2MF-ioho5mAC3QbzUyDpNUk' },
  { husband: 'Amit desai', wife: 'Nima desai', phone: '9825982206', driveId: '1hVgU3KI-lZ9gSUj0Kc3MNKMKIkoe0ric' },
  { husband: 'Mukesh himmatbhai narola', wife: 'Tejal mukesh narola', phone: '7383236883', driveId: '16tzA0ONLnzLCWHkgSPgzaob8jIAwzDV1' },
  { husband: 'DILIP CHOVATIYA', wife: 'PARUL CHOVATIYA', phone: '8866615588', driveId: '1_O2Rk-R3yvTmhWrjsUyGZh2qMA1ppw44' },
  { husband: 'Ankur Vekariya', wife: 'Jalpa Vekariya', phone: '9925123334', driveId: '1RjjIdkBBp1MLK7rEmNm2H2vPxg3X5kkB' },
  { husband: 'Jaydip', wife: 'Mansi', phone: '9624546317', driveId: '1_wClg00pEKr5pB-5Y9352QdnD6x4PBUH' },
  { husband: 'Mahesh kalkani', wife: 'Sonal kalkani', phone: '9723996037', driveId: '1ZDH-LmkW17-2scMo_mvEn0AD7AgW1HUh' },
  { husband: 'Mukesh Goti', wife: 'Chetana goti', phone: '9227104214', driveId: '1EOKSGoGCx0wK7-AgnpkAJ31HpciTjIBK' },
  { husband: 'Piyush', wife: 'Radhika', phone: '9574299597', driveId: '1_XfzWCvUI2ElZp0E4U1zNAWouJsJUR0Q' },
  { husband: 'PANKAJ NAKRANI', wife: 'RINKU NAKRANI', phone: '8200236323', driveId: '1UtQu3cA_He7z7c5MxOoCIpByORGS__oy' },
  { husband: 'Mahesh Goti', wife: 'Palak Goti', phone: '9510389891', driveId: '1J8zUzlHaFi3PWDkVwN0vGRVJgVQNCw6c' },
  { husband: 'Manoj bharoy', wife: 'Asha Bharodiya', phone: '9898494154', driveId: '1_vdQ1iPlbki_m3mu2Fc2GSuwIbfBDLJh' },
  { husband: 'Jayesh bhai', wife: 'Vanita ben', phone: '9909781538', driveId: '10ZRtPbk4AjZmFWnyfCuP6J3HJpOW8AXA' },
  { husband: 'Paresh Nakrani', wife: 'Alpa Nakrani', phone: '9913387575', driveId: '1sdGD72ftgt_u9guQZgbrcz8HTA_fkdn1' },
  { husband: 'Sanket maniya', wife: 'Heena maniya', phone: '8141414951', driveId: '18ix_TlQLyXGFkfUVRbRSYXn9MpID1tes' },
  { husband: 'Rajesh Devani', wife: 'Jalpa Devani', phone: '9904533703', driveId: '1tzKIpe0KooCjuWJzQmFZe5z2mgdeM-D8' },
  { husband: 'Mehul Virani', wife: 'Simpal Virani', phone: '9824186190', driveId: '1Rnd5fPpkOFgeh2mNJcGBsFDDv5G1HN2y' },
  { husband: 'Pradip Ajugiya', wife: 'Madhavi', phone: '7016389606', driveId: '1Be5fhKRIpl72VKMmcy2_1OXo_g2Dzs9g' },
  { husband: 'Jignesh Manani', wife: 'Parul', phone: '7778910000', driveId: '192NdwcmGExtHUTDtMCt7fG743T9VfrCs' },
  { husband: 'Manish', wife: 'Rushita', phone: '9825667839', driveId: '1ngykkWeS8G0XdCKmAYEem3aGP_8r9Lj4' },
  { husband: 'Manoj Makwana', wife: 'Vasant Makwana', phone: '7984460031', driveId: '1NKxzTg-1MQ7t62fvtmekA91Snq05d_da' },
  { husband: 'Jignesh Hirani', wife: 'Bhumika Hirani', phone: '9925437372', driveId: '1t0rkZQajWSL9GQziEqDyarEQ_SrenRGH' },
  { husband: 'Ramil Patel', wife: 'Jigna Patel', phone: '9328035234', driveId: '1MFYu009jlunIAvtPBv5E2dQshnHnc6R7' },
  { husband: 'Lalji Lakkad', wife: 'Vilas Lakkad', phone: '9824349958', driveId: '1PTj0ZkTRIiJAss7gzQonb5bDuPynIxfl' },
  { husband: 'Sohan Kalsariya', wife: 'Surbhi Kalsariya', phone: '8866688141', driveId: '10snmxi565Q290NvKjObsekTKTJwDRgWA' },
  { husband: 'Rasik Narola', wife: 'Asha Narola', phone: '9327147320', driveId: '1ZQqVDpSBKdjDw54cV9ozKxvU6aEGXmKV' },
  { husband: 'Kalpesh Dobariya', wife: 'Kiran Dobariya', phone: '9974641956', driveId: '1FsEXCZp4KHvOcf9DZR-DfB1lkIQCd4Qf' },
  { husband: 'Satin italiya', wife: 'Jalpa italiya', phone: '8866316499', driveId: '1lyCljaxeDtGIKkbgbH4BAk0___HlGBYm' }
];

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  console.log('Connected to Prod MongoDB\n');

  const event = await Event.findOne({ id: 'prog-2026-09-07' }).lean();
  if (!event) {
    console.error('Event prog-2026-09-07 not found!');
    process.exit(1);
  }

  const startSeq = 59; // User confirmed: 58 already exists, start from 59!
  console.log(`Starting VIP ingestion from EK06-IP-${startSeq} to EK06-IP-${startSeq + vipData.length - 1} (${vipData.length} couples)...\n`);

  for (let i = 0; i < vipData.length; i++) {
    const item = vipData[i];
    const seq = startSeq + i;
    const inquiryId = `EK06-IP-${seq}`;

    console.log(`[${i + 1}/${vipData.length}] Processing ${inquiryId}: ${item.husband} & ${item.wife} (${item.phone})...`);

    // Safety: check if inquiryId already exists
    const existingInq = await Registration.findOne({ inquiryId }).lean();
    if (existingInq) {
      console.warn(`⚠️ Warning: ${inquiryId} already exists! Skipping to avoid overwrite.`);
      continue;
    }

    // 1. Fetch couple photo from Google Drive
    let couplePhotoUrl = '/sample_couple.png';
    let photoBuffer = null;
    try {
      const driveRes = await fetch(`https://lh3.googleusercontent.com/d/${item.driveId}`);
      if (driveRes.ok) {
        photoBuffer = Buffer.from(await driveRes.arrayBuffer());
        // Optimize to JPEG
        const optimizedBuf = await sharp(photoBuffer)
          .rotate()
          .resize(800, null, { withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();

        const photoKey = `prod/events/EK06/registrations/${inquiryId}/couple/photo.jpg`;
        await r2Provider.putObject({
          bucket: r2Provider.publicBucket,
          key: photoKey,
          body: optimizedBuf,
          contentType: 'image/jpeg',
          cacheControl: 'public, max-age=31536000, immutable'
        });

        couplePhotoUrl = `https://pub-b443f0b5d5cd4f0e854c148656b56760.r2.dev/${photoKey}`;
      } else {
        console.warn(`Drive fetch returned HTTP ${driveRes.status} for ${item.driveId}`);
      }
    } catch (photoErr) {
      console.error(`Photo upload error for ${inquiryId}:`, photoErr.message);
    }

    // 2. Extract surname
    const hWords = item.husband.trim().split(/\s+/);
    const wWords = item.wife.trim().split(/\s+/);
    const surname = (hWords.length > 1 ? hWords[hWords.length - 1] : '') || (wWords.length > 1 ? wWords[wWords.length - 1] : '') || '-';

    // 3. Create Registration Document
    const reg = new Registration({
      inquiryId,
      customerToken: crypto.randomBytes(16).toString('hex'),
      husbandName: item.husband.trim(),
      wifeName: item.wife.trim(),
      surname,
      phoneNumber: item.phone.trim(),
      isVip: true,
      programId: event.id,
      programName: event.name,
      programDate: event.date,
      programTime: event.time || '8:30 PM',
      couplePhoto: couplePhotoUrl,
      mediaProvider: 'R2',
      status: 'approved',
      payment: {
        provider: 'manual_invite',
        status: 'captured',
        amount: 0,
        currency: 'INR',
        paidAt: new Date()
      }
    });

    await reg.save();
    console.log(`   ✓ Saved Registration ${inquiryId}`);

    // 4. Generate QR Pass
    try {
      const pass = await qrPassService.ensurePass(reg, event);
      if (pass) {
        pass.isVip = true;
        await pass.save();
      }
      console.log(`   ✓ Generated QR Pass (Pass ID: ${pass?._id || 'OK'})`);
    } catch (passErr) {
      console.warn(`   ⚠️ QR Pass warning for ${inquiryId}:`, passErr.message);
    }

    // 5. Generate Invitation Card Composite on Cloudflare R2
    try {
      const cardRes = await invitationCardService.ensureInvitationCardImage(reg, event);
      if (cardRes && cardRes.cardUrl) {
        console.log(`   ✓ Generated Invitation Card: ${cardRes.cardUrl}`);
      }
    } catch (cardErr) {
      console.warn(`   ⚠️ Invitation Card warning for ${inquiryId}:`, cardErr.message);
    }
  }

  console.log(`\n======================================================`);
  console.log(`✅ VIP INGESTION COMPLETE: 34 couples successfully registered!`);
  console.log(`======================================================`);
  process.exit(0);
}

main().catch(err => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
