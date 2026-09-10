import { eventService } from './event.service.js';
import { Event } from '../../models/Event.js';
import { Registration } from '../../models/Registration.js';
import { WhatsappMessage } from '../../models/WhatsappMessage.js';
import { generateEventSlug } from '../../utils/slug.js';
import { storageService } from '../../services/storage.service.js';
import { invalidateDashboardCache } from '../admin/admin.controller.js';

export const getPublicEvents = async (req, res) => {
  try {
    const events = await eventService.getPublicEvents();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(events);
  } catch (err) {
    console.error('[getPublicEvents Error]:', err);
    res.status(500).json({ error: 'Server error fetching events.', details: err.message });
  }
};

export const getEventBySlug = async (req, res) => {
  try {
    const event = await eventService.getEventBySlug(req.params.slug);
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(event);
  } catch (err) {
    console.error('[getEventBySlug Error]:', err);
    res.status(500).json({ error: 'Server error fetching event details.', details: err.message });
  }
};

export const getEventOptions = async (req, res) => {
  try {
    const options = await eventService.getEventOptions();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(options);
  } catch (err) {
    console.error('[getEventOptions Error]:', err);
    res.status(500).json({ error: 'Server error fetching event options.', details: err.message });
  }
};

export const getAdminEvents = async (req, res) => {
  try {
    if (!req.headers.authorization) {
      return await getPublicEvents(req, res);
    }
    const events = await eventService.getAdminEvents();
    res.setHeader('Cache-Control', 'no-store');
    res.json(events);
  } catch (err) {
    console.error('[getAdminEvents Error]:', err);
    res.status(500).json({ error: 'Server error fetching admin events.', details: err.message });
  }
};

export const createEvent = async (req, res) => {
  const {
    name,
    shortName,
    date,
    time,
    capacity,
    price,
    currency,
    city,
    venue,
    venueAddress,
    mapUrl,
    description,
    headline,
    subheadline,
    highlights,
    instructions,
    heroImage,
    posterImage,
    contactPhone,
    contactWhatsapp,
    contactEmail,
    speakerName,
    speakerTitle,
    speakerImage,
    speakerBio,
    ctaLabel,
    passTitle,
    passInstructions,
    seoTitle,
    seoDescription,
    registrationMode,
    externalRegistrationUrl,
    featured,
    sortOrder,
    status,
    isDateFinal,
    isInquiryClosed,
    heartX,
    heartY,
    heartWidth,
    heartHeight,
    photoZoom,
    photoOffsetY,
    photoLink
  } = req.body;

  if (!name || !date || !capacity) {
    return res.status(400).json({ error: 'Name, date, and capacity are required.' });
  }

  try {
    const maxProg = await Event.findOne({ sequenceNumber: { $exists: true } }).sort({ sequenceNumber: -1 });
    const sequenceNumber = maxProg && maxProg.sequenceNumber ? maxProg.sequenceNumber + 1 : 1;

    let slug = req.body.slug ? req.body.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : generateEventSlug(name, city, date);
    const existingSlug = await Event.findOne({ slug });
    if (existingSlug) slug = `${slug}-${Date.now().toString().slice(-4)}`;

    const id = `prog-${Date.now()}`;
    const newEvent = new Event({
      id,
      sequenceNumber,
      name,
      shortName: shortName || '',
      slug,
      city: city || '',
      venue: venue || '',
      venueAddress: venueAddress || '',
      mapUrl: mapUrl || '',
      description: description || '',
      headline: headline || '',
      subheadline: subheadline || '',
      highlights: Array.isArray(highlights) ? highlights : [],
      instructions: instructions || '',
      heroImage: heroImage || '',
      posterImage: posterImage || '',
      price: price !== undefined ? Number(price) : 1500,
      currency: currency || 'INR',
      contactPhone: contactPhone || '',
      contactWhatsapp: contactWhatsapp || '',
      contactEmail: contactEmail || '',
      speakerName: speakerName || '',
      speakerTitle: speakerTitle || '',
      speakerImage: speakerImage || '',
      speakerBio: speakerBio || '',
      ctaLabel: ctaLabel || '',
      passTitle: passTitle || '',
      passInstructions: passInstructions || '',
      seoTitle: seoTitle || '',
      seoDescription: seoDescription || '',
      status: status || 'upcoming',
      registrationMode: registrationMode || 'internal',
      externalRegistrationUrl: externalRegistrationUrl || '',
      featured: featured === true || featured === 'true',
      sortOrder: sortOrder ? Number(sortOrder) : 0,
      date,
      time: time || '8:30 PM',
      capacity: Number(capacity),
      isDateFinal: isDateFinal !== undefined ? (isDateFinal === true || isDateFinal === 'true') : true,
      isInquiryClosed: isInquiryClosed === true || isInquiryClosed === 'true',
      heartX: heartX !== undefined ? Number(heartX) : 157,
      heartY: heartY !== undefined ? Number(heartY) : 91,
      heartWidth: heartWidth !== undefined ? Number(heartWidth) : 260,
      heartHeight: heartHeight !== undefined ? Number(heartHeight) : 312,
      photoZoom: photoZoom !== undefined ? Number(photoZoom) : 0.55,
      photoOffsetY: photoOffsetY !== undefined ? Number(photoOffsetY) : 0,
      photoLink: photoLink || ''
    });

    await newEvent.save();
    eventService.invalidateCache();
    invalidateDashboardCache();
    res.status(201).json({ success: true, message: 'Event program created successfully.', program: newEvent });
  } catch (err) {
    res.status(500).json({ error: `Server error creating event: ${err.message}` });
  }
};

import { communicationSchedulerService } from '../../services/communicationScheduler.service.js';

export const updateEvent = async (req, res) => {
  const { id } = req.params;
  try {
    const event = await Event.findOne({
      $or: [
        { id },
        { slug: id },
        { date: id },
        ...(typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
      ]
    });
    if (!event) return res.status(404).json({ error: 'Event program not found.' });


    const previousDate = event.date;
    const previousTime = event.time;
    const previousVenue = event.venue;
    const previousName = event.name;
    const previousStatus = event.status;
    const previousCardTemplate = event.cardTemplate || event.cardTemplateUrl;
    const previousHeartX = event.heartX;
    const previousHeartY = event.heartY;
    const previousHeartWidth = event.heartWidth;
    const previousHeartHeight = event.heartHeight;
    const previousPhotoZoom = event.photoZoom;
    const previousPhotoOffsetY = event.photoOffsetY;

    const updates = { ...req.body };
    delete updates.id;
    delete updates.sequenceNumber;
    delete updates.archiveStats;
    delete updates.archiveStatus;

    if (updates.capacity !== undefined) {
      updates.capacity = Number(updates.capacity);
    }
    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.sortOrder !== undefined) updates.sortOrder = Number(updates.sortOrder);
    if (updates.heartX !== undefined) updates.heartX = Number(updates.heartX);
    if (updates.heartY !== undefined) updates.heartY = Number(updates.heartY);
    if (updates.heartWidth !== undefined) updates.heartWidth = Number(updates.heartWidth);
    if (updates.heartHeight !== undefined) updates.heartHeight = Number(updates.heartHeight);
    if (updates.photoZoom !== undefined) updates.photoZoom = Number(updates.photoZoom);
    if (updates.photoOffsetY !== undefined) updates.photoOffsetY = Number(updates.photoOffsetY);
    if (updates.photoLink !== undefined) updates.photoLink = String(updates.photoLink).trim();

    if (updates.cardTemplate !== undefined || updates.cardTemplateUrl !== undefined) {
      const tpl = updates.cardTemplate || updates.cardTemplateUrl;
      if (tpl && String(tpl).trim()) {
        const cleanTpl = String(tpl).trim();
        updates.cardTemplate = cleanTpl;
        updates.cardTemplateUrl = cleanTpl;
      } else if (req.body.clearCardTemplate === true) {
        updates.cardTemplate = null;
        updates.cardTemplateUrl = '';
      } else {
        delete updates.cardTemplate;
        delete updates.cardTemplateUrl;
      }
    }

    // Dynamic capacity & status normalization:
    // Ensure that increasing capacity automatically re-opens booking, and reaching capacity marks housefull
    const targetCapacity = updates.capacity !== undefined ? Number(updates.capacity) : (event.capacity || 1000);
    const approvedCount = await Registration.countDocuments({
      programId: { $in: [event.id, event.slug, event.date, id].filter(Boolean) },
      status: 'approved',
      isDeleted: { $ne: true }
    });

    const isCapacityReached = targetCapacity > 0 && approvedCount >= targetCapacity;

    if (isCapacityReached) {
      if (updates.status !== 'completed' && updates.status !== 'archived') {
        updates.status = 'housefull';
        updates.isHousefull = true;
      }
    } else {
      // Capacity is not full: if status was or is 'housefull', auto-reopen to 'few_seats' or 'upcoming'
      if (updates.status === 'housefull' || (!updates.status && event.status === 'housefull')) {
        updates.status = (targetCapacity > 0 && (approvedCount / targetCapacity >= 0.85)) ? 'few_seats' : 'upcoming';
      }
      updates.isHousefull = false;
      if (event.status === 'housefull' && event.isInquiryClosed) {
        updates.isInquiryClosed = false;
        updates.isRegistrationOpen = true;
      }
    }
    updates.bookingsCount = approvedCount;

    Object.assign(event, updates);
    await event.save();
    eventService.invalidateCache();
    invalidateDashboardCache();

    // Invalidate cached invitation cards so newly uploaded template/coordinates reflect everywhere
    const cardVisualsChanged = (previousCardTemplate !== (event.cardTemplate || event.cardTemplateUrl)) ||
      (previousHeartX !== event.heartX) ||
      (previousHeartY !== event.heartY) ||
      (previousHeartWidth !== event.heartWidth) ||
      (previousHeartHeight !== event.heartHeight) ||
      (previousPhotoZoom !== event.photoZoom) ||
      (previousPhotoOffsetY !== event.photoOffsetY);

    if (cardVisualsChanged) {
      await Registration.updateMany(
        { programId: { $in: [event.id, event.slug, id].filter(Boolean) } },
        { $set: { invitationHash: null, invitationCardUrl: null, invitationKey: null } }
      );
      // Invalidate queued WhatsApp invitation messages so freshest rendered card is attached
      await WhatsappMessage.updateMany(
        {
          eventId: { $in: [event.id, event.slug, id].filter(Boolean) },
          status: 'QUEUED',
          $or: [
            { messageType: 'invitation' },
            { templateName: 'edkl_personal_invitation_24h_v2' }
          ]
        },
        {
          $set: {
            'templateParameters.headerImageUrl': null,
            'templateParameters.imageUrl': null,
            'templateParameters.invitationImageUrl': null
          }
        }
      );
    }

    // Trigger schedule & registration cascades if details changed
    const scheduleOrDetailsChanged = previousDate !== event.date || previousTime !== event.time || previousVenue !== event.venue || previousName !== event.name;
    if (scheduleOrDetailsChanged) {
      await Registration.updateMany(
        { programId: { $in: [event.id, event.slug, id].filter(Boolean) } },
        {
          $set: {
            programDate: event.date,
            programTime: event.time,
            programVenue: event.venue,
            programName: event.name
          }
        }
      );
      await communicationSchedulerService.handleEventDetailsUpdated(event);
    }

    if (event.status === 'cancelled' && previousStatus !== 'cancelled') {
      await communicationSchedulerService.handleEventCancelled(event, { notifyAttendees: Boolean(req.body.notifyAttendees) });
    }

    res.json({ success: true, message: 'Event program updated successfully.', program: event });
  } catch (err) {
    res.status(500).json({ error: `Server error updating event: ${err.message}` });
  }
};

export const duplicateEvent = async (req, res) => {
  const { id } = req.params;
  try {
    const source = await Event.findOne({ id }).lean();
    if (!source) return res.status(404).json({ error: 'Source event not found to duplicate.' });

    const maxProg = await Event.findOne({ sequenceNumber: { $exists: true } }).sort({ sequenceNumber: -1 });
    const sequenceNumber = maxProg && maxProg.sequenceNumber ? maxProg.sequenceNumber + 1 : 1;

    const newId = `prog-${Date.now()}`;
    const newName = `${source.name} (Copy)`;
    const newSlug = `${source.slug || generateEventSlug(source.name, source.city, 'TBD')}-${Date.now().toString().slice(-4)}`;

    const clonedEvent = new Event({
      ...source,
      _id: undefined,
      id: newId,
      sequenceNumber,
      name: newName,
      slug: newSlug,
      date: 'TBD',
      status: 'upcoming',
      isDateFinal: false,
      bookingsCount: 0,
      archiveStatus: 'NOT_REQUIRED',
      archiveScheduledAt: null,
      archiveRequestedAt: null,
      archiveStartedAt: null,
      archiveCompletedAt: null,
      archiveStats: {
        totalAssets: 0,
        queuedAssets: 0,
        copyingAssets: 0,
        archivedAssets: 0,
        failedAssets: 0,
        totalBytes: 0,
        lastWorkerAt: null
      }
    });

    await clonedEvent.save();
    eventService.invalidateCache();
    res.status(201).json({ success: true, message: 'Event duplicated successfully.', program: clonedEvent });
  } catch (err) {
    res.status(500).json({ error: `Server error duplicating event: ${err.message}` });
  }
};

export const deleteEvent = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Event.findOneAndDelete({ id });
    if (!deleted) return res.status(404).json({ error: 'Event program not found.' });
    eventService.invalidateCache();
    invalidateDashboardCache();
    res.json({ success: true, message: 'Event program deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: `Server error deleting event: ${err.message}` });
  }
};

export const getEnablePaymentPreview = async (req, res) => {
  const { id } = req.params;
  try {
    const preview = await eventService.getEnablePaymentPreview(id);
    res.json({ success: true, preview });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error fetching payment activation preview.' });
  }
};

export const enablePaymentAndCommunications = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await eventService.enablePaymentAndCommunications(id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error activating payment & communications.' });
  }
};

export const uploadCardTemplate = async (req, res) => {
  const { id } = req.params;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No template image file provided.' });
    }

    const event = await Event.findOne({
      $or: [
        { id },
        { slug: id },
        { date: id },
        ...(typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
      ]
    });
    if (!event) return res.status(404).json({ error: 'Event program not found.' });

    // Upload to Cloudinary / storage service
    const base64Data = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const uploadedUrl = await storageService.upload({
      data: base64Data,
      folder: 'event-templates',
      filename: `card_template_${event.id || event.slug}_${Date.now()}`
    });

    event.cardTemplate = uploadedUrl;
    event.cardTemplateUrl = uploadedUrl;
    await event.save();
    await Registration.updateMany(
      { programId: { $in: [event.id, event.slug, id].filter(Boolean) } },
      { $set: { invitationHash: null, invitationCardUrl: null } }
    );
    eventService.invalidateCache();

    res.json({
      success: true,
      message: 'Invitation card template uploaded successfully.',
      cardTemplate: uploadedUrl,
      cardTemplateUrl: uploadedUrl,
      program: event
    });
  } catch (err) {
    console.error('[uploadCardTemplate Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to upload card template.' });
  }
};

export const uploadEventAsset = async (req, res) => {
  const { id } = req.params;
  const assetType = req.body.assetType || 'heroImage';
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    const base64Data = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const uploadedUrl = await storageService.upload({
      data: base64Data,
      folder: 'event-assets',
      filename: `event_${assetType}_${id || Date.now()}_${Date.now()}`
    });

    if (id && id !== 'new') {
      const event = await Event.findOne({
        $or: [
          { id },
          { slug: id },
          { date: id },
          ...(typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
        ]
      });
      if (event) {
        if (assetType === 'heroImage') event.heroImage = uploadedUrl;
        else if (assetType === 'posterImage') event.posterImage = uploadedUrl;
        else if (assetType === 'speakerImage') event.speakerImage = uploadedUrl;
        else if (assetType === 'cardTemplate') {
          event.cardTemplate = uploadedUrl;
          event.cardTemplateUrl = uploadedUrl;
          await Registration.updateMany(
            { programId: { $in: [event.id, event.slug, id].filter(Boolean) } },
            { $set: { invitationHash: null, invitationCardUrl: null } }
          );
        }
        await event.save();
        eventService.invalidateCache();
      }
    }

    res.json({
      success: true,
      message: 'Image uploaded successfully.',
      url: uploadedUrl,
      assetType
    });
  } catch (err) {
    console.error('[uploadEventAsset Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to upload image.' });
  }
};

