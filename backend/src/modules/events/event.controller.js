import { eventService } from './event.service.js';
import { Event } from '../../models/Event.js';
import { generateEventSlug } from '../../utils/slug.js';

export const getPublicEvents = async (req, res) => {
  try {
    const events = await eventService.getPublicEvents();
    res.setHeader('Cache-Control', 'public, max-age=180, s-maxage=300, stale-while-revalidate=60');
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching events.' });
  }
};

export const getEventBySlug = async (req, res) => {
  try {
    const event = await eventService.getEventBySlug(req.params.slug);
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=180, stale-while-revalidate=30');
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching event details.' });
  }
};

export const getAdminEvents = async (req, res) => {
  try {
    const events = await eventService.getAdminEvents();
    res.setHeader('Cache-Control', 'no-store');
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching admin events.' });
  }
};

export const createEvent = async (req, res) => {
  const { name, date, time, capacity, price, city, venue, mapUrl, description, heroImage, registrationMode, externalRegistrationUrl, featured, sortOrder, isDateFinal, isInquiryClosed, heartX, heartY, heartWidth, heartHeight, photoZoom, photoOffsetY } = req.body;
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
      slug,
      city: city || '',
      venue: venue || '',
      mapUrl: mapUrl || '',
      description: description || '',
      heroImage: heroImage || '',
      price: price !== undefined ? Number(price) : 1500,
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
      photoOffsetY: photoOffsetY !== undefined ? Number(photoOffsetY) : 0
    });

    await newEvent.save();
    eventService.invalidateCache();
    res.status(201).json({ success: true, message: 'Event program created successfully.', program: newEvent });
  } catch (err) {
    res.status(500).json({ error: `Server error creating event: ${err.message}` });
  }
};

export const updateEvent = async (req, res) => {
  const { id } = req.params;
  try {
    const event = await Event.findOne({ id });
    if (!event) return res.status(404).json({ error: 'Event program not found.' });

    const updates = { ...req.body };
    delete updates.id;
    delete updates.sequenceNumber;

    if (updates.capacity) updates.capacity = Number(updates.capacity);
    if (updates.price !== undefined) updates.price = Number(updates.price);

    Object.assign(event, updates);
    await event.save();
    eventService.invalidateCache();

    res.json({ success: true, message: 'Event program updated successfully.', program: event });
  } catch (err) {
    res.status(500).json({ error: `Server error updating event: ${err.message}` });
  }
};

export const deleteEvent = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Event.findOneAndDelete({ id });
    if (!deleted) return res.status(404).json({ error: 'Event program not found.' });
    eventService.invalidateCache();
    res.json({ success: true, message: 'Event program deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: `Server error deleting event: ${err.message}` });
  }
};
