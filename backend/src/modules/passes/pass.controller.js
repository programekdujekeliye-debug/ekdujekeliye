import { Registration } from '../../models/Registration.js';
import { Event } from '../../models/Event.js';
import { qrPassService } from './qrPass.service.js';
import { eventService } from '../events/event.service.js';
import { mediaService } from '../media/media.service.js';
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

    // 1. Direct browser address bar navigation guard:
    // Only redirect if a user is literally visiting the URL directly in a browser tab.
    // NEVER redirect programmatic fetch / XHR / API calls!
    const isFetchCall =
      req.headers['sec-fetch-dest'] === 'empty' ||
      req.headers['sec-fetch-mode'] === 'cors' ||
      Boolean(req.headers.origin) ||
      Boolean(req.headers['x-requested-with']) ||
      (typeof req.headers.accept === 'string' && req.headers.accept.includes('application/json'));

    const isDirectBrowserNavigation =
      !isFetchCall &&
      (req.headers['sec-fetch-dest'] === 'document' ||
       req.headers['sec-fetch-mode'] === 'navigate' ||
       (typeof req.headers.accept === 'string' && req.headers.accept.includes('text/html')));

    if (isDirectBrowserNavigation) {
      return res.redirect(302, `${publicBaseUrl}/pass/${encodeURIComponent(cleanInquiryId)}`);
    }

    // 2. Direct onrender.com host access guard:
    // Disallow public arbitrary scraping or direct calls to onrender.com host from unauthorized websites
    const host = String(req.headers.host || '').toLowerCase();
    const origin = String(req.headers.origin || '').toLowerCase();
    const referer = String(req.headers.referer || '').toLowerCase();
    const xForwardedHost = String(req.headers['x-forwarded-host'] || '').toLowerCase();

    const isDirectRenderCall = host.includes('onrender.com');
    const isFromAuthorizedDomain =
      !origin ||
      origin.includes('ekdujekeliye.in') ||
      referer.includes('ekdujekeliye.in') ||
      xForwardedHost.includes('ekdujekeliye.in') ||
      origin.includes('localhost') ||
      referer.includes('localhost') ||
      host.includes('localhost') ||
      env.NODE_ENV !== 'production';

    if (isDirectRenderCall && origin && !isFromAuthorizedDomain) {
      return res.status(403).json({
        error: 'Direct access to backend API URL is prohibited.',
        message: `Please view digital pass securely via the official portal at ${publicBaseUrl}/pass/${encodeURIComponent(cleanInquiryId)}`
      });
    }

    const submission = await Registration.findOne({
      $or: [
        { inquiryId: cleanInquiryId },
        { inquiryId: inquiryId },
        { previousInquiryId: cleanInquiryId },
        { previousInquiryId: inquiryId }
      ],
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

    let couplePhoto = submission.couplePhoto || '/sample_couple.png';
    let photoThumbnailUrl = submission.couplePhoto || '/sample_couple.png';

    // Authorized short-lived signed access for private couple photo on pass
    if (submission.r2Media?.isPrivate) {
      const normalToken = mediaService.generateSignedMediaToken({
        registrationId: submission.inquiryId,
        purpose: 'couple_photo',
        preset: 'normal',
        expiresIn: 7200
      });
      const thumbToken = mediaService.generateSignedMediaToken({
        registrationId: submission.inquiryId,
        purpose: 'couple_photo',
        preset: 'thumb',
        expiresIn: 7200
      });
      couplePhoto = `/api/media/${submission.inquiryId}/couple-photo?preset=normal&exp=${normalToken.expiresAt}&sig=${normalToken.sig}`;
      photoThumbnailUrl = `/api/media/${submission.inquiryId}/couple-photo?preset=thumb&exp=${thumbToken.expiresAt}&sig=${thumbToken.sig}`;
    }

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');

    return res.json({
      passId: pass.passId,
      qrToken: pass.qrToken,
      inquiryId: submission.inquiryId,
      husbandName: submission.husbandName,
      wifeName: submission.wifeName,
      surname: submission.surname,
      coupleName: `${submission.husbandName || ''} & ${submission.wifeName || ''} ${submission.surname || ''}`.trim(),
      couplePhoto,
      photoThumbnailUrl,
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
