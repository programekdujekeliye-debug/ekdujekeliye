import { Registration } from '../../models/Registration.js';
import { Event } from '../../models/Event.js';
import { qrPassService } from './qrPass.service.js';
import { eventService } from '../events/event.service.js';

/**
 * Get Digital Pass Details by Inquiry ID
 */
export async function getPassDetails(req, res) {
  try {
    const { inquiryId } = req.params;
    if (!inquiryId) {
      return res.status(400).json({ error: 'Inquiry ID is required.' });
    }

    const cleanInquiryId = inquiryId.trim().toUpperCase();
    const submission = await Registration.findOne({
      inquiryId: { $regex: new RegExp(`^${cleanInquiryId}$`, 'i') },
      isDeleted: { $ne: true }
    });

    if (!submission) {
      return res.status(404).json({ error: 'Pass not found.' });
    }

    // Only approved/paid registrations get an active digital pass
    const isApprovedOrPaid = submission.status === 'approved' || submission.payment?.status === 'captured';
    if (!isApprovedOrPaid) {
      return res.status(403).json({
        error: 'Pass is not active. Payment or registration approval is pending.',
        status: submission.status,
        inquiryId: submission.inquiryId
      });
    }

    // Resolve event details
    let event = null;
    if (submission.programId) {
      event = await eventService.getEventBySlug(submission.programId);
    }

    // Ensure asymmetric signed pass
    const pass = await qrPassService.ensurePass(submission, event);

    return res.json({
      passId: pass.passId,
      qrToken: pass.qrToken,
      inquiryId: submission.inquiryId,
      husbandName: submission.husbandName,
      wifeName: submission.wifeName,
      surname: submission.surname,
      coupleName: `${submission.husbandName || ''} & ${submission.wifeName || ''} ${submission.surname || ''}`.trim(),
      phoneNumber: submission.phoneNumber,
      couplePhoto: submission.couplePhoto,
      photoThumbnailUrl: submission.couplePhoto,
      status: pass.status,
      programId: submission.programId,
      programName: event?.name || submission.programName,
      programDate: event?.date || submission.programDate,
      programTime: event?.time || submission.programTime || '8:30 PM',
      venue: event?.venue || 'Sardar Patel Smruti Bhavan, Varachha, Surat',
      venueAddress: event?.venueAddress || '',
      issuedAt: pass.issuedAt
    });
  } catch (err) {
    console.error('[Pass Controller] Error fetching pass details:', err);
    return res.status(500).json({ error: 'Internal server error fetching pass.' });
  }
}

/**
 * Get Public Key for Offline Scanner Verification
 */
export function getPublicKey(req, res) {
  try {
    const keyInfo = qrPassService.getPublicKeyInfo();
    return res.json(keyInfo);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve public verification key.' });
  }
}
