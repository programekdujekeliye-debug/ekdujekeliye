import crypto from 'crypto';
import { Pass } from '../../models/Pass.js';
import { Registration } from '../../models/Registration.js';
import { Event } from '../../models/Event.js';
import { ScanRecord } from '../../models/ScanRecord.js';
import { qrPassService } from '../passes/qrPass.service.js';
import { eventService } from '../events/event.service.js';

/**
 * 1. Online Scanner Atomic Verification & Attendance Marking
 */
export async function handleOnlineScan(req, res) {
  try {
    const { qrToken, eventId, deviceId, deviceSequence = 1, scannedAtDevice } = req.body;

    if (!qrToken || !eventId || !deviceId) {
      return res.status(400).json({
        result: 'INVALID',
        error: 'Missing required parameters (qrToken, eventId, deviceId).'
      });
    }

    const operatorUserId = req.user?.username || req.user?.role || 'gate_staff';
    const scanId = `SCAN-${crypto.randomBytes(8).toString('hex')}`;
    const scannedAt = scannedAtDevice ? new Date(scannedAtDevice) : new Date();

    // A. Cryptographic Signature Verification
    const verifyResult = qrPassService.verifyPassToken(qrToken);
    if (!verifyResult.valid) {
      await ScanRecord.create({
        scanId,
        eventId,
        deviceId,
        operatorUserId,
        mode: 'ONLINE',
        result: 'INVALID_SIGNATURE',
        deviceSequence,
        scannedAtDevice: scannedAt,
        receivedAtServer: new Date()
      });

      return res.json({
        result: 'INVALID_SIGNATURE',
        message: 'Invalid cryptographic QR signature. Pass may be counterfeit.'
      });
    }

    const payload = verifyResult.payload;

    // B. Wrong Event Check
    if (payload.eventId && payload.eventId !== eventId) {
      await ScanRecord.create({
        scanId,
        eventId,
        passId: payload.passId,
        deviceId,
        operatorUserId,
        mode: 'ONLINE',
        result: 'WRONG_EVENT',
        deviceSequence,
        scannedAtDevice: scannedAt,
        receivedAtServer: new Date()
      });

      return res.json({
        result: 'WRONG_EVENT',
        passId: payload.passId,
        message: 'This pass is for a different seminar batch or venue.',
        passEventId: payload.eventId
      });
    }

    // C. Atomic Attendance Marking (Race-Condition Free)
    const updatedPass = await Pass.findOneAndUpdate(
      {
        passId: payload.passId,
        eventId,
        firstScannedAt: null,
        status: 'ACTIVE'
      },
      {
        $set: {
          firstScannedAt: new Date(),
          lastScannedAt: new Date(),
          'firstScannedBy.deviceId': deviceId,
          'firstScannedBy.operatorUserId': operatorUserId,
          'firstScannedBy.mode': 'ONLINE'
        },
        $inc: { scanCount: 1 }
      },
      { returnDocument: 'after' }
    );

    if (updatedPass) {
      // First valid scan! Update Registration single-source-of-truth
      let coupleName = 'Verified Attendee';
      if (updatedPass.registrationId) {
        const reg = await Registration.findByIdAndUpdate(
          updatedPass.registrationId,
          {
            $set: {
              attendance: 'present',
              attendanceAt: new Date(),
              attendanceMethod: 'QR'
            }
          },
          { returnDocument: 'after' }
        );
        if (reg) {
          coupleName = `${reg.husbandName || ''} & ${reg.wifeName || ''} ${reg.surname || ''}`.trim();
        }
      }

      await ScanRecord.create({
        scanId,
        eventId,
        passId: updatedPass.passId,
        registrationId: updatedPass.registrationId,
        inquiryId: updatedPass.inquiryId,
        deviceId,
        operatorUserId,
        mode: 'ONLINE',
        result: 'ACCEPTED',
        deviceSequence,
        scannedAtDevice: scannedAt,
        receivedAtServer: new Date()
      });

      return res.json({
        result: 'VALID',
        passId: updatedPass.passId,
        inquiryId: updatedPass.inquiryId,
        coupleName,
        firstScannedAt: updatedPass.firstScannedAt,
        scannedByDevice: deviceId,
        scannedByOperator: operatorUserId,
        message: 'Entry Approved.'
      });
    }

    // D. Not updated: Check why (Duplicate, Revoked, or Unknown)
    const currentPass = await Pass.findOne({ passId: payload.passId });
    if (!currentPass) {
      await ScanRecord.create({
        scanId,
        eventId,
        passId: payload.passId,
        deviceId,
        operatorUserId,
        mode: 'ONLINE',
        result: 'UNKNOWN_PASS',
        deviceSequence,
        scannedAtDevice: scannedAt,
        receivedAtServer: new Date()
      });

      return res.json({
        result: 'UNKNOWN_PASS',
        message: 'Pass record not found in system.'
      });
    }

    if (currentPass.status === 'REVOKED') {
      await ScanRecord.create({
        scanId,
        eventId,
        passId: currentPass.passId,
        registrationId: currentPass.registrationId,
        inquiryId: currentPass.inquiryId,
        deviceId,
        operatorUserId,
        mode: 'ONLINE',
        result: 'REVOKED',
        deviceSequence,
        scannedAtDevice: scannedAt,
        receivedAtServer: new Date()
      });

      return res.json({
        result: 'REVOKED',
        passId: currentPass.passId,
        inquiryId: currentPass.inquiryId,
        message: 'This pass has been cancelled or revoked.'
      });
    }

    // Already scanned (Duplicate)
    await Pass.updateOne(
      { _id: currentPass._id },
      {
        $set: { lastScannedAt: new Date() },
        $inc: { scanCount: 1 }
      }
    );

    await ScanRecord.create({
      scanId,
      eventId,
      passId: currentPass.passId,
      registrationId: currentPass.registrationId,
      inquiryId: currentPass.inquiryId,
      deviceId,
      operatorUserId,
      mode: 'ONLINE',
      result: 'DUPLICATE',
      deviceSequence,
      scannedAtDevice: scannedAt,
      receivedAtServer: new Date()
    });

    let coupleName = 'Registered Couple';
    const reg = await Registration.findById(currentPass.registrationId);
    if (reg) {
      coupleName = `${reg.husbandName || ''} & ${reg.wifeName || ''} ${reg.surname || ''}`.trim();
    }

    return res.json({
      result: 'ALREADY_SCANNED',
      passId: currentPass.passId,
      inquiryId: currentPass.inquiryId,
      coupleName,
      firstScannedAt: currentPass.firstScannedAt,
      scannedByDevice: currentPass.firstScannedBy?.deviceId || 'Gate Scanner',
      scannedByOperator: currentPass.firstScannedBy?.operatorUserId || 'Gate Staff',
      scanCount: currentPass.scanCount + 1,
      message: 'Already scanned. Duplicate entry attempt.'
    });
  } catch (err) {
    console.error('[Scanner Controller] Online scan error:', err);
    return res.status(500).json({ error: 'Server error during scan processing.' });
  }
}

/**
 * 2. Prepare Event Bundle for Offline PWA Scanner
 */
export async function prepareOfflineEvent(req, res) {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ error: 'Event ID is required.' });
    }

    const event = await eventService.getEventBySlug(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const pubKey = qrPassService.getPublicKeyInfo();

    // Fetch compact revocation list for this event (passIds that are revoked)
    const revokedPasses = await Pass.find({ eventId, status: 'REVOKED' }).select('passId version').lean();

    return res.json({
      success: true,
      eventId: event.id,
      eventName: event.name,
      eventDate: event.date,
      eventTime: event.time || '8:30 PM',
      venue: event.venue || '',
      publicKey: pubKey,
      revokedPassIds: revokedPasses.map(p => p.passId),
      cachedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Scanner Controller] Prepare offline error:', err);
    return res.status(500).json({ error: 'Failed to prepare offline event cache.' });
  }
}

/**
 * 3. Batch Offline Sync Endpoint (Multi-Device Deterministic Conflict Resolution)
 */
export async function handleOfflineSync(req, res) {
  try {
    const { deviceId, eventId, scans = [] } = req.body;

    if (!deviceId || !eventId || !Array.isArray(scans)) {
      return res.status(400).json({ error: 'Invalid sync payload (deviceId, eventId, scans[] required).' });
    }

    const operatorUserId = req.user?.username || req.user?.role || 'gate_staff';
    const results = [];

    // Process scans in chronological device order
    const sortedScans = [...scans].sort((a, b) => {
      const timeA = new Date(a.scannedAtDevice || 0).getTime();
      const timeB = new Date(b.scannedAtDevice || 0).getTime();
      return timeA - timeB;
    });

    for (const scan of sortedScans) {
      const { scanLocalId, qrToken, passId: clientPassId, scannedAtDevice, deviceSequence } = scan;
      const scannedAt = scannedAtDevice ? new Date(scannedAtDevice) : new Date();

      // Idempotency check: Has this specific local scan already been synchronized?
      const existingScan = await ScanRecord.findOne({ deviceId, scanLocalId });
      if (existingScan) {
        results.push({
          scanLocalId,
          result: existingScan.result,
          status: 'ALREADY_SYNCED',
          passId: existingScan.passId
        });
        continue;
      }

      // Verify QR signature independently on server
      const verifyResult = qrPassService.verifyPassToken(qrToken);
      if (!verifyResult.valid) {
        await ScanRecord.create({
          scanId: `SCAN-OFF-${crypto.randomBytes(8).toString('hex')}`,
          eventId,
          deviceId,
          operatorUserId,
          mode: 'OFFLINE_SYNC',
          result: 'INVALID_SIGNATURE',
          scanLocalId,
          deviceSequence: deviceSequence || 1,
          scannedAtDevice: scannedAt,
          receivedAtServer: new Date()
        });

        results.push({ scanLocalId, result: 'INVALID_SIGNATURE', status: 'PROCESSED' });
        continue;
      }

      const payload = verifyResult.payload;

      if (payload.eventId && payload.eventId !== eventId) {
        await ScanRecord.create({
          scanId: `SCAN-OFF-${crypto.randomBytes(8).toString('hex')}`,
          eventId,
          passId: payload.passId,
          deviceId,
          operatorUserId,
          mode: 'OFFLINE_SYNC',
          result: 'WRONG_EVENT',
          scanLocalId,
          deviceSequence: deviceSequence || 1,
          scannedAtDevice: scannedAt,
          receivedAtServer: new Date()
        });

        results.push({ scanLocalId, result: 'WRONG_EVENT', status: 'PROCESSED' });
        continue;
      }

      // Atomic attendance claim
      const updatedPass = await Pass.findOneAndUpdate(
        {
          passId: payload.passId,
          eventId,
          firstScannedAt: null,
          status: 'ACTIVE'
        },
        {
          $set: {
            firstScannedAt: scannedAt,
            lastScannedAt: new Date(),
            'firstScannedBy.deviceId': deviceId,
            'firstScannedBy.operatorUserId': operatorUserId,
            'firstScannedBy.mode': 'OFFLINE_SYNC'
          },
          $inc: { scanCount: 1 }
        },
        { returnDocument: 'after' }
      );

      if (updatedPass) {
        // First valid scan synchronized!
        if (updatedPass.registrationId) {
          await Registration.findByIdAndUpdate(updatedPass.registrationId, {
            $set: {
              attendance: 'present',
              attendanceAt: scannedAt,
              attendanceMethod: 'QR_OFFLINE'
            }
          });
        }

        await ScanRecord.create({
          scanId: `SCAN-OFF-${crypto.randomBytes(8).toString('hex')}`,
          eventId,
          passId: updatedPass.passId,
          registrationId: updatedPass.registrationId,
          inquiryId: updatedPass.inquiryId,
          deviceId,
          operatorUserId,
          mode: 'OFFLINE_SYNC',
          result: 'ACCEPTED',
          scanLocalId,
          deviceSequence: deviceSequence || 1,
          scannedAtDevice: scannedAt,
          receivedAtServer: new Date()
        });

        results.push({
          scanLocalId,
          result: 'ACCEPTED',
          passId: updatedPass.passId,
          inquiryId: updatedPass.inquiryId,
          status: 'PROCESSED'
        });
      } else {
        // Already scanned online or by another phone previously -> OFFLINE_DUPLICATE_CONFLICT
        const currentPass = await Pass.findOne({ passId: payload.passId });

        await ScanRecord.create({
          scanId: `SCAN-OFF-${crypto.randomBytes(8).toString('hex')}`,
          eventId,
          passId: payload.passId,
          registrationId: currentPass?.registrationId,
          inquiryId: currentPass?.inquiryId,
          deviceId,
          operatorUserId,
          mode: 'OFFLINE_SYNC',
          result: 'CONFLICT',
          scanLocalId,
          deviceSequence: deviceSequence || 1,
          scannedAtDevice: scannedAt,
          receivedAtServer: new Date()
        });

        results.push({
          scanLocalId,
          result: 'CONFLICT',
          passId: payload.passId,
          inquiryId: currentPass?.inquiryId,
          firstScannedAt: currentPass?.firstScannedAt,
          status: 'PROCESSED'
        });
      }
    }

    return res.json({
      success: true,
      processedCount: results.length,
      results
    });
  } catch (err) {
    console.error('[Scanner Controller] Offline sync error:', err);
    return res.status(500).json({ error: 'Server error processing offline sync.' });
  }
}

/**
 * 4. Manual Fallback Attendance by Pass ID / Inquiry ID
 */
export async function handleManualAttendance(req, res) {
  try {
    const { identifier, eventId, deviceId } = req.body;
    if (!identifier || !eventId) {
      return res.status(400).json({ error: 'Identifier (Pass ID or Inquiry ID) and eventId are required.' });
    }

    const clean = identifier.trim();
    const pass = await Pass.findOne({
      eventId,
      $or: [
        { passId: clean.toUpperCase() },
        { inquiryId: { $regex: new RegExp(`^${clean}$`, 'i') } }
      ]
    });

    if (!pass) {
      return res.status(404).json({ result: 'NOT_FOUND', message: 'No pass found matching identifier.' });
    }

    if (pass.firstScannedAt) {
      return res.json({
        result: 'ALREADY_SCANNED',
        passId: pass.passId,
        inquiryId: pass.inquiryId,
        firstScannedAt: pass.firstScannedAt,
        message: 'Pass was already marked present.'
      });
    }

    pass.firstScannedAt = new Date();
    pass.lastScannedAt = new Date();
    pass.firstScannedBy = {
      deviceId: deviceId || 'MANUAL',
      operatorUserId: req.user?.username || 'admin',
      mode: 'ONLINE'
    };
    pass.scanCount = 1;
    await pass.save();

    if (pass.registrationId) {
      await Registration.findByIdAndUpdate(pass.registrationId, {
        $set: {
          attendance: 'present',
          attendanceAt: new Date(),
          attendanceMethod: 'MANUAL_ENTRY'
        }
      });
    }

    return res.json({
      result: 'VALID',
      passId: pass.passId,
      inquiryId: pass.inquiryId,
      message: 'Manual entry marked present.'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error during manual attendance marking.' });
  }
}

/**
 * 5. Live Gate Dashboard Statistics
 */
export async function getScannerStats(req, res) {
  try {
    const { eventId } = req.query;
    if (!eventId) {
      return res.status(400).json({ error: 'eventId query parameter is required.' });
    }

    const [totalConfirmed, presentCount, duplicateScans, conflictScans, activeDevices] = await Promise.all([
      Registration.countDocuments({
        programId: eventId,
        isDeleted: { $ne: true },
        $or: [{ status: 'approved' }, { 'payment.status': 'captured' }]
      }),
      Registration.countDocuments({
        programId: eventId,
        isDeleted: { $ne: true },
        attendance: 'present'
      }),
      ScanRecord.countDocuments({ eventId, result: 'DUPLICATE' }),
      ScanRecord.countDocuments({ eventId, result: 'CONFLICT' }),
      ScanRecord.distinct('deviceId', { eventId })
    ]);

    const remaining = Math.max(0, totalConfirmed - presentCount);

    return res.json({
      eventId,
      totalConfirmed,
      presentCount,
      remaining,
      duplicateScans,
      conflictScans,
      activeDeviceCount: activeDevices.length,
      refreshedAt: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch scanner stats.' });
  }
}
