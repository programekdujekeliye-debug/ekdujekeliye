'use client';

import React, { useState, useRef } from 'react';
import { useAdmin } from '../context/AdminContext';
import { eventsApi } from '../../../services/admin/eventsApi';
import { Program } from '../../../types';
import { LuxurySelect, SelectOption } from '../../../components/LuxurySelect';
import {
  MapPinIcon,
  CalendarIcon,
  UsersIcon,
  BuildingIcon,
  PencilIcon,
  TrashIcon,
  LayersIcon,
  CheckIcon,
  AlertTriangleIcon,
  XIcon,
  ImageIcon,
  SparklesIcon,
  ClockIcon,
  DollarSignIcon,
  PhoneIcon,
  UploadIcon,
  SearchIcon,
  TicketIcon,
  ShieldCheckIcon
} from '../../../components/Icons';
import toast from 'react-hot-toast';

type SectionId = 'schedule' | 'pricing' | 'media' | 'invitation' | 'speaker' | 'pass_seo';

interface SectionConfig {
  id: SectionId;
  stepNumber: string;
  title: string;
  subtitle: string;
  icon: React.FC<{ className?: string }>;
}

const SECTIONS: SectionConfig[] = [
  {
    id: 'schedule',
    stepNumber: '01',
    title: 'Schedule & Venue',
    subtitle: 'Date, time, city, venue & Google Maps link',
    icon: CalendarIcon
  },
  {
    id: 'pricing',
    stepNumber: '02',
    title: 'Capacity & Pricing',
    subtitle: 'Couples limit, ticket price, status & registration mode',
    icon: DollarSignIcon
  },
  {
    id: 'media',
    stepNumber: '03',
    title: 'Visual Media & Banners',
    subtitle: 'Hero banner, poster image & event highlights',
    icon: ImageIcon
  },
  {
    id: 'invitation',
    stepNumber: '04',
    title: 'Invitation Card PNG',
    subtitle: 'Event-specific PNG template & heart cutout coordinates',
    icon: SparklesIcon
  },
  {
    id: 'speaker',
    stepNumber: '05',
    title: 'Host & Helpline',
    subtitle: 'Speaker credentials, support phone & WhatsApp',
    icon: PhoneIcon
  },
  {
    id: 'pass_seo',
    stepNumber: '06',
    title: 'Pass & SEO Guidelines',
    subtitle: 'Pass instructions & search meta tags',
    icon: ShieldCheckIcon
  }
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'upcoming', label: 'Upcoming (Open for Registrations)', badge: 'Upcoming' },
  { value: 'few_seats', label: 'Few Seats Left (High Demand)', badge: 'Few Seats' },
  { value: 'housefull', label: 'Housefull (Sold Out / Capacity Full)', badge: 'Housefull' },
  { value: 'registration_closed', label: 'Registration Closed', badge: 'Closed' },
  { value: 'date_tba', label: 'Date TBA (To Be Announced)', badge: 'Date TBA' },
  { value: 'completed', label: 'Completed Seminar', badge: 'Completed' },
  { value: 'archived', label: 'Archived', badge: 'Archived' }
];

const REGISTRATION_MODE_OPTIONS: SelectOption[] = [
  { value: 'internal', label: 'Internal (Website Booking & Razorpay)', badge: 'Standard' },
  { value: 'external', label: 'External (Redirect to External URL)', badge: 'External' }
];

export const EventsPage: React.FC = () => {
  const { programs, refreshPrograms, loadingPrograms, role } = useAdmin();
  const isSuperAdmin = role === 'superadmin';

  // Modal State
  const [activeSection, setActiveSection] = useState<SectionId>('schedule');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);

  // Mobile Accordion Open States (Allows tapping to expand any section on mobile)
  const [mobileOpenSections, setMobileOpenSections] = useState<Record<SectionId, boolean>>({
    schedule: true,
    pricing: false,
    media: false,
    invitation: false,
    speaker: false,
    pass_seo: false
  });

  // Asset Uploading State
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Program>>({
    name: '',
    shortName: '',
    slug: '',
    date: '',
    time: '8:30 PM',
    price: 1500,
    currency: 'INR',
    city: 'Surat',
    venue: '',
    venueAddress: '',
    mapUrl: '',
    description: '',
    headline: '',
    subheadline: '',
    instructions: '',
    heroImage: '',
    posterImage: '',
    contactPhone: '+91 82003 02328',
    contactWhatsapp: '+91 82003 02328',
    contactEmail: '',
    speakerName: 'Manish Vaghasiya',
    speakerTitle: 'Couple Relationship Counselor & Life Coach',
    speakerImage: '',
    speakerBio: '',
    ctaLabel: 'Book Couple Pass',
    passTitle: '',
    passInstructions: '',
    seoTitle: '',
    seoDescription: '',
    status: 'upcoming',
    registrationMode: 'internal',
    externalRegistrationUrl: '',
    capacity: 1000,
    isDateFinal: true,
    isInquiryClosed: false,
    cardTemplate: '',
    cardTemplateUrl: '',
    heartX: 157,
    heartY: 91,
    heartWidth: 260,
    heartHeight: 312,
    photoZoom: 0.55,
    photoOffsetY: 0,
    photoLink: ''
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'upcoming' | 'tbd' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fileInputHeroRef = useRef<HTMLInputElement>(null);
  const fileInputPosterRef = useRef<HTMLInputElement>(null);
  const fileInputSpeakerRef = useRef<HTMLInputElement>(null);
  const fileInputCardRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFormData({
      name: '',
      shortName: '',
      slug: '',
      date: '',
      time: '8:30 PM',
      price: 1500,
      currency: 'INR',
      city: 'Surat',
      venue: '',
      venueAddress: '',
      mapUrl: '',
      description: '',
      headline: '',
      subheadline: '',
      instructions: '',
      heroImage: '',
      posterImage: '',
      contactPhone: '+91 82003 02328',
      contactWhatsapp: '+91 82003 02328',
      contactEmail: '',
      speakerName: 'Manish Vaghasiya',
      speakerTitle: 'Couple Relationship Counselor & Life Coach',
      speakerImage: '',
      speakerBio: '',
      ctaLabel: 'Book Couple Pass',
      passTitle: '',
      passInstructions: '',
      seoTitle: '',
      seoDescription: '',
      status: 'upcoming',
      registrationMode: 'internal',
      externalRegistrationUrl: '',
      capacity: 1000,
      isDateFinal: true,
      isInquiryClosed: false,
      cardTemplate: '',
      cardTemplateUrl: '',
      heartX: 157,
      heartY: 91,
      heartWidth: 260,
      heartHeight: 312,
      photoZoom: 0.55,
      photoOffsetY: 0,
      photoLink: ''
    });
    setEditingProgram(null);
    setActiveSection('schedule');
    setMobileOpenSections({
      schedule: true,
      pricing: false,
      media: false,
      invitation: false,
      speaker: false,
      pass_seo: false
    });
    setError('');
    setUploadingField(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleStartEdit = (prog: Program) => {
    setEditingProgram(prog);
    setFormData({
      ...prog,
      isDateFinal: prog.isDateFinal !== false,
      price: prog.price !== undefined ? prog.price : 1500,
      capacity: prog.capacity || 1000,
      cardTemplate: prog.cardTemplate || prog.cardTemplateUrl || '',
      cardTemplateUrl: prog.cardTemplateUrl || prog.cardTemplate || '',
      photoLink: prog.photoLink || ''
    });
    setActiveSection('schedule');
    setMobileOpenSections({
      schedule: true,
      pricing: false,
      media: false,
      invitation: false,
      speaker: false,
      pass_seo: false
    });
    setError('');
    setUploadingField(null);
    setIsModalOpen(true);
  };

  const toggleMobileSection = (secId: SectionId) => {
    setMobileOpenSections((prev) => ({
      ...prev,
      [secId]: !prev[secId]
    }));
    setActiveSection(secId);
  };

  const handleDuplicate = async (prog: Program) => {
    if (!confirm(`Duplicate "${prog.name}" to create a new event slot?`)) return;
    try {
      setDuplicatingId(prog.id);
      await eventsApi.duplicateEvent(prog.id);
      await refreshPrograms();
      toast.success(`Event "${prog.name}" duplicated successfully.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to duplicate event.');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete event "${name}"?`)) return;
    try {
      await eventsApi.deleteEvent(id);
      await refreshPrograms();
      toast.success(`Event "${name}" deleted.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete event.');
    }
  };

  // Direct Image File Upload Handler
  const handleDirectAssetUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    assetType: 'heroImage' | 'posterImage' | 'speakerImage' | 'cardTemplate'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (PNG, JPEG, WebP).');
      return;
    }

    try {
      setUploadingField(assetType);
      const res = await eventsApi.uploadEventAsset(editingProgram?.id, file, assetType);
      if (res.success && res.url) {
        if (assetType === 'cardTemplate') {
          setFormData((prev) => ({ ...prev, cardTemplate: res.url, cardTemplateUrl: res.url }));
        } else {
          setFormData((prev) => ({ ...prev, [assetType]: res.url }));
        }
        toast.success(`${assetType === 'cardTemplate' ? 'Invitation card PNG' : 'Image'} uploaded successfully!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload image.');
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || (formData.isDateFinal && !formData.date) || !formData.capacity) {
      toast.error('Please fill in required fields: Name, Date, and Capacity.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      if (editingProgram) {
        await eventsApi.updateEvent(editingProgram.id, formData);
        toast.success(`Event "${formData.name}" updated successfully.`);
      } else {
        await eventsApi.createEvent(formData);
        toast.success(`Event "${formData.name}" created successfully.`);
      }

      setIsModalOpen(false);
      resetForm();
      await refreshPrograms();
    } catch (err: any) {
      const msg = err.message || 'Failed to save event.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Dynamic Categorization & Search
  const todayStr = new Date().toISOString().split('T')[0];
  const sortedPrograms = [...programs].sort((a, b) => {
    const isATbd = a.date === 'TBD' || a.date === 'TBA' || a.status === 'date_tba' || a.isDateFinal === false || !a.date;
    const isAComp = a.status === 'completed' || a.status === 'archived' || (a.date < todayStr && !isATbd);
    const rankA = isAComp ? 3 : isATbd ? 2 : 1;

    const isBTbd = b.date === 'TBD' || b.date === 'TBA' || b.status === 'date_tba' || b.isDateFinal === false || !b.date;
    const isBComp = b.status === 'completed' || b.status === 'archived' || (b.date < todayStr && !isBTbd);
    const rankB = isBComp ? 3 : isBTbd ? 2 : 1;

    if (rankA !== rankB) return rankA - rankB;
    if (rankA === 1) return (a.date || '').localeCompare(b.date || '') || (a.sequenceNumber || 0) - (b.sequenceNumber || 0);
    if (rankA === 2) return (a.sequenceNumber || 0) - (b.sequenceNumber || 0) || (a.name || '').localeCompare(b.name || '');
    return (b.date || '').localeCompare(a.date || '') || (b.sequenceNumber || 0) - (a.sequenceNumber || 0);
  });

  const filteredPrograms = sortedPrograms.filter((p) => {
    const isTbd = p.date === 'TBD' || p.date === 'TBA' || p.status === 'date_tba' || p.isDateFinal === false || !p.date;
    const isCompleted = p.status === 'completed' || p.status === 'archived' || (p.date < todayStr && !isTbd);
    const isUpcoming = !isCompleted && !isTbd;

    if (categoryFilter === 'upcoming' && !isUpcoming) return false;
    if (categoryFilter === 'tbd' && !isTbd) return false;
    if (categoryFilter === 'completed' && !isCompleted) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchCity = (p.city || '').toLowerCase().includes(q);
      const matchVenue = (p.venue || '').toLowerCase().includes(q);
      const matchDate = (p.date || '').toLowerCase().includes(q);
      if (!matchName && !matchCity && !matchVenue && !matchDate) return false;
    }

    return true;
  });

  const upcomingCount = programs.filter((p) => {
    const isTbd = p.date === 'TBD' || p.date === 'TBA' || p.status === 'date_tba' || p.isDateFinal === false || !p.date;
    const isCompleted = p.status === 'completed' || p.status === 'archived' || (p.date < todayStr && !isTbd);
    return !isCompleted && !isTbd;
  }).length;

  const tbdCount = programs.filter(
    (p) => p.date === 'TBD' || p.date === 'TBA' || p.status === 'date_tba' || p.isDateFinal === false || !p.date
  ).length;

  const completedCount = programs.filter(
    (p) => p.status === 'completed' || p.status === 'archived' || (p.date < todayStr && p.date !== 'TBD' && p.date !== 'TBA')
  ).length;

  // Helper to step through sections
  const goToNextSection = (currentId: SectionId) => {
    const idx = SECTIONS.findIndex((s) => s.id === currentId);
    if (idx < SECTIONS.length - 1) {
      const nextId = SECTIONS[idx + 1].id;
      setActiveSection(nextId);
      setMobileOpenSections((prev) => ({
        ...prev,
        [currentId]: false,
        [nextId]: true
      }));
    }
  };

  const goToPrevSection = (currentId: SectionId) => {
    const idx = SECTIONS.findIndex((s) => s.id === currentId);
    if (idx > 0) {
      const prevId = SECTIONS[idx - 1].id;
      setActiveSection(prevId);
      setMobileOpenSections((prev) => ({
        ...prev,
        [currentId]: false,
        [prevId]: true
      }));
    }
  };

  // Section Form Renderers
  const renderScheduleFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-stone-700 mb-1">
            Event Program Title *
          </label>
          <input
            type="text"
            required
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Ek Duje Ke Liye - Sardar Patel Smruti Bhavan"
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">
            City *
          </label>
          <input
            type="text"
            required
            value={formData.city || ''}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="e.g. Surat"
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">
            Short Name (Optional)
          </label>
          <input
            type="text"
            value={formData.shortName || ''}
            onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
            placeholder="e.g. Surat Seminar"
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>

        {/* Date Confirmation Switch */}
        <div className="sm:col-span-2 flex items-center justify-between p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
          <div className="pr-2">
            <span className="text-xs font-extrabold text-stone-900 block">
              Confirmed Event Date
            </span>
            <span className="text-[11px] text-stone-500 block leading-tight">
              Toggle OFF if date is not finalized yet (will display as "Date To Be Announced").
            </span>
          </div>
          <input
            type="checkbox"
            checked={formData.isDateFinal}
            onChange={(e) => setFormData({ ...formData, isDateFinal: e.target.checked })}
            className="w-5 h-5 text-rose-600 rounded cursor-pointer accent-rose-600 flex-shrink-0"
          />
        </div>

        {formData.isDateFinal && (
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Event Date *</label>
            <input
              type="date"
              required={formData.isDateFinal}
              value={formData.date || ''}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">Seminar Time</label>
          <input
            type="text"
            value={formData.time || '8:30 PM'}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            placeholder="8:30 PM"
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-stone-700 mb-1">
            URL Slug (Leave blank to auto-generate)
          </label>
          <input
            type="text"
            value={formData.slug || ''}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            placeholder="e.g. surat-7-september-2026"
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-stone-700 mb-1">Venue Name</label>
          <input
            type="text"
            value={formData.venue || ''}
            onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
            placeholder="e.g. Sardar Patel Smruti Bhavan, Varachha"
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-stone-700 mb-1">Full Venue Address</label>
          <input
            type="text"
            value={formData.venueAddress || ''}
            onChange={(e) => setFormData({ ...formData, venueAddress: e.target.value })}
            placeholder="Detailed road, landmark, city, pincode..."
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-stone-700 mb-1">Google Maps Link</label>
          <input
            type="url"
            value={formData.mapUrl || ''}
            onChange={(e) => setFormData({ ...formData, mapUrl: e.target.value })}
            placeholder="https://maps.app.goo.gl/..."
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>
    </div>
  );

  const renderPricingFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">
            Total Couple Capacity *
          </label>
          <input
            type="number"
            required
            value={formData.capacity || ''}
            onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
            placeholder="e.g. 500"
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">
            Couple Pass Fee (₹ INR) *
          </label>
          <input
            type="number"
            required
            value={formData.price !== undefined ? formData.price : 1500}
            onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
            placeholder="1500"
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>

        {/* Status Dropdown using LuxurySelect */}
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">
            Event Slot Status
          </label>
          <LuxurySelect
            value={formData.status || 'upcoming'}
            onChange={(val) => setFormData({ ...formData, status: val })}
            options={STATUS_OPTIONS}
            variant="outline"
          />
        </div>

        {/* Registration Mode using LuxurySelect */}
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">
            Registration Mode
          </label>
          <LuxurySelect
            value={formData.registrationMode || 'internal'}
            onChange={(val) => setFormData({ ...formData, registrationMode: val as any })}
            options={REGISTRATION_MODE_OPTIONS}
            variant="outline"
          />
        </div>

        {formData.registrationMode === 'external' && (
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-stone-700 mb-1">
              External Registration Redirect URL *
            </label>
            <input
              type="url"
              required
              value={formData.externalRegistrationUrl || ''}
              onChange={(e) => setFormData({ ...formData, externalRegistrationUrl: e.target.value })}
              placeholder="https://event-link.com"
              className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>
        )}

        {/* Pause Registrations Toggle */}
        <div className="sm:col-span-2 flex items-center justify-between p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
          <div className="pr-2">
            <span className="text-xs font-extrabold text-stone-900 block">
              Temporarily Close / Pause Inquiries
            </span>
            <span className="text-[11px] text-stone-500 block leading-tight">
              If checked, public visitors cannot submit registrations for this slot.
            </span>
          </div>
          <input
            type="checkbox"
            checked={formData.isInquiryClosed || false}
            onChange={(e) => setFormData({ ...formData, isInquiryClosed: e.target.checked })}
            className="w-5 h-5 text-rose-600 rounded cursor-pointer accent-rose-600 flex-shrink-0"
          />
        </div>
      </div>
    </div>
  );

  const renderMediaFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hero Banner Upload */}
        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
          <span className="text-xs font-bold text-stone-900 block">Hero Banner Image</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputHeroRef.current?.click()}
              disabled={uploadingField === 'heroImage'}
              className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50 min-h-[40px]"
            >
              <UploadIcon className="w-3.5 h-3.5" />
              <span>{uploadingField === 'heroImage' ? 'Uploading...' : 'Upload Banner'}</span>
            </button>
            <input
              ref={fileInputHeroRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleDirectAssetUpload(e, 'heroImage')}
            />
            {formData.heroImage && (
              <button
                type="button"
                onClick={() => setFormData({ ...formData, heroImage: '' })}
                className="text-xs text-rose-700 font-bold hover:underline cursor-pointer"
              >
                Remove
              </button>
            )}
          </div>

          <input
            type="text"
            value={formData.heroImage || ''}
            onChange={(e) => setFormData({ ...formData, heroImage: e.target.value })}
            placeholder="Or paste direct image URL..."
            className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-mono text-stone-800"
          />

          {formData.heroImage && (
            <div className="relative w-full h-28 sm:h-32 rounded-xl overflow-hidden border border-stone-300">
              <img src={formData.heroImage} alt="Hero Banner" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {/* Poster Image Upload */}
        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
          <span className="text-xs font-bold text-stone-900 block">Poster / Thumbnail Image</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputPosterRef.current?.click()}
              disabled={uploadingField === 'posterImage'}
              className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50 min-h-[40px]"
            >
              <UploadIcon className="w-3.5 h-3.5" />
              <span>{uploadingField === 'posterImage' ? 'Uploading...' : 'Upload Poster'}</span>
            </button>
            <input
              ref={fileInputPosterRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleDirectAssetUpload(e, 'posterImage')}
            />
            {formData.posterImage && (
              <button
                type="button"
                onClick={() => setFormData({ ...formData, posterImage: '' })}
                className="text-xs text-rose-700 font-bold hover:underline cursor-pointer"
              >
                Remove
              </button>
            )}
          </div>

          <input
            type="text"
            value={formData.posterImage || ''}
            onChange={(e) => setFormData({ ...formData, posterImage: e.target.value })}
            placeholder="Or paste direct poster URL..."
            className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-mono text-stone-800"
          />

          {formData.posterImage && (
            <div className="relative w-full h-28 sm:h-32 rounded-xl overflow-hidden border border-stone-300">
              <img src={formData.posterImage} alt="Poster" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {/* Event Photo Memories / Photographer Album Link */}
        <div className="sm:col-span-2 p-4 bg-rose-50/70 rounded-2xl border border-rose-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
              📸 Event Digital Memories / Photo Album Link
            </span>
            <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100/90 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Post-Event Link
            </span>
          </div>
          <p className="text-[11px] text-stone-600 leading-relaxed">
            Paste the photographer&apos;s album URL (e.g. BlinkPic with Ucode, Google Drive, or Google Photos). When attendees click &quot;View Event Photos&quot; on WhatsApp, this link will open on their digital memories page.
          </p>
          <input
            type="url"
            value={formData.photoLink || ''}
            onChange={(e) => setFormData({ ...formData, photoLink: e.target.value })}
            placeholder="https://blinkpic.in/auth/login?groupCode=X5ZHM6 or Google Drive link"
            className="w-full px-3.5 py-2.5 bg-white border border-rose-300 rounded-xl text-base sm:text-xs font-mono text-stone-900 focus:outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600"
          />
          {formData.photoLink && (
            <div className="flex items-center justify-between text-[11px] text-rose-800 bg-white/80 px-3 py-1.5 rounded-lg border border-rose-200">
              <span className="truncate max-w-[280px] sm:max-w-md">Target: {formData.photoLink}</span>
              <a
                href={formData.photoLink}
                target="_blank"
                rel="noreferrer"
                className="font-bold underline hover:text-rose-950 shrink-0 ml-2"
              >
                Test Link ↗
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">Headline (Optional)</label>
          <input
            type="text"
            value={formData.headline || ''}
            onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
            placeholder="A transformative relationship seminar for married & engaged couples"
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">Event Description</label>
          <textarea
            rows={3}
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Summary and highlights of the seminar program..."
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>
    </div>
  );

  const renderInvitationFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: Upload & Coordinates */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              Upload Invitation PNG Card
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputCardRef.current?.click()}
                disabled={uploadingField === 'cardTemplate'}
                className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-2 transition-all disabled:opacity-50 min-h-[42px]"
              >
                <ImageIcon className="w-4 h-4" />
                <span>{uploadingField === 'cardTemplate' ? 'Uploading PNG...' : 'Choose PNG File'}</span>
              </button>
              <input
                ref={fileInputCardRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={(e) => handleDirectAssetUpload(e, 'cardTemplate')}
              />
              {formData.cardTemplate && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, cardTemplate: '', cardTemplateUrl: '' })}
                  className="text-xs text-rose-700 hover:underline font-bold cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
            <span className="text-[10px] text-stone-400 mt-1 block font-medium">
              Recommended: 576×1024 px PNG with transparent/white heart window.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Direct Template URL / Path
            </label>
            <input
              type="text"
              value={formData.cardTemplate || ''}
              onChange={(e) => setFormData({ ...formData, cardTemplate: e.target.value, cardTemplateUrl: e.target.value })}
              placeholder="e.g. /card_template.png or https://res.cloudinary.com/..."
              className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>

          {/* Heart Coordinate Tuning */}
          <div className="bg-stone-50 p-3.5 sm:p-4 rounded-2xl border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900">Heart Cutout Window (px)</span>
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    heartX: 157,
                    heartY: 91,
                    heartWidth: 260,
                    heartHeight: 312,
                    photoZoom: 0.55,
                    photoOffsetY: 0
                  })
                }
                className="text-[10px] text-rose-700 font-bold hover:underline cursor-pointer"
              >
                Reset Coordinates
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Heart X (px)</label>
                <input
                  type="number"
                  value={formData.heartX ?? 157}
                  onChange={(e) => setFormData({ ...formData, heartX: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-sm sm:text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Heart Y (px)</label>
                <input
                  type="number"
                  value={formData.heartY ?? 91}
                  onChange={(e) => setFormData({ ...formData, heartY: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-sm sm:text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Heart Width (px)</label>
                <input
                  type="number"
                  value={formData.heartWidth ?? 260}
                  onChange={(e) => setFormData({ ...formData, heartWidth: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-sm sm:text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Heart Height (px)</label>
                <input
                  type="number"
                  value={formData.heartHeight ?? 312}
                  onChange={(e) => setFormData({ ...formData, heartHeight: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-sm sm:text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live Interactive Card Preview */}
        <div className="flex flex-col items-center justify-center p-4 sm:p-5 bg-stone-100/70 rounded-2xl border border-stone-200">
          <span className="text-[10px] font-extrabold text-stone-500 uppercase tracking-wider mb-2">
            Live Card Template Preview
          </span>
          <div className="relative w-[170px] sm:w-[190px] h-[300px] sm:h-[338px] rounded-2xl overflow-hidden border border-stone-300 shadow-md bg-white">
            <img
              src={formData.cardTemplate || '/card_template.png'}
              alt="Template Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/card_template.png';
              }}
            />
            {/* Heart cutout photo window frame */}
            <div
              style={{
                position: 'absolute',
                left: `${((formData.heartX ?? 157) / 576) * 100}%`,
                top: `${((formData.heartY ?? 91) / 1024) * 100}%`,
                width: `${((formData.heartWidth ?? 260) / 576) * 100}%`,
                height: `${((formData.heartHeight ?? 312) / 1024) * 100}%`
              }}
              className="border-2 border-dashed border-rose-600 bg-rose-500/15 rounded-full pointer-events-none flex items-center justify-center"
            >
              <span className="text-[8px] font-bold text-rose-800 bg-white/95 px-1 py-0.5 rounded shadow-xs">
                Photo Window
              </span>
            </div>
          </div>
          <span className="text-[11px] text-stone-600 mt-2.5 text-center font-semibold">
            {formData.cardTemplate ? '✓ Custom Event PNG Attached' : 'Default Card Template'}
          </span>
        </div>
      </div>
    </div>
  );

  const renderSpeakerFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">Speaker / Host Name</label>
          <input
            type="text"
            value={formData.speakerName || ''}
            onChange={(e) => setFormData({ ...formData, speakerName: e.target.value })}
            placeholder="Manish Vaghasiya"
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">Speaker Title / Credentials</label>
          <input
            type="text"
            value={formData.speakerTitle || ''}
            onChange={(e) => setFormData({ ...formData, speakerTitle: e.target.value })}
            placeholder="Couple Relationship Counselor & Life Coach"
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">Helpline Phone Number</label>
          <input
            type="tel"
            value={formData.contactPhone || ''}
            onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
            placeholder="+91 82003 02328"
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">Helpline WhatsApp Number</label>
          <input
            type="tel"
            value={formData.contactWhatsapp || ''}
            onChange={(e) => setFormData({ ...formData, contactWhatsapp: e.target.value })}
            placeholder="+91 82003 02328"
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>

        {/* Speaker Image Upload */}
        <div className="sm:col-span-2 p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
          <span className="text-xs font-bold text-stone-900 block">Speaker / Host Photo</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputSpeakerRef.current?.click()}
              disabled={uploadingField === 'speakerImage'}
              className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50 min-h-[40px]"
            >
              <UploadIcon className="w-3.5 h-3.5" />
              <span>{uploadingField === 'speakerImage' ? 'Uploading...' : 'Upload Speaker Photo'}</span>
            </button>
            <input
              ref={fileInputSpeakerRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleDirectAssetUpload(e, 'speakerImage')}
            />
            {formData.speakerImage && (
              <button
                type="button"
                onClick={() => setFormData({ ...formData, speakerImage: '' })}
                className="text-xs text-rose-700 font-bold hover:underline cursor-pointer"
              >
                Remove
              </button>
            )}
          </div>

          <input
            type="text"
            value={formData.speakerImage || ''}
            onChange={(e) => setFormData({ ...formData, speakerImage: e.target.value })}
            placeholder="Or paste speaker image URL..."
            className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-mono text-stone-800"
          />
        </div>
      </div>
    </div>
  );

  const renderPassSeoFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">Pass Title Override</label>
          <input
            type="text"
            value={formData.passTitle || ''}
            onChange={(e) => setFormData({ ...formData, passTitle: e.target.value })}
            placeholder="Leave blank for default pass header"
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">SEO Meta Title</label>
          <input
            type="text"
            value={formData.seoTitle || ''}
            onChange={(e) => setFormData({ ...formData, seoTitle: e.target.value })}
            placeholder="Ek Duje Ke Liye - Seminar in Surat"
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-stone-700 mb-1">Digital Pass Entry Instructions</label>
          <textarea
            rows={2}
            value={formData.passInstructions || ''}
            onChange={(e) => setFormData({ ...formData, passInstructions: e.target.value })}
            placeholder="Special guidelines printed directly on attendee digital entry pass..."
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-stone-700 mb-1">SEO Meta Description</label>
          <textarea
            rows={2}
            value={formData.seoDescription || ''}
            onChange={(e) => setFormData({ ...formData, seoDescription: e.target.value })}
            placeholder="Meta description for search engine discovery..."
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-base sm:text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>
    </div>
  );

  const renderSectionContent = (secId: SectionId) => {
    switch (secId) {
      case 'schedule':
        return renderScheduleFields();
      case 'pricing':
        return renderPricingFields();
      case 'media':
        return renderMediaFields();
      case 'invitation':
        return renderInvitationFields();
      case 'speaker':
        return renderSpeakerFields();
      case 'pass_seo':
        return renderPassSeoFields();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Command Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-stone-900 tracking-tight">Event Management</h2>
            <span className="text-[11px] font-extrabold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
              {programs.length} Slots
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Configure live event schedules, dynamic pricing, venues, capacities, media, and invitation cards.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
        >
          <span className="text-base leading-none font-black">+</span>
          <span>Create New Event</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-stone-200/90 shadow-xs">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[36px] flex items-center ${
              categoryFilter === 'all' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            All Slots ({programs.length})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('upcoming')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[36px] flex items-center gap-1.5 ${
              categoryFilter === 'upcoming'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Upcoming ({upcomingCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('tbd')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[36px] flex items-center ${
              categoryFilter === 'tbd' ? 'bg-sky-600 text-white shadow-xs' : 'text-sky-700 hover:bg-sky-50'
            }`}
          >
            Date TBA ({tbdCount})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[36px] flex items-center ${
              categoryFilter === 'completed' ? 'bg-stone-600 text-white shadow-xs' : 'text-stone-500 hover:bg-stone-100'
            }`}
          >
            Completed ({completedCount})
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-auto md:min-w-[220px]">
          <SearchIcon className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search slots, venues, cities..."
            className="w-full pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:border-rose-500 min-h-[38px]"
          />
        </div>
      </div>

      {/* Event Cards Grid */}
      {filteredPrograms.length === 0 ? (
        <div className="bg-white p-8 sm:p-12 text-center rounded-2xl border border-stone-200 text-stone-500 space-y-3">
          <TicketIcon className="w-10 h-10 text-stone-300 mx-auto" />
          <p className="text-sm font-semibold text-stone-700">No event slots found matching your filter.</p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer min-h-[40px]"
          >
            + Create New Event Slot
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredPrograms.map((prog) => {
            const isTbd = prog.date === 'TBD' || prog.date === 'TBA' || prog.status === 'date_tba' || !prog.isDateFinal;
            const isCompleted = prog.status === 'completed' || prog.status === 'archived' || (prog.date < todayStr && !isTbd);
            const capacity = prog.capacity && prog.capacity > 0 ? prog.capacity : 1000;
            const approved = prog.approvedCount ?? prog.bookingsCount ?? 0;
            const pending = prog.pendingCount ?? 0;
            const isHousefull = prog.isHousefull || approved >= capacity;
            const availableSlots = Math.max(0, capacity - approved);
            const fillPercentage = Math.min(100, Math.round((approved / capacity) * 100));

            return (
              <div
                key={prog.id}
                className={`bg-white border ${
                  isHousefull
                    ? 'border-rose-300 bg-rose-50/10 ring-1 ring-rose-300/40'
                    : isCompleted
                    ? 'border-stone-200 bg-stone-50/60'
                    : 'border-stone-200 hover:border-rose-300 shadow-xs hover:shadow-md'
                } rounded-2xl p-4 sm:p-5 transition-all flex flex-col justify-between space-y-4`}
              >
                <div className="space-y-3">
                  {/* Top Badge Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border tracking-wider inline-block mb-1.5 bg-stone-100 text-stone-700 border-stone-200">
                        {prog.city || 'Gujarat'}
                      </span>
                      <h3 className="font-extrabold text-stone-900 text-sm leading-snug break-words">
                        {prog.name}
                      </h3>
                    </div>
                    <span
                      className={`text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-lg border flex-shrink-0 whitespace-nowrap ${
                        isHousefull
                          ? 'bg-rose-600 text-white border-rose-700 shadow-xs animate-pulse'
                          : isCompleted
                          ? 'bg-stone-100 text-stone-600 border-stone-200'
                          : isTbd
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : prog.status === 'few_seats' || fillPercentage >= 85
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {isHousefull
                        ? 'HOUSEFULL'
                        : isCompleted
                        ? 'COMPLETED'
                        : isTbd
                        ? 'Date TBA'
                        : prog.status === 'few_seats' || fillPercentage >= 85
                        ? 'FEW SEATS LEFT'
                        : 'UPCOMING'}
                    </span>
                  </div>

                  {/* Schedule & Venue Details */}
                  <div className="space-y-1.5 text-xs text-stone-600">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                      <span className="font-medium text-stone-800">
                        {isTbd ? 'Date to be announced' : `${prog.date} (${prog.time || '8:30 PM'})`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BuildingIcon className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                      <span className="font-medium text-stone-800 truncate">
                        {prog.venue || 'Venue to be announced'}
                      </span>
                    </div>
                  </div>

                  {/* Capacity & Booking Stats Box */}
                  <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-700">Capacity &amp; Bookings:</span>
                      <span className="font-extrabold text-stone-900">
                        {approved} / {capacity} couples
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          fillPercentage >= 100
                            ? 'bg-rose-600'
                            : fillPercentage >= 85
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${fillPercentage}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-1 text-[11px] text-center border-t border-stone-200/60 font-bold">
                      <div className="text-emerald-700">✓ {approved} Confirmed</div>
                      <div className="text-amber-700">⏳ {pending} Pending</div>
                      <div className="text-stone-700">{availableSlots} Left</div>
                    </div>
                  </div>

                  {/* Fee & Inquiries Details */}
                  <div className="flex items-center justify-between text-xs px-1 text-stone-600">
                    <div className="flex items-center gap-1 font-bold text-stone-900">
                      <span>Fee:</span>
                      <span className="text-rose-700 font-extrabold">₹{prog.price !== undefined ? prog.price : 1500} INR</span>
                    </div>
                    {prog.cardTemplate && (
                      <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200 font-bold flex items-center gap-1">
                        <SparklesIcon className="w-3 h-3" />
                        <span>Custom Card PNG</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(prog)}
                      className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer min-h-[38px]"
                    >
                      <PencilIcon className="w-3.5 h-3.5 text-stone-600" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      disabled={duplicatingId === prog.id}
                      onClick={() => handleDuplicate(prog)}
                      className="px-2.5 py-2 bg-stone-50 hover:bg-stone-100 text-stone-700 font-bold text-xs rounded-xl border border-stone-200 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 min-h-[38px]"
                      title="Duplicate slot"
                    >
                      <LayersIcon className="w-3.5 h-3.5 text-stone-500" />
                      <span>Copy</span>
                    </button>

                    {prog.slug && (
                      <a
                        href={`/event/${prog.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-stone-500 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors min-h-[38px] flex items-center justify-center"
                        title="View Public Page"
                      >
                        <TicketIcon className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(prog.id, prog.name)}
                      className="p-2 text-stone-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer min-h-[38px] flex items-center justify-center"
                      title="Delete event slot"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Redesigned Modal: Full-screen on Mobile, 2-Column Desktop, ZERO Horizontal Sliders */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-stone-200 shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[94vh] sm:h-[90vh] max-h-[96vh] animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-150">
            {/* Modal Header Banner */}
            <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/80 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 flex-shrink-0">
                  <TicketIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-sm sm:text-base leading-tight">
                    {editingProgram ? `Edit: ${editingProgram.name}` : 'Create New Event Slot'}
                  </h3>
                  <p className="text-stone-500 text-[11px] sm:text-xs mt-0.5 line-clamp-1">
                    All updates reflect across Homepage, Pass, WhatsApp, and Razorpay.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-200/60 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                aria-label="Close Modal"
              >
                <XIcon className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {/* Desktop 2-Column Layout */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Left Sidebar Navigation (Desktop only - 0 slider) */}
              <div className="hidden md:flex flex-col w-72 border-r border-stone-200 bg-stone-50/50 p-3 space-y-1.5 flex-shrink-0 overflow-y-auto">
                <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider px-3 py-1 block">
                  Configuration Sections
                </span>
                {SECTIONS.map((sec) => {
                  const IconComp = sec.icon;
                  const isActive = activeSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setActiveSection(sec.id)}
                      className={`w-full p-3 rounded-2xl text-left transition-all cursor-pointer flex items-start gap-3 ${
                        isActive
                          ? 'bg-white border border-stone-200 text-stone-900 shadow-xs ring-1 ring-rose-500/20'
                          : 'text-stone-600 hover:bg-stone-100/70 hover:text-stone-900 border border-transparent'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isActive
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold block truncate ${isActive ? 'text-rose-700' : 'text-stone-800'}`}>
                            {sec.title}
                          </span>
                          <span className="text-[10px] text-stone-400 font-extrabold ml-1">
                            {sec.stepNumber}
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-400 block line-clamp-1 mt-0.5">
                          {sec.subtitle}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Form Area: Desktop Active Tab Panel + Mobile Stacked Accordion (Zero Slider) */}
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                  {error && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                      <AlertTriangleIcon className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* MOBILE VIEW (< md): Stacked Luxury Accordion Cards */}
                  <div className="md:hidden space-y-3">
                    {SECTIONS.map((sec) => {
                      const IconComp = sec.icon;
                      const isOpen = mobileOpenSections[sec.id];
                      return (
                        <div
                          key={sec.id}
                          className={`rounded-2xl border transition-all overflow-hidden ${
                            isOpen
                              ? 'border-rose-300 bg-white shadow-sm ring-1 ring-rose-500/10'
                              : 'border-stone-200 bg-stone-50/70 hover:bg-stone-50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleMobileSection(sec.id)}
                            className="w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                  isOpen ? 'bg-rose-600 text-white' : 'bg-stone-200/80 text-stone-600'
                                }`}
                              >
                                <IconComp className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-extrabold text-stone-400">
                                    {sec.stepNumber}.
                                  </span>
                                  <span className={`text-xs font-extrabold ${isOpen ? 'text-rose-700' : 'text-stone-800'}`}>
                                    {sec.title}
                                  </span>
                                </div>
                                <span className="text-[10px] text-stone-500 block truncate">
                                  {sec.subtitle}
                                </span>
                              </div>
                            </div>
                            <span
                              className={`text-xs font-black px-2 py-1 rounded-lg transition-transform ${
                                isOpen ? 'text-rose-600 rotate-180' : 'text-stone-400'
                              }`}
                            >
                              ▼
                            </span>
                          </button>

                          {isOpen && (
                            <div className="p-3.5 sm:p-4 border-t border-stone-100 bg-white space-y-4 animate-in fade-in duration-150">
                              {renderSectionContent(sec.id)}
                              <div className="pt-2 flex items-center justify-between border-t border-stone-100">
                                <span className="text-[10px] text-stone-400 font-semibold">
                                  Step {sec.stepNumber} of 06
                                </span>
                                {sec.id !== 'pass_seo' && (
                                  <button
                                    type="button"
                                    onClick={() => goToNextSection(sec.id)}
                                    className="px-3 py-1.5 bg-stone-900 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1"
                                  >
                                    <span>Next Step</span>
                                    <span>→</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* DESKTOP VIEW (>= md): Active Panel with Header & Footer */}
                  <div className="hidden md:block space-y-4 animate-in fade-in duration-150">
                    <div className="border-b border-stone-100 pb-3">
                      <h4 className="text-sm font-extrabold text-stone-900">
                        {SECTIONS.find((s) => s.id === activeSection)?.stepNumber}. {SECTIONS.find((s) => s.id === activeSection)?.title}
                      </h4>
                      <p className="text-xs text-stone-500">
                        {SECTIONS.find((s) => s.id === activeSection)?.subtitle}
                      </p>
                    </div>

                    {renderSectionContent(activeSection)}

                    <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                      {activeSection !== 'schedule' ? (
                        <button
                          type="button"
                          onClick={() => goToPrevSection(activeSection)}
                          className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          ← Back
                        </button>
                      ) : <div />}

                      {activeSection !== 'pass_seo' ? (
                        <button
                          type="button"
                          onClick={() => goToNextSection(activeSection)}
                          className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          Next Step →
                        </button>
                      ) : (
                        <span className="text-[11px] text-emerald-700 font-bold">
                          ✓ All 6 sections configured
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modal Bottom Actions Bar (Compact & Mobile-Optimized) */}
                <div className="p-3 sm:p-4 border-t border-stone-200 bg-white/95 sm:bg-stone-50/90 backdrop-blur-sm flex items-center justify-between gap-2.5 flex-shrink-0">
                  <div className="hidden sm:block text-xs text-stone-500 font-medium truncate max-w-[280px]">
                    {editingProgram ? (
                      <span title={editingProgram.name}>
                        Editing: <strong className="text-stone-800">{editingProgram.name}</strong>
                      </span>
                    ) : (
                      'New Slot Draft'
                    )}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 sm:flex-initial px-4 py-2.5 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700 font-bold text-xs rounded-xl transition-colors cursor-pointer min-h-[42px] text-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-2 sm:flex-initial px-6 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 active:scale-98 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50 min-h-[42px] flex items-center justify-center gap-1.5"
                    >
                      {submitting ? (
                        <span>Saving...</span>
                      ) : (
                        <>
                          <CheckIcon className="w-3.5 h-3.5 text-white" />
                          <span>{editingProgram ? 'Save Changes' : 'Create Slot'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
