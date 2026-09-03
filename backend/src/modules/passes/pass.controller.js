import { Registration } from '../../models/Registration.js';
import { Event } from '../../models/Event.js';
import { qrPassService } from './qrPass.service.js';
import { eventService } from '../events/event.service.js';
import { env } from '../../config/env.js';

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
    const publicBaseUrl = env.PUBLIC_APP_URL || 'https://www.ekdujekeliye.in';

    // 1. Direct browser navigation guard:
    // If someone visits or pastes the raw backend Render URL directly in a browser,
    // immediately redirect them to the official frontend digital pass page.
    const acceptsHtml = req.accepts(['html', 'json']) === 'html';
    const isDocRequest = req.headers['sec-fetch-dest'] === 'document';
    const hasHtmlInAccept = typeof req.headers.accept === 'string' && req.headers.accept.includes('text/html');

    if (acceptsHtml || isDocRequest || hasHtmlInAccept) {
      return res.redirect(302, `${publicBaseUrl}/pass/${encodeURIComponent(cleanInquiryId)}`);
    }

    // 2. Direct onrender.com host access guard:
    // Disallow public arbitrary scraping or direct calls to onrender.com host without coming from our official domain
    const host = String(req.headers.host || '').toLowerCase();
    const origin = String(req.headers.origin || '').toLowerCase();
    const referer = String(req.headers.referer || '').toLowerCase();
    const xForwardedHost = String(req.headers['x-forwarded-host'] || '').toLowerCase();

    const isDirectRenderCall = host.includes('onrender.com');
    const isFromAuthorizedDomain =
      origin.includes('ekdujekeliye.in') ||
      referer.includes('ekdujekeliye.in') ||
      xForwardedHost.includes('ekdujekeliye.in') ||
      origin.includes('localhost') ||
      referer.includes('localhost') ||
      host.includes('localhost') ||
      env.NODE_ENV !== 'production';

    if (isDirectRenderCall && !isFromAuthorizedDomain) {
      return res.status(403).json({
        error: 'Direct access to backend API URL is prohibited.',
        message: `Please view digital pass securely via the official portal at ${publicBaseUrl}/pass/${encodeURIComponent(cleanInquiryId)}`
      });
    }

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
      couplePhoto: submission.couplePhoto,
      photoThumbnailUrl: submission.couplePhoto,
      status: pass.status,
      programId: submission.programId,
      programName: event?.name || submission.programName,
      programDate: event?.date || submission.programDate,
      programTime: event?.time || submission.programTime || '8:30 PM',
      venue: event?.venue || submission.venue || '',
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
