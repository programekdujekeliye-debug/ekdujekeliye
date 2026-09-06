import { invitationCardService } from '../../services/invitationCard.service.js';
import { Registration } from '../../models/Registration.js';
import { Event } from '../../models/Event.js';
import { r2Provider } from '../../integrations/r2/r2.provider.js';

export async function getInvitationCard(req, res) {
  try {
    const { inquiryId } = req.params;
    if (!inquiryId) return res.status(400).json({ error: 'Inquiry ID is required' });

    const result = await invitationCardService.ensureInvitationCard(inquiryId);
    if (!result) return res.status(404).json({ error: 'Invitation not found' });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    return res.send(result.buffer);
  } catch (err) {
    console.error('[Invitation Controller Error]:', err);
    return res.status(500).json({ error: 'Failed to generate invitation card' });
  }
}

export async function downloadInvitationCard(req, res) {
  try {
    const { inquiryId } = req.params;
    if (!inquiryId) return res.status(400).json({ error: 'Inquiry ID is required' });

    const result = await invitationCardService.ensureInvitationCard(inquiryId);
    if (!result) return res.status(404).json({ error: 'Invitation not found' });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="EDKL-Invitation-${inquiryId.toUpperCase()}.svg"`);
    return res.send(result.buffer);
  } catch (err) {
    console.error('[Invitation Controller Error]:', err);
    return res.status(500).json({ error: 'Failed to download invitation card' });
  }
}

/**
 * Stream official 576x1024 JPEG invitation card (Compatible with Meta WhatsApp IMAGE headers & browsers)
 */
export async function getInvitationCardJpeg(req, res) {
  try {
    const { inquiryId } = req.params;
    if (!inquiryId) return res.status(400).json({ error: 'Inquiry ID is required' });

    const cleanInquiryId = String(inquiryId).replace(/[^a-zA-Z0-9_-]/g, '');
    const reg = await Registration.findOne({ inquiryId: { $regex: new RegExp(`^${cleanInquiryId}$`, 'i') } });
    if (!reg) return res.status(404).json({ error: 'Registration not found' });

    // 1. Try reading pre-rendered card buffer from R2
    if (reg.invitationKey) {
      try {
        const buf = await r2Provider.getObjectBuffer({
          bucket: r2Provider.publicBucket,
          key: reg.invitationKey
        });
        if (buf && buf.length > 0) {
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600, immutable');
          res.setHeader('Content-Disposition', `inline; filename="invitation-${cleanInquiryId}.jpg"`);
          return res.send(buf);
        }
      } catch (r2Err) {
        console.warn(`[getInvitationCardJpeg] Could not read from R2 (${reg.invitationKey}), generating fresh composite:`, r2Err.message);
      }
    }

    // 2. Fetch Event details
    const event = await Event.findOne({
      $or: [
        { id: reg.programId },
        { slug: reg.programId },
        { date: reg.programDate }
      ]
    }).lean();

    // 3. Generate official JPEG composite on the fly
    const jpegBuffer = await invitationCardService.generateOfficialCardBuffer(reg, event);
    if (!jpegBuffer) {
      return res.status(500).json({ error: 'Could not generate invitation card JPEG' });
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    res.setHeader('Content-Disposition', `inline; filename="invitation-${cleanInquiryId}.jpg"`);
    return res.send(jpegBuffer);
  } catch (err) {
    console.error('[getInvitationCardJpeg Error]:', err);
    return res.status(500).json({ error: 'Failed to stream invitation card JPEG' });
  }
}

