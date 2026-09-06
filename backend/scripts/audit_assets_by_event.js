/**
 * Detailed audit of Cloudinary assets partitioned by Event
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { MediaArchive } from '../src/models/MediaArchive.js';

function isCloudinary(url) {
  return url && typeof url === 'string' && (url.includes('res.cloudinary.com') || url.includes('cloudinary.com'));
}

async function run() {
  const targetUri = process.env.PROD_MONGO_URI || env.PROD_MONGO_URI || process.env.MONGO_URI;
  await mongoose.connect(targetUri);
  console.log(`Connected to: ${mongoose.connection.db.databaseName}`);

  const events = await Event.find({}).sort({ sequenceNumber: 1 }).lean();
  const regs = await Registration.find({}).select('inquiryId programId couplePhoto paymentScreenshot invitationCardUrl').lean();
  const archives = await MediaArchive.find({}).lean();

  const eventMap = new Map();
  for (const ev of events) {
    eventMap.set(ev.id, {
      id: ev.id,
      seq: ev.sequenceNumber,
      name: ev.name,
      date: ev.date,
      status: ev.status,
      regs: 0,
      couplePhotos: 0,
      invitations: 0,
      payments: 0,
      totalAssets: 0,
      archivedVerified: 0,
      cldDeleted: 0
    });
  }

  // Unlinked
  eventMap.set('UNLINKED', {
    id: 'UNLINKED',
    seq: -1,
    name: 'Unlinked / Orphan Registrations',
    date: 'N/A',
    status: 'orphan',
    regs: 0,
    couplePhotos: 0,
    invitations: 0,
    payments: 0,
    totalAssets: 0,
    archivedVerified: 0,
    cldDeleted: 0
  });

  for (const r of regs) {
    const ev = eventMap.get(r.programId) || eventMap.get('UNLINKED');
    ev.regs++;
    if (isCloudinary(r.couplePhoto)) {
      ev.couplePhotos++;
      ev.totalAssets++;
    }
    if (isCloudinary(r.invitationCardUrl)) {
      ev.invitations++;
      ev.totalAssets++;
    }
    if (isCloudinary(r.paymentScreenshot)) {
      ev.payments++;
      ev.totalAssets++;
    }
  }

  for (const a of archives) {
    const ev = eventMap.get(a.eventId);
    if (ev) {
      if (a.status === 'VERIFIED') ev.archivedVerified++;
      if (a.cloudinaryOriginalStatus === 'DELETED') ev.cldDeleted++;
    }
  }

  console.log('\n========================================================================================================');
  console.log('EVENT ASSET PARTITION IN PRODUCTION DB');
  console.log('========================================================================================================');
  console.table(Array.from(eventMap.values()).map(e => ({
    'ID': e.id,
    'Seq': e.seq,
    'Date': e.date,
    'Status': e.status,
    'Regs': e.regs,
    'Couple': e.couplePhotos,
    'Invites': e.invitations,
    'Payments': e.payments,
    'Total Cld': e.totalAssets,
    'Verified Archive': e.archivedVerified,
    'Cld Deleted': e.cldDeleted
  })));

  await mongoose.disconnect();
}

run().catch(console.error);
