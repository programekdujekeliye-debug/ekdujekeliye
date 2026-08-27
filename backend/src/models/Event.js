import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema({
  id: { type: String, required: true },
  sequenceNumber: { type: Number, default: 1 },
  name: { type: String, required: true },
  slug: { type: String },
  city: { type: String, default: '' },
  venue: { type: String, default: '' },
  mapUrl: { type: String, default: '' },
  description: { type: String, default: '' },
  heroImage: { type: String, default: '' },
  price: { type: Number, default: 1500 },
  status: {
    type: String,
    enum: ['upcoming', 'few_seats', 'housefull', 'registration_closed', 'completed', 'archived', 'date_tba'],
    default: 'upcoming'
  },
  featured: { type: Boolean, default: false },
  registrationMode: { type: String, enum: ['internal', 'external'], default: 'internal' },
  externalRegistrationUrl: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 },
  date: { type: String, required: true },
  time: { type: String, default: '8:30 PM' },
  capacity: { type: Number, required: true },
  bookingsCount: { type: Number, default: 0 },
  isDateFinal: { type: Boolean, default: true },
  cardTemplate: { type: String, default: null },
  heartX: { type: Number, default: 157 },
  heartY: { type: Number, default: 91 },
  heartWidth: { type: Number, default: 260 },
  heartHeight: { type: Number, default: 312 },
  photoZoom: { type: Number, default: 0.55 },
  photoOffsetY: { type: Number, default: 0 },
  photoLink: { type: String, default: '' },
  isInquiryClosed: { type: Boolean, default: false },
  archiveStatus: {
    type: String,
    enum: ['NOT_REQUIRED', 'WAITING', 'QUEUED', 'ARCHIVING', 'VERIFYING', 'ARCHIVED', 'PARTIAL', 'FAILED'],
    default: 'NOT_REQUIRED'
  },
  archiveAfterDays: { type: Number, default: 7 },
  archiveScheduledAt: { type: Date, default: null },
  archiveCompletedAt: { type: Date, default: null },
  archiveStats: {
    totalAssets: { type: Number, default: 0 },
    archivedAssets: { type: Number, default: 0 },
    failedAssets: { type: Number, default: 0 },
    totalBytes: { type: Number, default: 0 }
  }
}, {
  collection: 'program',
  timestamps: true
});

EventSchema.index({ id: 1 }, { unique: true });
EventSchema.index({ slug: 1 });
EventSchema.index({ status: 1, date: 1 });

export const Event = mongoose.models.Program || mongoose.model('Program', EventSchema);
export const EventModel = Event;
