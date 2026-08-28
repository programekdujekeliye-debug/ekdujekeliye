import mongoose from 'mongoose';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { mediaService } from '../src/modules/media/media.service.js';
import { env } from '../src/config/env.js';

async function testViewer() {
  await mongoose.connect(env.MONGO_URI);

  const testUser = { role: 'SUPER_ADMIN', assignedEventIds: [] };
  const verifiedList = await MediaArchive.find({ status: 'VERIFIED', driveFileId: { $ne: null } }).lean();

  console.log(`Testing Google Drive View Token generation for ${verifiedList.length} verified items:`);
  for (const item of verifiedList) {
    if (item.driveFileId.startsWith('1AbCdEfGh')) continue; // skip mock
    try {
      const token = await mediaService.generateMediaViewToken(item.registrationId, testUser);
      console.log(`- [${item.registrationId}] FileId: ${item.driveFileId}`);
      console.log(`  Viewer URL: ${token.viewerUrl}`);
      // Test fetching the viewer URL
      if (token.viewerUrl.startsWith('http')) {
        const res = await fetch(token.viewerUrl, { method: 'GET' });
        console.log(`  Viewer HTTP status: ${res.status}`);
      }
    } catch (err) {
      console.log(`- [${item.registrationId}] Error:`, err.message);
    }
  }

  await mongoose.disconnect();
}

testViewer();
