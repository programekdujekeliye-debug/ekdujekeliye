import { VipLink } from '../../models/VipLink.js';
import { Event } from '../../models/Event.js';
import { Registration } from '../../models/Registration.js';

/**
 * Public endpoint to check VIP link status, housefull state, and remaining seats
 * GET /api/vip-links/check?code=...&programId=...
 */
export const checkVipLink = async (req, res) => {
  try {
    const rawCode = (req.query.code || 'default').trim().toLowerCase();
    const programId = req.query.programId;

    let query = { code: rawCode };
    let link = await VipLink.findOne(query).lean();

    // If specific code not found and code wasn't 'default', return 404
    if (!link && rawCode !== 'default') {
      return res.status(404).json({
        found: false,
        isOpen: false,
        status: 'CLOSED',
        error: 'Invalid or expired VIP invitation link.'
      });
    }

    // If default link not yet created in DB, fallback to safe default (HOUSEFULL)
    if (!link) {
      return res.json({
        found: true,
        isOpen: false,
        status: 'HOUSEFULL',
        code: 'default',
        name: "Today's VIP Entry Link",
        programName: 'Ek Duje Ke Liye - Sardar Patel Smruti Bhavan',
        programDate: '2026-09-07',
        maxSeats: 0,
        usedSeats: 0,
        approvedSeats: 0,
        remainingSeats: null,
        message: 'આજના કાર્યક્રમ માટે VIP મહેમાન એન્ટ્રી બેઠકો પૂર્ણ થઈ ગયેલ છે (Housefull).'
      });
    }

    // Dynamic verification of capacity
    const isCapacityExceeded = link.maxSeats > 0 && link.usedSeats >= link.maxSeats;
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
      programId: link.programId,
      programName: link.programName,
      programDate: link.programDate,
      maxSeats: link.maxSeats,
      usedSeats: link.usedSeats,
      approvedSeats: link.approvedSeats,
      remainingSeats: link.maxSeats > 0 ? Math.max(0, link.maxSeats - link.usedSeats) : null,
      message: isOpen
        ? 'VIP રજીસ્ટ્રેશન ખુલ્લું છે.'
        : effectiveStatus === 'HOUSEFULL'
          ? 'આજના કાર્યક્રમ માટે VIP મહેમાન એન્ટ્રી બેઠકો પૂર્ણ થઈ ગયેલ છે (Housefull).'
          : 'આ VIP એન્ટ્રી લિંક હાલમાં બંધ છે.'
    });
  } catch (err) {
    console.error('[checkVipLink] Error:', err);
    res.status(500).json({ error: 'Failed to verify VIP link status.', details: err.message });
  }
};

/**
 * Admin: Get all VIP links with real-time submission metrics
 * GET /api/admin/vip-links
 */
export const getVipLinks = async (req, res) => {
  try {
    // Ensure default link exists
    let defaultLink = await VipLink.findOne({ code: 'default' });
    if (!defaultLink) {
      defaultLink = await VipLink.create({
        name: "Today's VIP Entry Link",
        code: 'default',
        isDefault: true,
        programId: 'prog-2026-09-07',
        programName: 'Ek Duje Ke Liye - Sardar Patel Smruti Bhavan',
        programDate: '2026-09-07',
        maxSeats: 0,
        status: 'HOUSEFULL',
        notes: 'Primary public VIP registration link'
      });
    }

    const links = await VipLink.find().sort({ isDefault: -1, createdAt: -1 }).lean();

    // Refresh live counts for all links based on registrations
    const enriched = await Promise.all(links.map(async (l) => {
      const liveCount = await Registration.countDocuments({
        $or: [
          { vipLinkCode: l.code },
          ...(l.isDefault ? [{ isVip: true, vipLinkCode: { $in: [null, '', 'default'] } }] : [])
        ],
        programId: l.programId,
        isDeleted: { $ne: true }
      });

      const liveApproved = await Registration.countDocuments({
        $or: [
          { vipLinkCode: l.code },
          ...(l.isDefault ? [{ isVip: true, vipLinkCode: { $in: [null, '', 'default'] } }] : [])
        ],
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

    res.json({ success: true, links: enriched });
  } catch (err) {
    console.error('[getVipLinks] Error:', err);
    res.status(500).json({ error: 'Failed to fetch VIP links.', details: err.message });
  }
};

/**
 * Admin: Create a new custom VIP link with seat limits
 * POST /api/admin/vip-links
 */
export const createVipLink = async (req, res) => {
  try {
    const { name, code, programId, maxSeats = 0, status = 'ACTIVE', notes = '' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Link name is required.' });
    }

    // Generate or clean code
    let cleanCode = (code || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (!cleanCode) {
      cleanCode = `vip-${Math.random().toString(36).substring(2, 8)}`;
    }

    // Check code collision
    const existing = await VipLink.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({ error: `Link code "${cleanCode}" is already in use. Please choose another.` });
    }

    // Resolve event details
    const targetProgramId = programId || 'prog-2026-09-07';
    const event = await Event.findOne({
      $or: [{ id: targetProgramId }, { slug: targetProgramId }]
    }).lean();

    const link = new VipLink({
      name: name.trim(),
      code: cleanCode,
      programId: event?.id || targetProgramId,
      programName: event?.name || 'Ek Duje Ke Liye',
      programDate: event?.date || '2026-09-07',
      maxSeats: Math.max(0, Number(maxSeats) || 0),
      status: ['ACTIVE', 'HOUSEFULL', 'CLOSED'].includes(status) ? status : 'ACTIVE',
      notes: notes.trim(),
      isDefault: false,
      createdBy: req.user?.username || 'admin'
    });

    await link.save();
    res.status(201).json({ success: true, link, message: `VIP link created: /vip-entry?code=${cleanCode}` });
  } catch (err) {
    console.error('[createVipLink] Error:', err);
    res.status(500).json({ error: 'Failed to create VIP link.', details: err.message });
  }
};

/**
 * Admin: Update VIP link (status, seats, name)
 * PATCH /api/admin/vip-links/:id
 */
export const updateVipLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, maxSeats, status, notes, programId } = req.body;

    const link = await VipLink.findById(id);
    if (!link) {
      return res.status(404).json({ error: 'VIP link not found.' });
    }

    if (name !== undefined) link.name = name.trim();
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
    res.json({ success: true, link, message: 'VIP link updated successfully.' });
  } catch (err) {
    console.error('[updateVipLink] Error:', err);
    res.status(500).json({ error: 'Failed to update VIP link.', details: err.message });
  }
};

/**
 * Admin: Toggle VIP link between ACTIVE and HOUSEFULL
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

    if (link.isDefault || link.code === 'default') {
      return res.status(400).json({ error: 'Cannot delete the primary default VIP link. You can set it to HOUSEFULL or CLOSED instead.' });
    }

    await VipLink.findByIdAndDelete(id);
    res.json({ success: true, message: `VIP link "${link.name}" deleted successfully.` });
  } catch (err) {
    console.error('[deleteVipLink] Error:', err);
    res.status(500).json({ error: 'Failed to delete VIP link.', details: err.message });
  }
};
