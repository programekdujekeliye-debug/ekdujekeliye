import { VipLink } from '../../models/VipLink.js';
import { Event } from '../../models/Event.js';
import { Registration } from '../../models/Registration.js';

/**
 * Public endpoint to check VIP link status, housefull state, and remaining seats
 * GET /api/vip-links/check?code=...
 */
export const checkVipLink = async (req, res) => {
  try {
    const rawCode = (req.query.code || '').trim().toLowerCase();

    // If no code supplied, return invitation-required guidance
    if (!rawCode) {
      return res.status(400).json({
        found: false,
        isOpen: false,
        status: 'CLOSED',
        error: 'કૃપા કરીને આયોજકો દ્વારા આપેલ માન્ય VIP આમંત્રણ લિંકનો ઉપયોગ કરો (VIP Invitation Link is required).'
      });
    }

    const link = await VipLink.findOne({ code: rawCode }).lean();

    // If specific code not found, return 404
    if (!link) {
      return res.status(404).json({
        found: false,
        isOpen: false,
        status: 'CLOSED',
        error: 'આ VIP આમંત્રણ લિંક અમાન્ય છે અથવા સમાપ્ત થઈ ગઈ છે (Invalid or expired VIP invitation link).'
      });
    }

    // Resolve event details for venue and time
    const event = await Event.findOne({
      $or: [{ id: link.programId }, { slug: link.programId }]
    }).lean();

    // Live verification of capacity from actual database records
    const liveCount = await Registration.countDocuments({
      vipLinkCode: link.code,
      programId: link.programId,
      isDeleted: { $ne: true }
    });

    const isCapacityExceeded = link.maxSeats > 0 && liveCount >= link.maxSeats;
    let effectiveStatus = link.status;
    if (effectiveStatus === 'ACTIVE' && isCapacityExceeded) {
      effectiveStatus = 'HOUSEFULL';
    }

    const isOpen = effectiveStatus === 'ACTIVE' && !isCapacityExceeded;

    res.json({
      found: true,
      isOpen,
      status: effectiveStatus,
      code: link.code,
      name: link.name,
      category: link.category || 'CUSTOM',
      sponsorName: link.sponsorName || '',
      programId: link.programId,
      programName: event?.name || link.programName || 'Ek Duje Ke Liye',
      programDate: event?.date || link.programDate || '',
      programTime: event?.time || '8:30 PM',
      venue: event?.venue || '',
      city: event?.city || '',
      maxSeats: link.maxSeats,
      usedSeats: liveCount,
      approvedSeats: link.approvedSeats,
      remainingSeats: link.maxSeats > 0 ? Math.max(0, link.maxSeats - liveCount) : null,
      message: isOpen
        ? 'VIP રજીસ્ટ્રેશન ખુલ્લું છે.'
        : effectiveStatus === 'HOUSEFULL'
          ? `આ લિંક (${link.name}) પર ઉપલબ્ધ તમામ VIP બેઠકો પૂર્ણ થઈ ગયેલ છે (Housefull).`
          : 'આ VIP એન્ટ્રી લિંક હાલમાં બંધ છે.'
    });
  } catch (err) {
    console.error('[checkVipLink] Error:', err);
    res.status(500).json({ error: 'Failed to verify VIP link status.', details: err.message });
  }
};

/**
 * Admin: Get all VIP links with real-time submission metrics, optionally filtered by programId
 * GET /api/admin/vip-links?programId=...
 */
export const getVipLinks = async (req, res) => {
  try {
    const { programId } = req.query;
    const query = programId && programId !== 'all' ? { programId } : {};

    const links = await VipLink.find(query).sort({ createdAt: -1 }).lean();

    // Refresh live counts for all links based on active registrations
    const enriched = await Promise.all(links.map(async (l) => {
      const liveCount = await Registration.countDocuments({
        vipLinkCode: l.code,
        programId: l.programId,
        isDeleted: { $ne: true }
      });

      const liveApproved = await Registration.countDocuments({
        vipLinkCode: l.code,
        programId: l.programId,
        status: 'approved',
        isDeleted: { $ne: true }
      });

      return {
        ...l,
        usedSeats: liveCount,
        approvedSeats: liveApproved,
        remainingSeats: l.maxSeats > 0 ? Math.max(0, l.maxSeats - liveCount) : null
      };
    }));

    res.json({ success: true, links: enriched, data: enriched });
  } catch (err) {
    console.error('[getVipLinks] Error:', err);
    res.status(500).json({ error: 'Failed to fetch VIP links.', details: err.message });
  }
};

/**
 * Admin: Create a new custom VIP link with seat limits bound to a specific event
 * POST /api/admin/vip-links
 */
export const createVipLink = async (req, res) => {
  try {
    const {
      name,
      code,
      programId,
      category = 'CUSTOM',
      sponsorName = '',
      maxSeats = 0,
      status = 'ACTIVE',
      notes = ''
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Link name is required.' });
    }

    if (!programId) {
      return res.status(400).json({ error: 'Program/Event is required to generate a dynamic VIP link.' });
    }

    // Generate or clean slug code
    let cleanCode = (code || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (!cleanCode) {
      cleanCode = `vip-${Math.random().toString(36).substring(2, 8)}`;
    }

    // Check code collision
    const existing = await VipLink.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({ error: `Link code "${cleanCode}" is already in use. Please choose another slug.` });
    }

    // Resolve event details
    const event = await Event.findOne({
      $or: [{ id: programId }, { slug: programId }]
    }).lean();

    const link = new VipLink({
      name: name.trim(),
      code: cleanCode,
      category: ['TITLE_SPONSOR', 'POWERED_BY', 'CO_POWERED_BY', 'SUPPORTED_BY', 'VIP_GUEST', 'CUSTOM'].includes(category)
        ? category
        : 'CUSTOM',
      sponsorName: sponsorName.trim(),
      programId: event?.id || programId,
      programName: event?.name || 'Ek Duje Ke Liye',
      programDate: event?.date || '',
      maxSeats: Math.max(0, Number(maxSeats) || 0),
      status: ['ACTIVE', 'HOUSEFULL', 'CLOSED'].includes(status) ? status : 'ACTIVE',
      notes: notes.trim(),
      isDefault: false,
      createdBy: req.user?.username || 'admin'
    });

    await link.save();
    res.status(201).json({
      success: true,
      link,
      data: link,
      message: `VIP link created: /vip-entry?code=${cleanCode}`
    });
  } catch (err) {
    console.error('[createVipLink] Error:', err);
    res.status(500).json({ error: 'Failed to create VIP link.', details: err.message });
  }
};

/**
 * Admin: Update VIP link (status, seats, name, sponsorName, category, notes)
 * PATCH /api/admin/vip-links/:id
 */
export const updateVipLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, maxSeats, status, notes, programId, category, sponsorName } = req.body;

    const link = await VipLink.findById(id);
    if (!link) {
      return res.status(404).json({ error: 'VIP link not found.' });
    }

    if (name !== undefined) link.name = name.trim();
    if (category !== undefined) link.category = category;
    if (sponsorName !== undefined) link.sponsorName = sponsorName.trim();
    if (maxSeats !== undefined) link.maxSeats = Math.max(0, Number(maxSeats) || 0);
    if (status !== undefined && ['ACTIVE', 'HOUSEFULL', 'CLOSED'].includes(status)) {
      link.status = status;
    }
    if (notes !== undefined) link.notes = notes.trim();

    if (programId && programId !== link.programId) {
      const event = await Event.findOne({ $or: [{ id: programId }, { slug: programId }] }).lean();
      if (event) {
        link.programId = event.id;
        link.programName = event.name;
        link.programDate = event.date;
      }
    }

    await link.save();
    res.json({
      success: true,
      link,
      data: link,
      message: 'VIP link updated successfully.'
    });
  } catch (err) {
    console.error('[updateVipLink] Error:', err);
    res.status(500).json({ error: 'Failed to update VIP link.', details: err.message });
  }
};

/**
 * Admin: 1-Click Toggle VIP link between ACTIVE and HOUSEFULL
 * POST /api/admin/vip-links/:id/toggle
 */
export const toggleVipLinkStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const link = await VipLink.findById(id);
    if (!link) {
      return res.status(404).json({ error: 'VIP link not found.' });
    }

    link.status = link.status === 'ACTIVE' ? 'HOUSEFULL' : 'ACTIVE';
    await link.save();

    res.json({
      success: true,
      link,
      data: link,
      message: `Link "${link.name}" is now ${link.status}!`
    });
  } catch (err) {
    console.error('[toggleVipLinkStatus] Error:', err);
    res.status(500).json({ error: 'Failed to toggle VIP link status.', details: err.message });
  }
};

/**
 * Admin: Delete VIP link
 * DELETE /api/admin/vip-links/:id
 */
export const deleteVipLink = async (req, res) => {
  try {
    const { id } = req.params;
    const link = await VipLink.findById(id);
    if (!link) {
      return res.status(404).json({ error: 'VIP link not found.' });
    }

    await VipLink.findByIdAndDelete(id);
    res.json({ success: true, message: `VIP link "${link.name}" deleted successfully.` });
  } catch (err) {
    console.error('[deleteVipLink] Error:', err);
    res.status(500).json({ error: 'Failed to delete VIP link.', details: err.message });
  }
};
