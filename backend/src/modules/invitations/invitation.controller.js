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

    // Fetch Event details
    const event = await Event.findOne({
      $or: [
        { id: reg.programId },
        { slug: reg.programId },
        { date: reg.programDate }
      ]
    }).lean();

    // Ensure valid, hash-matched card exists on R2
    const cardResult = await invitationCardService.ensureInvitationCardImage(reg, event);
    if (cardResult && cardResult.cardUrl) {
      return res.redirect(302, cardResult.cardUrl);
    }

    // Fallback: Generate official JPEG composite on the fly
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

