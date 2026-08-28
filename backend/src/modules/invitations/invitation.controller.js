import { invitationCardService } from '../../services/invitationCard.service.js';

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
