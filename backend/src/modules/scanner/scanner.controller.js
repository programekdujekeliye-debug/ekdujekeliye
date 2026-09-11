import crypto from 'crypto';
import { Pass } from '../../models/Pass.js';
import { Registration } from '../../models/Registration.js';
import { Event } from '../../models/Event.js';
import { ScanRecord } from '../../models/ScanRecord.js';
import { qrPassService } from '../passes/qrPass.service.js';
import { eventService } from '../events/event.service.js';
import { mediaService } from '../media/media.service.js';
import { invalidateDashboardCache } from '../admin/admin.controller.js';

function resolveScannerCouplePhoto(reg) {
  if (!reg) return null;
  try {
    const mediaState = mediaService.resolveRegistrationMediaSync(reg);
    return mediaState?.couplePhoto || reg.couplePhoto || null;
  } catch (_) {
    return reg.couplePhoto || null;
  }
}

// In-Memory Real-Time Attendance Stats Cache (5s TTL)
const liveAttendanceStatsCache = new Map();
const STATS_CACHE_TTL_MS = 5 * 1000;

export function invalidateLiveAttendanceStatsCache(eventId) {
  if (eventId) {
    liveAttendanceStatsCache.delete(eventId);
  } else {
    liveAttendanceStatsCache.clear();
  }
  try {
    invalidateDashboardCache();
  } catch (_) {}
}

/**
 * Helper: Aggregate real-time gate attendance stats for an event (< 5ms cached)
 */
export async function getEventLiveAttendanceStats(eventId) {
  const now = Date.now();
  const cached = liveAttendanceStatsCache.get(eventId);
  if (cached && now < cached.expiry) {
    return cached.data;
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
    ScanRecord.distinct('deviceId', {
      eventId,
      receivedAtServer: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
    })
  ]);

  const remaining = Math.max(0, totalConfirmed - presentCount);

  const stats = {
    eventId,
    totalConfirmed,
    presentCount,
    remaining,
    duplicateScans,
    conflictScans,
    activeDeviceCount: Math.max(1, activeDevices.length),
    refreshedAt: new Date().toISOString()
  };

  liveAttendanceStatsCache.set(eventId, {
    data: stats,
    expiry: now + STATS_CACHE_TTL_MS
  });

  return stats;
}

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

    const cleanToken = String(qrToken).trim();
    const operatorUserId = req.user?.username || req.user?.role || 'gate_staff';
    const scanId = `SCAN-${crypto.randomBytes(8).toString('hex')}`;
    const scannedAt = scannedAtDevice ? new Date(scannedAtDevice) : new Date();

    // 1. Resolve Canonical Event & All Valid Alias Identifiers (id, slug, date, _id)
    const isObjectId = typeof eventId === 'string' && /^[0-9a-fA-F]{24}$/.test(eventId);
    const activeEvent = await Event.findOne({
      $or: [
        { id: eventId },
        { slug: eventId },
        { date: eventId },
        ...(isObjectId ? [{ _id: eventId }] : [])
      ]
    }).lean();

    const canonicalEventId = activeEvent?.id || eventId;
    const validEventIds = Array.from(new Set([
      eventId,
      canonicalEventId,
      activeEvent?.slug,
      activeEvent?.date
    ].filter(Boolean)));

    // A. Cryptographic Signature Verification & Resilient Multi-Format Fallback
    let verifyResult = qrPassService.verifyPassToken(cleanToken);

    // Resilient Fallback: If cryptographic signature didn't verify (e.g. key rotated after deploy,
    // pass URL scanned from screen, raw inquiryId, or older pass format)
    if (!verifyResult.valid) {
      let candidatePass = null;

      // Fallback 1: Direct match in Pass collection by qrToken
      candidatePass = await Pass.findOne({ qrToken: cleanToken });

      // Fallback 2: If token contains dot (base64url payload.signature), extract passId from payload
      if (!candidatePass && cleanToken.includes('.')) {
        try {
          const rawPayload = JSON.parse(Buffer.from(cleanToken.split('.')[0], 'base64url').toString('utf8'));
          if (rawPayload?.passId) {
            candidatePass = await Pass.findOne({ passId: rawPayload.passId });
          }
        } catch (_) {}
      }

      // Fallback 3: If token is a pass URL (e.g. https://.../pass/EDKL-...) or raw inquiryId / passId
      if (!candidatePass) {
        let extractedId = cleanToken;
        const passUrlMatch = cleanToken.match(/\/pass\/([A-Za-z0-9_-]+)/i);
        if (passUrlMatch) {
          extractedId = passUrlMatch[1];
        }
        candidatePass = await Pass.findOne({
          $or: [
            { passId: extractedId.toUpperCase() },
            { inquiryId: { $regex: new RegExp(`^${extractedId.trim()}$`, 'i') } }
          ]
        });

        // Fallback 4: If not yet issued in Pass, check if Registration exists and auto-issue
        if (!candidatePass) {
          const matchedReg = await Registration.findOne({
            inquiryId: { $regex: new RegExp(`^${extractedId.trim()}$`, 'i') },
            isDeleted: { $ne: true }
          });
          if (matchedReg && (matchedReg.status === 'approved' || matchedReg.payment?.status === 'captured')) {
            candidatePass = await qrPassService.ensurePass(matchedReg, activeEvent || { id: canonicalEventId });
          }
        }
      }

      if (candidatePass) {
        verifyResult = {
          valid: true,
          payload: {
            v: candidatePass.version || 1,
            eventId: candidatePass.eventId,
            passId: candidatePass.passId,
            version: candidatePass.version || 1,
            issuedAt: candidatePass.issuedAt ? Math.floor(candidatePass.issuedAt.getTime() / 1000) : 0,
            keyId: candidatePass.keyId
          }
        };
      }
    }

    if (!verifyResult.valid) {
      await ScanRecord.create({
        scanId,
        eventId: canonicalEventId,
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
        message: 'Invalid cryptographic QR signature or unrecognized pass format.'
      });
    }

    const payload = verifyResult.payload;

    // B. Wrong Event / Old Seminar Check
    const isMatchingCurrentEvent = !payload.eventId || validEventIds.includes(payload.eventId);
    if (!isMatchingCurrentEvent) {
      // Look up previous/other seminar details to give clear, respectful guidance
      const otherEvent = await Event.findOne({
        $or: [
          { id: payload.eventId },
          { slug: payload.eventId },
          { date: payload.eventId },
          ...(typeof payload.eventId === 'string' && /^[0-9a-fA-F]{24}$/.test(payload.eventId) ? [{ _id: payload.eventId }] : [])
        ]
      }).lean();

      let otherCoupleName = 'Registered Couple';
      let otherCouplePhoto = null;
      let otherIsVip = false;
      let otherPhone = '';
      const otherPass = await Pass.findOne({ passId: payload.passId }).lean();
      if (otherPass?.registrationId) {
        const otherReg = await Registration.findById(otherPass.registrationId).lean();
        if (otherReg) {
          otherCoupleName = `${otherReg.husbandName || ''} & ${otherReg.wifeName || ''} ${otherReg.surname || ''}`.trim();
          otherCouplePhoto = resolveScannerCouplePhoto(otherReg);
          otherIsVip = Boolean(otherReg.isVip);
          otherPhone = otherReg.phoneNumber || '';
        }
      }

      await ScanRecord.create({
        scanId,
        eventId: canonicalEventId,
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
        inquiryId: otherPass?.inquiryId,
        coupleName: otherCoupleName,
        couplePhoto: otherCouplePhoto,
        isVip: otherIsVip,
        phoneNumber: otherPhone,
        registeredForEvent: otherEvent?.name || payload.eventId,
        registeredForDate: otherEvent?.date || '',
        passEventId: payload.eventId,
        message: otherEvent
          ? `This pass was registered for an earlier seminar: "${otherEvent.name}" (${otherEvent.date}). It cannot be used for tonight's seminar.`
          : `This pass is registered for another seminar session (${payload.eventId}), not tonight's batch.`
      });
    }

    // C. Atomic Attendance Marking (Race-Condition Free, Supporting All Event Aliases)
    const updatedPass = await Pass.findOneAndUpdate(
      {
        passId: payload.passId,
        eventId: { $in: validEventIds },
        firstScannedAt: null,
        status: 'ACTIVE'
      },
      {
        $set: {
          firstScannedAt: new Date(),
          lastScannedAt: new Date(),
          firstScannedBy: {
            deviceId,
            operatorUserId,
            mode: 'ONLINE'
          },
          eventId: canonicalEventId // Consolidate to canonical event ID
        },
        $inc: { scanCount: 1 }
      },
      { returnDocument: 'after' }
    );

    if (updatedPass) {
      // First valid scan! Update Registration single-source-of-truth
      let coupleName = 'Verified Attendee';
      let reg = null;
      if (updatedPass.registrationId) {
        reg = await Registration.findByIdAndUpdate(
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

      const couplePhoto = resolveScannerCouplePhoto(reg);

      await ScanRecord.create({
        scanId,
        eventId: canonicalEventId,
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

      invalidateLiveAttendanceStatsCache(canonicalEventId);
      const liveStats = await getEventLiveAttendanceStats(canonicalEventId);

      return res.json({
        result: 'VALID',
        passId: updatedPass.passId,
        inquiryId: updatedPass.inquiryId,
        coupleName,
        couplePhoto,
        isVip: Boolean(reg?.isVip),
        phoneNumber: reg?.phoneNumber || '',
        firstScannedAt: updatedPass.firstScannedAt,
        scannedByDevice: deviceId,
        scannedByOperator: operatorUserId,
        message: 'Entry Approved.',
        liveStats
      });
    }

    // D. Not updated: Check why (Duplicate, Revoked, Unscanned Event Alias Mismatch, or Same-Device Echo)
    const currentPass = await Pass.findOne({ passId: payload.passId });
    if (!currentPass) {
      await ScanRecord.create({
        scanId,
        eventId: canonicalEventId,
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

    if (currentPass.status === 'REVOKED' || currentPass.status === 'CANCELLED') {
      await ScanRecord.create({
        scanId,
        eventId: canonicalEventId,
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

    // CRITICAL FIX FOR FIRST-TIME SCANS:
    // If firstScannedAt is null, the pass was NEVER SCANNED!
    if (!currentPass.firstScannedAt) {
      currentPass.firstScannedAt = new Date();
      currentPass.lastScannedAt = new Date();
      currentPass.firstScannedBy = {
        deviceId,
        operatorUserId,
        mode: 'ONLINE'
      };
      currentPass.scanCount = 1;
      currentPass.status = 'ACTIVE';
      currentPass.eventId = canonicalEventId;
      await currentPass.save();

      let coupleName = 'Verified Attendee';
      let reg = null;
      if (currentPass.registrationId) {
        reg = await Registration.findByIdAndUpdate(
          currentPass.registrationId,
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

      const couplePhoto = resolveScannerCouplePhoto(reg);

      await ScanRecord.create({
        scanId,
        eventId: canonicalEventId,
        passId: currentPass.passId,
        registrationId: currentPass.registrationId,
        inquiryId: currentPass.inquiryId,
        deviceId,
        operatorUserId,
        mode: 'ONLINE',
        result: 'ACCEPTED',
        deviceSequence,
        scannedAtDevice: scannedAt,
        receivedAtServer: new Date()
      });

      invalidateLiveAttendanceStatsCache(canonicalEventId);
      const liveStats = await getEventLiveAttendanceStats(canonicalEventId);

      return res.json({
        result: 'VALID',
        passId: currentPass.passId,
        inquiryId: currentPass.inquiryId,
        coupleName,
        couplePhoto,
        isVip: Boolean(reg?.isVip),
        phoneNumber: reg?.phoneNumber || '',
        firstScannedAt: currentPass.firstScannedAt,
        scannedByDevice: deviceId,
        scannedByOperator: operatorUserId,
        message: 'Entry Approved.',
        liveStats
      });
    }

    // RESOLVE ATTENDEE DETAILS
    let coupleName = 'Registered Couple';
    let couplePhoto = null;
    let isVip = false;
    let phoneNumber = '';
    const reg = await Registration.findById(currentPass.registrationId);
    if (reg) {
      coupleName = `${reg.husbandName || ''} & ${reg.wifeName || ''} ${reg.surname || ''}`.trim();
      couplePhoto = resolveScannerCouplePhoto(reg);
      isVip = Boolean(reg.isVip);
      phoneNumber = reg.phoneNumber || '';
    }

    const liveStats = await getEventLiveAttendanceStats(canonicalEventId);

    // SAME-DEVICE RECENT ECHO GUARD (Within 8 seconds):
    // If the SAME scanner device scanned this pass within the last 8 seconds,
    // this is the same attendee still standing in front of the camera frame.
    // Return idempotent VALID confirmation instead of flashing a duplicate warning!
    const isSameDeviceRecentEcho =
      currentPass.firstScannedBy?.deviceId === deviceId &&
      currentPass.firstScannedAt &&
      (Date.now() - new Date(currentPass.firstScannedAt).getTime() < 8000);

    if (isSameDeviceRecentEcho) {
      return res.json({
        result: 'VALID',
        passId: currentPass.passId,
        inquiryId: currentPass.inquiryId,
        coupleName,
        couplePhoto,
        isVip,
        phoneNumber,
        firstScannedAt: currentPass.firstScannedAt,
        scannedByDevice: deviceId,
        scannedByOperator: operatorUserId,
        message: 'Entry Approved (Already verified on this scanner).',
        liveStats
      });
    }

    // Genuine Duplicate Scan:
    // Debounce check: If this device already triggered a DUPLICATE for this pass in the last 4 seconds,
    // do NOT create an extra ScanRecord (prevents +2 counter jump from back-to-back camera frames)
    const recentDuplicate = await ScanRecord.findOne({
      passId: currentPass.passId,
      deviceId,
      result: 'DUPLICATE',
      receivedAtServer: { $gte: new Date(Date.now() - 4000) }
    });

    if (!recentDuplicate) {
      await Pass.updateOne(
        { _id: currentPass._id },
        {
          $set: { lastScannedAt: new Date() },
          $inc: { scanCount: 1 }
        }
      );

      await ScanRecord.create({
        scanId,
        eventId: canonicalEventId,
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
    }

    return res.json({
      result: 'ALREADY_SCANNED',
      passId: currentPass.passId,
      inquiryId: currentPass.inquiryId,
      coupleName,
      couplePhoto,
      isVip,
      phoneNumber,
      firstScannedAt: currentPass.firstScannedAt,
      scannedByDevice: currentPass.firstScannedBy?.deviceId || 'Gate Scanner',
      scannedByOperator: currentPass.firstScannedBy?.operatorUserId || 'Gate Staff',
      scanCount: (currentPass.scanCount || 1) + (recentDuplicate ? 0 : 1),
      message: 'Already scanned. Duplicate entry attempt.',
      liveStats
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

    // Auto-Heal: Ensure all approved registrations for this event have an active Pass before caching roster
    try {
      const approvedWithoutPass = await Registration.find({
        $or: [
          { programId: event.id },
          { programId: event.slug },
          ...(event.date ? [{ programDate: event.date }] : [])
        ],
        status: 'approved',
        isDeleted: { $ne: true }
      }).select('_id inquiryId programId').lean();

      const existingPassRegIds = new Set(
        (await Pass.find({ eventId }).select('registrationId').lean())
          .map(p => String(p.registrationId))
      );

      const missingPassRegs = approvedWithoutPass.filter(r => !existingPassRegIds.has(String(r._id)));
      for (const reg of missingPassRegs) {
        await qrPassService.ensurePass(reg, event);
      }
    } catch (healErr) {
      console.warn('[prepareOfflineRoster] Auto-heal notice:', healErr.message);
    }

    // Fetch compact revocation list for this event (passIds that are revoked)
    const revokedPasses = await Pass.find({ eventId, status: 'REVOKED' }).select('passId version').lean();

    // Fetch active passes with lightweight attendee roster for offline visual verification
    const activePasses = await Pass.find({ eventId, status: 'ACTIVE' })
      .select('passId inquiryId registrationId')
      .populate({
        path: 'registrationId',
        select: 'husbandName wifeName surname couplePhoto isVip phoneNumber r2Media mediaProvider'
      })
      .lean();

    const roster = {};
    for (const p of activePasses) {
      const reg = p.registrationId;
      roster[p.passId] = {
        passId: p.passId,
        inquiryId: p.inquiryId,
        coupleName: reg ? `${reg.husbandName || ''} & ${reg.wifeName || ''} ${reg.surname || ''}`.trim() : 'Registered Couple',
        couplePhoto: resolveScannerCouplePhoto(reg),
        isVip: Boolean(reg?.isVip),
        phoneNumber: reg?.phoneNumber || ''
      };
    }

    return res.json({
      success: true,
      eventId: event.id,
      eventName: event.name,
      eventDate: event.date,
      eventTime: event.time || '8:30 PM',
      venue: event.venue || '',
      publicKey: pubKey,
      revokedPassIds: revokedPasses.map(p => p.passId),
      roster,
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

    // 1. Resolve Canonical Event & All Valid Alias Identifiers (id, slug, date, _id)
    const isObjectId = typeof eventId === 'string' && /^[0-9a-fA-F]{24}$/.test(eventId);
    const activeEvent = await Event.findOne({
      $or: [
        { id: eventId },
        { slug: eventId },
        { date: eventId },
        ...(isObjectId ? [{ _id: eventId }] : [])
      ]
    }).lean();

    const canonicalEventId = activeEvent?.id || eventId;
    const validEventIds = Array.from(new Set([
      eventId,
      canonicalEventId,
      activeEvent?.slug,
      activeEvent?.date
    ].filter(Boolean)));

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
      let verifyResult = qrPassService.verifyPassToken(qrToken);
      if (!verifyResult.valid) {
        const dbPass = await Pass.findOne({
          qrToken,
          eventId: { $in: validEventIds }
        });
        if (dbPass) {
          verifyResult = {
            valid: true,
            payload: {
              v: dbPass.version || 1,
              eventId: dbPass.eventId,
              passId: dbPass.passId,
              version: dbPass.version || 1,
              issuedAt: dbPass.issuedAt ? Math.floor(dbPass.issuedAt.getTime() / 1000) : 0,
              keyId: dbPass.keyId
            }
          };
        }
      }

      if (!verifyResult.valid) {
        await ScanRecord.create({
          scanId: `SCAN-OFF-${crypto.randomBytes(8).toString('hex')}`,
          eventId: canonicalEventId,
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

      const isMatchingCurrentEvent = !payload.eventId || validEventIds.includes(payload.eventId);
      if (!isMatchingCurrentEvent) {
        await ScanRecord.create({
          scanId: `SCAN-OFF-${crypto.randomBytes(8).toString('hex')}`,
          eventId: canonicalEventId,
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

      // Atomic attendance claim (supporting all event aliases)
      const updatedPass = await Pass.findOneAndUpdate(
        {
          passId: payload.passId,
          eventId: { $in: validEventIds },
          firstScannedAt: null,
          status: 'ACTIVE'
        },
        {
          $set: {
            firstScannedAt: scannedAt,
            lastScannedAt: new Date(),
            firstScannedBy: {
              deviceId,
              operatorUserId,
              mode: 'OFFLINE_SYNC'
            },
            eventId: canonicalEventId
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
          eventId: canonicalEventId,
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
          eventId: canonicalEventId,
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

    invalidateLiveAttendanceStatsCache(canonicalEventId);

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

    // 1. Resolve Canonical Event & All Valid Alias Identifiers (id, slug, date, _id)
    const isObjectId = typeof eventId === 'string' && /^[0-9a-fA-F]{24}$/.test(eventId);
    const activeEvent = await Event.findOne({
      $or: [
        { id: eventId },
        { slug: eventId },
        { date: eventId },
        ...(isObjectId ? [{ _id: eventId }] : [])
      ]
    }).lean();

    const canonicalEventId = activeEvent?.id || eventId;
    const validEventIds = Array.from(new Set([
      eventId,
      canonicalEventId,
      activeEvent?.slug,
      activeEvent?.date
    ].filter(Boolean)));

    let pass = await Pass.findOne({
      eventId: { $in: validEventIds },
      $or: [
        { passId: clean.toUpperCase() },
        { inquiryId: { $regex: new RegExp(`^${clean}$`, 'i') } }
      ]
    });

    if (!pass) {
      // Extended Fast Lookup: search by mobile phone number or inquiryId across Registration
      const digitsOnly = clean.replace(/\D/g, '');
      const phoneCandidates = [];
      if (digitsOnly.length === 10) {
        phoneCandidates.push(digitsOnly, `91${digitsOnly}`, `+91${digitsOnly}`);
      } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
        phoneCandidates.push(digitsOnly, digitsOnly.substring(2), `+${digitsOnly}`);
      }

      const regQuery = {
        $or: [
          { inquiryId: { $regex: new RegExp(`^${clean}$`, 'i') } },
          ...(phoneCandidates.length > 0 ? [{ phoneNumber: { $in: phoneCandidates } }] : [])
        ]
      };

      const matchedReg = await Registration.findOne(regQuery);
      if (matchedReg) {
        pass = await Pass.findOne({
          $or: [
            { registrationId: matchedReg._id },
            { inquiryId: matchedReg.inquiryId }
          ]
        });

        // Self-Healing: If attendee was approved but pass record was never created, generate it on the spot!
        if (!pass && (matchedReg.status === 'approved' || matchedReg.payment?.status === 'captured')) {
          pass = await qrPassService.ensurePass(matchedReg, activeEvent || { id: canonicalEventId });
        }
      }
    }

    // If still not found by event-scoped lookup, search across ANY pass to detect old seminar codes
    if (!pass) {
      const anyPass = await Pass.findOne({
        $or: [
          { passId: clean.toUpperCase() },
          { inquiryId: { $regex: new RegExp(`^${clean}$`, 'i') } }
        ]
      });

      if (anyPass) {
        pass = anyPass;
      }
    }

    if (!pass) {
      return res.status(404).json({ result: 'NOT_FOUND', message: 'No pass found matching identifier or phone number.' });
    }

    // Check if pass belongs to an OLD seminar
    const isMatchingCurrentEvent = !pass.eventId || validEventIds.includes(pass.eventId);
    if (!isMatchingCurrentEvent) {
      const otherEvent = await Event.findOne({
        $or: [
          { id: pass.eventId },
          { slug: pass.eventId },
          { date: pass.eventId },
          ...(typeof pass.eventId === 'string' && /^[0-9a-fA-F]{24}$/.test(pass.eventId) ? [{ _id: pass.eventId }] : [])
        ]
      }).lean();

      let coupleName = 'Registered Couple';
      let couplePhoto = null;
      let isVip = false;
      let phoneNumber = '';
      if (pass.registrationId) {
        const reg = await Registration.findById(pass.registrationId).lean();
        if (reg) {
          coupleName = `${reg.husbandName || ''} & ${reg.wifeName || ''} ${reg.surname || ''}`.trim();
          couplePhoto = resolveScannerCouplePhoto(reg);
          isVip = Boolean(reg.isVip);
          phoneNumber = reg.phoneNumber || '';
        }
      }

      return res.json({
        result: 'WRONG_EVENT',
        passId: pass.passId,
        inquiryId: pass.inquiryId,
        coupleName,
        couplePhoto,
        isVip,
        phoneNumber,
        registeredForEvent: otherEvent?.name || pass.eventId,
        registeredForDate: otherEvent?.date || '',
        message: otherEvent
          ? `This pass was registered for an earlier seminar: "${otherEvent.name}" (${otherEvent.date}). It cannot be used for tonight's seminar.`
          : `This pass is registered for another seminar session (${pass.eventId}), not tonight's batch.`
      });
    }

    if (pass.firstScannedAt) {
      let coupleName = 'Registered Couple';
      let couplePhoto = null;
      let isVip = false;
      let phoneNumber = '';
      if (pass.registrationId) {
        const reg = await Registration.findById(pass.registrationId);
        if (reg) {
          coupleName = `${reg.husbandName || ''} & ${reg.wifeName || ''} ${reg.surname || ''}`.trim();
          couplePhoto = resolveScannerCouplePhoto(reg);
          isVip = Boolean(reg.isVip);
          phoneNumber = reg.phoneNumber || '';
        }
      }
      const liveStats = await getEventLiveAttendanceStats(canonicalEventId);

      return res.json({
        result: 'ALREADY_SCANNED',
        passId: pass.passId,
        inquiryId: pass.inquiryId,
        coupleName,
        couplePhoto,
        isVip,
        phoneNumber,
        firstScannedAt: pass.firstScannedAt,
        scannedByDevice: pass.firstScannedBy?.deviceId || 'Gate Scanner',
        scannedByOperator: pass.firstScannedBy?.operatorUserId || 'Gate Staff',
        message: 'Pass was already marked present.',
        liveStats
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
    pass.eventId = canonicalEventId;
    await pass.save();

    let coupleName = 'Registered Couple';
    let couplePhoto = null;
    let isVip = false;
    let phoneNumber = '';
    if (pass.registrationId) {
      const reg = await Registration.findByIdAndUpdate(
        pass.registrationId,
        {
          $set: {
            attendance: 'present',
            attendanceAt: new Date(),
            attendanceMethod: 'MANUAL_ENTRY'
          }
        },
        { returnDocument: 'after' }
      );
      if (reg) {
        coupleName = `${reg.husbandName || ''} & ${reg.wifeName || ''} ${reg.surname || ''}`.trim();
        couplePhoto = resolveScannerCouplePhoto(reg);
        isVip = Boolean(reg.isVip);
        phoneNumber = reg.phoneNumber || '';
      }
    }

    invalidateLiveAttendanceStatsCache(canonicalEventId);
    const liveStats = await getEventLiveAttendanceStats(canonicalEventId);

    return res.json({
      result: 'VALID',
      passId: pass.passId,
      inquiryId: pass.inquiryId,
      coupleName,
      couplePhoto,
      isVip,
      phoneNumber,
      firstScannedAt: pass.firstScannedAt,
      message: 'Manual entry marked present.',
      liveStats
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

    const stats = await getEventLiveAttendanceStats(eventId);
    const etag = `W/"scan-${eventId}-${stats.totalConfirmed}-${stats.presentCount}-${stats.duplicateScans}"`;

    res.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=15');
    res.set('ETag', etag);

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch scanner stats.' });
  }
}

/**
 * 6. Admin Reset Scanner Attendance & Scans for Event
 */
export async function handleResetScannerAttendance(req, res) {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required in request body.' });
    }

    const event = await Event.findOne({
      $or: [
        { id: eventId },
        { slug: eventId },
        { date: eventId },
        ...(typeof eventId === 'string' && eventId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: eventId }] : [])
      ]
    });

    const eventIds = [eventId, event?.id, event?.slug, event?.date].filter(Boolean);

    // 1. Reset Attendance on Registrations
    const regResult = await Registration.updateMany(
      {
        $or: [
          { programId: { $in: eventIds } },
          ...(event?.date ? [{ programDate: event.date }] : [])
        ]
      },
      {
        $set: { attendance: 'unmarked' },
        $unset: {
          attendanceAt: '',
          attendanceMethod: '',
          checkedIn: '',
          checkedInAt: '',
          admittedAt: '',
          scannedBy: '',
          gateNumber: ''
        }
      }
    );

    // 2. Reset Passes
    const passResult = await Pass.updateMany(
      {
        $or: [
          { eventId: { $in: eventIds } },
          ...(event?.date ? [{ eventDate: event.date }] : [])
        ]
      },
      {
        $set: {
          firstScannedAt: null,
          lastScannedAt: null,
          scanCount: 0
        },
        $unset: {
          firstScannedBy: ''
        }
      }
    );

    // 3. Delete ScanRecords
    const scanResult = await ScanRecord.deleteMany({
      $or: [
        { eventId: { $in: eventIds } },
        ...(event?.date ? [{ eventDate: event.date }] : [])
      ]
    });

    // 4. Invalidate Cache
    invalidateLiveAttendanceStatsCache();

    const stats = await getEventLiveAttendanceStats(eventId);

    return res.json({
      success: true,
      message: 'Scanner attendance and scan records successfully reset.',
      registrationsReset: regResult.modifiedCount,
      passesReset: passResult.modifiedCount,
      scansDeleted: scanResult.deletedCount,
      stats
    });
  } catch (err) {
    console.error('[handleResetScannerAttendance Error]:', err);
    return res.status(500).json({ error: 'Failed to reset scanner attendance: ' + err.message });
  }
}

