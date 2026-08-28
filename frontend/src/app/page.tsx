'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../config';
import {
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  TicketIcon,
  SparklesIcon,
  HeartHandshakeIcon,
  ShieldCheckIcon,
  MessageSquareIcon,
  AlertTriangleIcon
} from '../components/Icons';

interface Program {
  id: string;
  sequenceNumber?: number;
  name: string;
  slug?: string;
  city?: string;
  venue?: string;
  mapUrl?: string;
  description?: string;
  heroImage?: string;
  price?: number;
  status?: string;
  featured?: boolean;
  registrationMode?: string;
  externalRegistrationUrl?: string;
  sortOrder?: number;
  date: string;
  time: string;
  capacity: number;
  bookingsCount: number;
  activeBookings?: number;
  availableSeats?: number;
  isDateFinal?: boolean;
  isInquiryClosed?: boolean;
}

const FAQ_ITEMS = [
  {
    question: "કોણ આ સેમિનારમાં ભાગ લઈ શકે છે? (Who can attend?)",
    answer: "આ સેમિનાર ફક્ત અને ફક્ત પરણેલા દંપતીઓ (Married Couples) માટે જ છે. સિંગલ વ્યક્તિઓ કે બાળકોને પ્રવેશ મળશે નહીં."
  },
  {
    question: "સેમિનારનો સમયગાળો કેટલો રહેશે? (What is the duration?)",
    answer: "સેમિનાર સામાન્ય રીતે ૩ થી ૪ કલાકનો હોય છે જેમાં ઊંડાણપૂર્વકના સત્રો, વ્યવહારુ સંવાદ અને હૃદયસ્પર્શી પ્રવૃત્તિઓ સામેલ છે."
  },
  {
    question: "શું બાળકોને સાથે લાવી શકાય? (Are children allowed?)",
    answer: "ના, પતિ-પત્ની સંપૂર્ણ ધ્યાન એકબીજા પર અને સેમિનારના વિષય પર કેન્દ્રિત કરી શકે તે માટે બાળકોને લાવવાની સખત મનાઈ છે."
  },
  {
    question: "પાસ બુક કર્યા પછી કેવી રીતે મળશે? (How will I receive the pass?)",
    answer: "ઓનલાઇન પેમેન્ટ સફળ થતાં જ સ્ક્રીન પર ડિજિટલ કપલ પાસ ડાઉનલોડ કરવા મળશે અને તમારા રજીસ્ટર્ડ WhatsApp નંબર પર પણ તરત જ મોકલી દેવામાં આવશે."
  },
  {
    question: "જો કોઈ કારણસર તારીખ બદલવી હોય તો? (Can we change the slot?)",
    answer: "જો તમે હજુ સુધી પેમેન્ટ ના કર્યું હોય તો તમે સ્લોટ બદલી શકો છો. કન્ફર્મ થયેલા પાસ માટે હેલ્પલાઇન +91 82003 02328 પર સંપર્ક કરી શકો છો."
  }
];

const GALLERY_IMAGES = [
  "/SEMINAR IMAGE/042A3829.JPG",
  "/SEMINAR IMAGE/042A3854.JPG",
  "/SEMINAR IMAGE/042A3968.JPG",
  "/SEMINAR IMAGE/042A4114.JPG",
  "/SEMINAR IMAGE/042A4417.JPG",
  "/SEMINAR IMAGE/042A4734.JPG",
  "/SEMINAR IMAGE/042A8596.JPG",
  "/SEMINAR IMAGE/042A8803.JPG"
];

// Helper to format date in Indian English format: 07/09/2026 (07 September 2026)
function formatIndianDate(dateStr?: string): string {
  if (!dateStr || dateStr.toUpperCase() === 'TBD') {
    return 'Date to be declared (તારીખ ટૂંક સમયમાં જાહેર થશે)';
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const day = parts[2];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[month - 1] || parts[1];
    return `${day}/${parts[1]}/${year} (${day} ${monthName} ${year})`;
  }
  return dateStr;
}

export default function HomePage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [publicConfig, setPublicConfig] = useState<{
    brandName?: string;
    supportPhone?: string;
    supportWhatsapp?: string;
    supportEmail?: string;
    instagramUrl?: string;
    facebookUrl?: string;
    youtubeUrl?: string;
    linktreeUrl?: string;
    defaultPrice?: number;
  }>({});
  const [selectedCity, setSelectedCity] = useState('All');
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedGalleryIdx, setSelectedGalleryIdx] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoadingEvents(true);
      try {
        const [eventsRes, configRes] = await Promise.allSettled([
          fetch(`${API_BASE_URL}/api/public/home`),
          fetch(`${API_BASE_URL}/api/config/public`)
        ]);

        if (!isMounted) return;

        if (configRes.status === 'fulfilled' && configRes.value.ok) {
          const configData = await configRes.value.json();
          if (isMounted) setPublicConfig(configData);
        }

        if (eventsRes.status === 'fulfilled' && eventsRes.value.ok) {
          const data = await eventsRes.value.json();
          const list: Program[] = Array.isArray(data) ? data : (data.programs || []);

          // Sort: upcoming events first, then TBA, then completed events
          const sorted = [...list].filter(p => p.status !== 'archived' && p.status !== 'cancelled').sort((a, b) => {
            const isACompleted = a.status === 'completed';
            const isBCompleted = b.status === 'completed';
            if (isACompleted && !isBCompleted) return 1;
            if (!isACompleted && isBCompleted) return -1;
            return (a.sequenceNumber || 0) - (b.sequenceNumber || 0) || (a.date || '').localeCompare(b.date || '');
          });

          if (isMounted) {
            setPrograms(sorted.length > 0 ? sorted : list);
          }
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('Failed to load initial home page data:', err);
        }
      } finally {
        if (isMounted) {
          setLoadingEvents(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);


  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 font-sans selection:bg-rose-500/20 selection:text-rose-900 relative overflow-x-hidden">

      {/* Subtle Warm Luxury Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[20%] w-[550px] h-[550px] bg-rose-200/35 rounded-full blur-[150px]" />
        <div className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] bg-amber-200/35 rounded-full blur-[160px]" />
        <div className="absolute bottom-[10%] left-[-10%] w-[600px] h-[600px] bg-orange-100/40 rounded-full blur-[160px]" />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-stone-200/80 px-6 lg:px-12 py-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/logo.png"
              alt="Ek Duje Ke Liye Logo"
              className="h-10 md:h-12 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <div>
              <span className="text-lg md:text-xl font-extrabold tracking-wider text-stone-900 uppercase block leading-tight">
                Ek Duje Ke Liye
              </span>
              <span className="text-[10px] tracking-widest text-rose-700 font-bold uppercase block">
                by Manish Vaghasiya
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-stone-600">
            <a href="#events" className="hover:text-rose-600 transition-colors">Upcoming Events</a>
            <a href="#experience" className="hover:text-rose-600 transition-colors">The Experience</a>
            <a href="#about" className="hover:text-rose-600 transition-colors">About Host</a>
            <a href="#gallery" className="hover:text-rose-600 transition-colors">Gallery</a>
            <a href="#faq" className="hover:text-rose-600 transition-colors">FAQ</a>
          </div>

          {/* Header Action */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href="#events"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-rose-600/20 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <TicketIcon className="w-4 h-4" />
              <span>Book Passes</span>
            </a>
          </div>

          {/* Mobile Menu Trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            className="md:hidden p-2 text-stone-700 hover:text-stone-950"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-4 pb-6 px-4 border-t border-stone-200 flex flex-col gap-4 text-sm font-semibold animate-fade-in bg-white/95 backdrop-blur-lg">
            <a
              href="#events"
              onClick={() => setMobileMenuOpen(false)}
              className="text-stone-700 hover:text-rose-600 py-1"
            >
              Upcoming Events
            </a>
            <a
              href="#experience"
              onClick={() => setMobileMenuOpen(false)}
              className="text-stone-700 hover:text-rose-600 py-1"
            >
              The Experience
            </a>
            <a
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className="text-stone-700 hover:text-rose-600 py-1"
            >
              About Manish Vaghasiya
            </a>
            <a
              href="#gallery"
              onClick={() => setMobileMenuOpen(false)}
              className="text-stone-700 hover:text-rose-600 py-1"
            >
              Photo Gallery
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="text-stone-700 hover:text-rose-600 py-1"
            >
              FAQ
            </a>
            <a
              href="#events"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-3 bg-gradient-to-r from-rose-600 to-amber-600 text-white font-bold text-center rounded-xl text-xs uppercase tracking-wider mt-2 shadow-md shadow-rose-600/20"
            >
              Book Couple Pass
            </a>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-12 pb-20 md:pt-20 md:pb-32 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold uppercase tracking-widest mx-auto lg:mx-0 shadow-xs">
              <HeartHandshakeIcon className="w-3.5 h-3.5 text-rose-600" />
              <span>Educational Relationship &amp; Life-Skills Seminar</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-stone-900 tracking-tight leading-[1.18]">
              એક દૂજે કે લિયે <br />
              <span className="text-gradient-royal">
                પ્રેમ અને સમજણનો એજ્યુકેશનલ સેમિનાર
              </span>
            </h1>

            <p className="text-stone-600 text-base md:text-lg leading-relaxed max-w-2xl mx-auto lg:mx-0 font-normal">
              પતિ-પત્ની વચ્ચે ઊંડો પ્રેમ, અખૂટ વિશ્વાસ, મધુર સંવાદ અને વ્યવહારુ જીવન કૌશલ્ય કેળવવા માટેનો એજ્યુકેશનલ કપલ સેમિનાર led by <strong>Manish Vaghasiya</strong>.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <a
                href="#events"
                className="inline-flex items-center gap-2.5 px-8 py-4 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-extrabold rounded-2xl transition-all shadow-xl shadow-rose-600/25 text-sm uppercase tracking-wider transform hover:scale-105 active:scale-95 cursor-pointer"
              >
                <TicketIcon className="w-4 h-4" />
                <span>View Upcoming Seminars</span>
              </a>
              <a
                href="#experience"
                className="px-8 py-4 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 font-bold rounded-2xl transition-all text-sm shadow-sm"
              >
                Explore Experience ↓
              </a>
            </div>

            {/* Badges */}
            <div className="pt-6 border-t border-stone-200 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs font-semibold text-stone-600">
              <div className="flex items-center gap-2">
                <span className="text-rose-600 font-bold">✓</span> Educational Seminar (Married Couples Only)
              </div>
              <div className="flex items-center gap-2">
                <span className="text-rose-600 font-bold">✓</span> Instant Digital Pass on Razorpay
              </div>
              <div className="flex items-center gap-2">
                <span className="text-rose-600 font-bold">✓</span> WhatsApp Delivery
              </div>
              <div className="flex items-center gap-2 text-amber-800 font-bold">
                <span className="text-amber-600">✓</span> Strictly Non-Refundable &amp; Non-Transferable
              </div>
            </div>
          </div>

          {/* Hero Visual Card */}
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="relative w-full max-w-md aspect-[4/5] rounded-3xl overflow-hidden border border-stone-200 shadow-2xl bg-stone-100">
              <img
                src="/images/042A3646.JPG"
                alt="Manish Vaghasiya - Ek Duje Ke Liye"
                className="w-full h-full object-cover object-top scale-x-[-1]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-transparent to-transparent opacity-90" />

              <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-stone-200/80 shadow-lg text-left">
                <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">Keynote Host</span>
                <span className="text-lg font-extrabold text-stone-900 block">Manish Vaghasiya</span>
                <span className="text-xs text-stone-600 block font-medium">Life &amp; Relationship Facilitator</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Upcoming Events Section */}
      <section id="events" className="relative z-10 py-20 px-6 lg:px-12 bg-stone-100/70 border-y border-stone-200/80">
        <div className="max-w-7xl mx-auto space-y-12">

          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-widest block">Reserve Your Seats</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-stone-900 tracking-tight">
              Upcoming Educational Seminars &amp; Workshops
            </h2>
            <p className="text-stone-600 text-sm font-medium">
              Choose your preferred city and register for your couple educational seminar pass securely.
            </p>
          </div>

          {/* Dynamic City Filter */}
          {!loadingEvents && programs.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto">
              {['All', ...Array.from(new Set(programs.map(p => p.city).filter((c): c is string => Boolean(c))))].map((city) => (
                <button
                  key={city}
                  onClick={() => setSelectedCity(city)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedCity === city
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20 scale-105'
                      : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
                  }`}
                >
                  {city === 'All' ? 'All Cities' : city}
                </button>
              ))}
            </div>
          )}

          {/* Event Cards Grid */}
          {loadingEvents ? (
            <div className="flex justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-rose-600/20 border-t-rose-600 rounded-full animate-spin" />
                <p className="text-xs text-rose-700 font-bold">Loading upcoming educational seminars...</p>
              </div>
            </div>
          ) : programs.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-3xl p-12 text-center max-w-lg mx-auto space-y-3 shadow-md">
              <TicketIcon className="w-8 h-8 text-rose-600 mx-auto" />
              <h3 className="text-xl font-bold text-stone-900">New Seminar Dates Coming Soon</h3>
              <p className="text-xs text-stone-600 leading-relaxed font-medium">
                New educational relationship seminar dates will be announced soon. Follow our official channels for instant updates.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
              {(selectedCity === 'All' ? programs : programs.filter(p => p.city === selectedCity)).map((prog) => {
                const isExternal = prog.registrationMode === 'external';
                const isCompleted = prog.status === 'completed';
                const isHousefull = prog.status === 'housefull';
                const isClosed = prog.status === 'registration_closed';
                const isTba = prog.status === 'date_tba';
                const eventPrice = prog.price !== undefined ? prog.price : 1500;

                let statusLabel = 'UPCOMING';
                let statusClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                if (isCompleted) {
                  statusLabel = 'COMPLETED';
                  statusClass = 'bg-stone-100 text-stone-600 border-stone-200';
                } else if (prog.status === 'few_seats') {
                  statusLabel = 'FEW SEATS LEFT';
                  statusClass = 'bg-amber-50 text-amber-800 border-amber-200';
                } else if (isHousefull) {
                  statusLabel = 'HOUSEFULL';
                  statusClass = 'bg-rose-50 text-rose-800 border-rose-200';
                } else if (isClosed) {
                  statusLabel = 'REGISTRATION CLOSED';
                  statusClass = 'bg-stone-100 text-stone-600 border-stone-200';
                } else if (isTba) {
                  statusLabel = 'DATE TBA';
                  statusClass = 'bg-blue-50 text-blue-800 border-blue-200';
                }

                return (
                  <div
                    key={prog.id}
                    className="bg-white border border-stone-200/90 hover:border-rose-400/70 rounded-3xl p-6 md:p-8 transition-all duration-300 shadow-md shadow-stone-200/50 hover:shadow-2xl hover:shadow-rose-950/10 flex flex-col justify-between space-y-6 group"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-800 font-bold text-xs rounded-lg uppercase tracking-wider">
                            <MapPinIcon className="w-3.5 h-3.5 text-rose-600" />
                            <span>{prog.city || 'Surat'}</span>
                          </span>
                          <span className="hidden sm:inline-block px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 font-bold text-[10px] rounded-lg uppercase tracking-wider">
                            Educational Seminar
                          </span>
                        </div>
                        <span className={`px-3 py-1 font-bold text-[11px] rounded-lg border uppercase tracking-wider ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </div>

                      <h3 className="text-2xl font-extrabold text-stone-900 group-hover:text-rose-700 transition-colors">
                        {prog.name}
                      </h3>

                      <div className="space-y-2.5 text-sm text-stone-600">
                        <div className="flex items-center gap-3">
                          <CalendarIcon className="w-4 h-4 text-rose-600 flex-shrink-0" />
                          <span className="font-semibold text-stone-800">{formatIndianDate(prog.date)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <ClockIcon className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <span className="font-medium text-stone-700">{prog.time}</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <MapPinIcon className="w-4 h-4 text-stone-500 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-stone-600 leading-tight">
                            {prog.venue || 'Venue to be announced'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-stone-200">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500 font-semibold bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5">
                        <span className="text-amber-800 flex items-center gap-1.5 font-bold">
                          <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                          <span>Non-Refundable &amp; Non-Transferable</span>
                        </span>
                        <span className="text-stone-400 font-normal">(ફી રિફંડ કે ટ્રાન્સફર થશે નહીં)</span>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <span className="text-[10px] text-stone-500 block uppercase font-bold tracking-wider">Couple Pass</span>
                          <span className="text-2xl font-extrabold text-stone-900">₹{eventPrice}</span>
                        </div>

                        {isCompleted || isHousefull || isClosed ? (
                          <button
                            disabled
                            className="px-6 py-3 bg-stone-200 text-stone-500 font-bold text-xs uppercase rounded-xl cursor-not-allowed"
                          >
                            {isCompleted ? 'Completed' : isHousefull ? 'Housefull' : 'Closed'}
                          </button>
                        ) : isExternal ? (
                          <a
                            href={prog.externalRegistrationUrl || 'https://linktr.ee/ekdujekeliye'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-rose-600/20 text-center"
                          >
                            <span>Register on Portal</span>
                          </a>
                        ) : (
                          <Link
                            href={`/event/${prog.slug || prog.id}`}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-rose-600/20 text-center transform hover:scale-105 active:scale-95"
                          >
                            <TicketIcon className="w-4 h-4" />
                            <span>Register for Seminar</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </section>

      {/* The Experience / 4 Pillars Section */}
      <section id="experience" className="relative z-10 py-20 px-6 lg:px-12 max-w-7xl mx-auto space-y-16">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-bold text-rose-700 uppercase tracking-widest block">Why Attend</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-stone-900 tracking-tight">
            તમારા સંબંધ માટે એક અવિસ્મરણીય સાંજ
          </h2>
          <p className="text-stone-600 text-sm font-medium">
            Discover the keys to a joyful, resilient, and romantic marital journey.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white border border-stone-200/90 hover:border-rose-300 rounded-3xl p-6 space-y-4 transition-all shadow-sm hover:shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200/80 flex items-center justify-center">
              <MessageSquareIcon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-stone-900">હૃદયસ્પર્શી સંવાદ</h3>
            <p className="text-xs text-stone-600 leading-relaxed font-normal">
              રોજિંદા જીવનમાં અટવાઈ ગયેલી વાતોને મુક્ત મને વ્યક્ત કરવાની અને એકબીજાની લાગણીઓને સાંભળવાની કળા.
            </p>
          </div>

          <div className="bg-white border border-stone-200/90 hover:border-amber-300 rounded-3xl p-6 space-y-4 transition-all shadow-sm hover:shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center">
              <HeartHandshakeIcon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-stone-900">નવો સ્નેહ &amp; રોમાન્સ</h3>
            <p className="text-xs text-stone-600 leading-relaxed font-normal">
              લગ્નના શરૂઆતી દિવસો જેવો પ્રેમ અને ઉત્સાહ ફરીથી તાજો કરવાનો સુંદર અવસર.
            </p>
          </div>

          <div className="bg-white border border-stone-200/90 hover:border-rose-300 rounded-3xl p-6 space-y-4 transition-all shadow-sm hover:shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200/80 flex items-center justify-center">
              <ShieldCheckIcon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-stone-900">મતભેદોનું નિવારણ</h3>
            <p className="text-xs text-stone-600 leading-relaxed font-normal">
              નાની-મોટી તકરારોને શાંતિથી, સમજણપૂર્વક અને હાસ્ય સાથે ઉકેલવાની સરળ વ્યવહારુ રીતો.
            </p>
          </div>

          <div className="bg-white border border-stone-200/90 hover:border-amber-300 rounded-3xl p-6 space-y-4 transition-all shadow-sm hover:shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center">
              <SparklesIcon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-stone-900">આજીવન મિત્રતા</h3>
            <p className="text-xs text-stone-600 leading-relaxed font-normal">
              માત્ર પતિ-પત્ની નહીં પરંતુ જીવનભર એકબીજાના સૌથી સારા મિત્ર અને સાથીદાર બનવાની સફર.
            </p>
          </div>
        </div>
      </section>

      {/* How Registration Works (5 Simple Steps) */}
      <section className="relative z-10 py-16 px-6 lg:px-12 bg-stone-100/70 border-y border-stone-200/80">
        <div className="max-w-7xl mx-auto space-y-12">

          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-widest block">Seamless Experience</span>
            <h2 className="text-3xl font-extrabold text-stone-900 tracking-tight">સરળ ૫-સ્ટેપ રજીસ્ટ્રેશન</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
            <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-2 shadow-sm">
              <span className="text-2xl font-extrabold text-rose-600 block font-mono">01</span>
              <h4 className="text-sm font-bold text-stone-900">શહેર પસંદ કરો</h4>
              <p className="text-[11px] text-stone-600 font-medium">તમારા અનુકૂળ શહેર અને તારીખ પર ક્લિક કરો.</p>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-2 shadow-sm">
              <span className="text-2xl font-extrabold text-amber-600 block font-mono">02</span>
              <h4 className="text-sm font-bold text-stone-900">વિગતો ભરો</h4>
              <p className="text-[11px] text-stone-600 font-medium">પતિ-પત્નીનું નામ અને મોબાઈલ નંબર લખો.</p>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-2 shadow-sm">
              <span className="text-2xl font-extrabold text-rose-600 block font-mono">03</span>
              <h4 className="text-sm font-bold text-stone-900">કપલ ફોટો અપલોડ</h4>
              <p className="text-[11px] text-stone-600 font-medium">પાસ માટે તમારો સુંદર ફોટો પસંદ કરો.</p>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-2 shadow-sm">
              <span className="text-2xl font-extrabold text-amber-600 block font-mono">04</span>
              <h4 className="text-sm font-bold text-stone-900">Razorpay પેમેન્ટ</h4>
              <p className="text-[11px] text-stone-600 font-medium">UPI, Card કે NetBanking થી સુરક્ષિત પેમેન્ટ કરો.</p>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-2 shadow-sm">
              <span className="text-2xl font-extrabold text-emerald-600 block font-mono">05</span>
              <h4 className="text-sm font-bold text-stone-900">ડિજિટલ પાસ</h4>
              <p className="text-[11px] text-stone-600 font-medium">તરત જ સ્ક્રીન અને WhatsApp પર પાસ મેળવો.</p>
            </div>
          </div>

        </div>
      </section>

      {/* About Manish Vaghasiya */}
      <section id="about" className="relative z-10 py-20 px-6 lg:px-12 max-w-6xl mx-auto">
        <div className="bg-white border border-stone-200 rounded-3xl p-8 md:p-12 grid grid-cols-1 md:grid-cols-12 gap-8 items-center shadow-xl">

          <div className="md:col-span-5 flex justify-center">
            <div className="relative w-64 h-80 rounded-2xl overflow-hidden border border-stone-200 shadow-lg">
              <img
                src="/images/042A8497.JPG"
                alt="Manish Vaghasiya"
                className="w-full h-full object-cover object-top"
              />
            </div>
          </div>

          <div className="md:col-span-7 space-y-4 text-left">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-widest block">Educational Initiative</span>
            <h2 className="text-3xl font-extrabold text-stone-900">Manish Vaghasiya</h2>
            <p className="text-sm text-stone-700 leading-relaxed font-medium">
              Ek Duje Ke Liye is an educational seminar and workshop initiative led by Manish Vaghasiya. The initiative focuses on relationship education, couple communication, family values, mutual understanding and practical life skills through structured educational sessions and workshops.
            </p>
            <p className="text-xs text-stone-600 leading-relaxed font-normal">
              ગુજરાતભરમાં સેંકડો પરિવારો અને હજારો દંપતીઓને વૈવાહિક સુખ, આંતરિક જોડાણ અને પારિવારિક શાંતિ તરફ દોરવા માટે વ્યવહારુ જીવન કૌશલ્ય અને સંવાદની પદ્ધતિઓ શીખવવામાં આવે છે.
            </p>
            <div className="pt-2">
              <a
                href="#events"
                className="inline-block px-6 py-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold text-xs uppercase rounded-xl transition-all shadow-md shadow-rose-600/20"
              >
                Register for Upcoming Seminar →
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* Event Photo Gallery */}
      <section id="gallery" className="relative z-10 py-20 px-6 lg:px-12 bg-stone-100/70 border-y border-stone-200/80">
        <div className="max-w-7xl mx-auto space-y-12">

          <div className="text-center space-y-3 max-w-xl mx-auto">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-widest block">Moments &amp; Atmosphere</span>
            <h2 className="text-3xl font-extrabold text-stone-900 tracking-tight">સેમિનારની અમૂલ્ય ક્ષણો</h2>
            <p className="text-stone-600 text-xs font-medium">Real glimpses from our previous Ek Duje Ke Liye couple seminars by Manish Vaghasiya.</p>
          </div>

          {/* 8-Image Grid (4x2 on desktop, 2x4 on mobile) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {GALLERY_IMAGES.map((src, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedGalleryIdx(idx)}
                className="aspect-[4/3] rounded-2xl overflow-hidden border border-stone-200 hover:border-rose-400 transition-all duration-300 group bg-stone-200 shadow-sm cursor-pointer relative"
              >
                <img
                  src={src}
                  alt={`Seminar Moment ${idx + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-stone-900 text-xs font-bold px-3 py-1.5 rounded-lg shadow-md backdrop-blur-xs">
                    🔍 View
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Fullscreen Lightbox Modal */}
        {selectedGalleryIdx !== null && (
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-fade-in"
            onClick={() => setSelectedGalleryIdx(null)}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedGalleryIdx(null)}
              className="absolute top-6 right-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl font-bold transition-all z-10 cursor-pointer"
              aria-label="Close Preview"
            >
              ✕
            </button>

            {/* Prev Arrow */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedGalleryIdx((selectedGalleryIdx - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length);
              }}
              className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center text-2xl font-bold transition-all z-10 cursor-pointer"
              aria-label="Previous Photo"
            >
              ‹
            </button>

            {/* Main Image in View */}
            <div
              className="relative max-w-5xl max-h-[85vh] w-full flex flex-col items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={GALLERY_IMAGES[selectedGalleryIdx]}
                alt={`Seminar Moment ${selectedGalleryIdx + 1}`}
                className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10"
              />
              <div className="mt-3 text-center text-xs text-white/80 font-medium">
                Photo {selectedGalleryIdx + 1} of {GALLERY_IMAGES.length} &bull; Ek Duje Ke Liye Seminar
              </div>
            </div>

            {/* Next Arrow */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedGalleryIdx((selectedGalleryIdx + 1) % GALLERY_IMAGES.length);
              }}
              className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center text-2xl font-bold transition-all z-10 cursor-pointer"
              aria-label="Next Photo"
            >
              ›
            </button>
          </div>
        )}
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative z-10 py-20 px-6 lg:px-12 max-w-4xl mx-auto space-y-10">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold text-rose-700 uppercase tracking-widest block">Got Questions?</span>
          <h2 className="text-3xl font-extrabold text-stone-900">વારંવાર પૂછાતા પ્રશ્નો (FAQ)</h2>
        </div>

        <div className="space-y-4">
          {FAQ_ITEMS.map((item, idx) => (
            <div
              key={idx}
              className="bg-white border border-stone-200 rounded-2xl overflow-hidden transition-all shadow-sm"
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full p-5 text-left flex justify-between items-center gap-4 text-sm font-bold text-stone-900 hover:text-rose-700"
              >
                <span>{item.question}</span>
                <span className="text-rose-600 text-lg font-extrabold">
                  {openFaqIndex === idx ? '−' : '+'}
                </span>
              </button>
              {openFaqIndex === idx && (
                <div className="px-5 pb-5 text-xs text-stone-600 leading-relaxed border-t border-stone-100 pt-3 animate-fade-in font-medium">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-stone-200 bg-white py-12 px-6 lg:px-12 text-stone-600 text-xs">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">

          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt={publicConfig.brandName || "Ek Duje Ke Liye"} className="h-10 w-auto" />
              <div>
                <span className="text-lg font-extrabold text-stone-900 uppercase block leading-tight">
                  {publicConfig.brandName || "Ek Duje Ke Liye"}
                </span>
                <span className="text-[11px] font-bold text-rose-700 block">
                  Educational Seminars &amp; Workshops by Manish Vaghasiya
                </span>
              </div>
            </div>
            <p className="text-stone-600 text-xs max-w-md leading-relaxed font-normal">
              Ek Duje Ke Liye is an educational seminar and workshop initiative led by Manish Vaghasiya, dedicated to empowering married couples through relationship education, communication skills, family values, and practical life-skills training.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-bold text-stone-900 block mb-2">Quick Links</span>
            <ul className="space-y-1.5 font-medium">
              <li><a href="#events" className="hover:text-rose-600">Upcoming Seminars</a></li>
              <li><a href="#experience" className="hover:text-rose-600">The Experience</a></li>
              <li><a href="#about" className="hover:text-rose-600">About Manish Vaghasiya</a></li>
              <li><a href="#gallery" className="hover:text-rose-600">Photo Gallery</a></li>
              <li><Link href="/contact" className="hover:text-rose-600">Contact Us</Link></li>
              <li><Link href="/admin" className="hover:text-rose-600">Admin Portal</Link></li>
            </ul>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-bold text-stone-900 block mb-2">Legal &amp; Policies</span>
            <ul className="space-y-1.5 font-medium">
              <li><Link href="/privacy-policy" className="hover:text-rose-600">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-rose-600">Terms &amp; Conditions</Link></li>
              <li><Link href="/cancellation-refund-policy" className="hover:text-rose-600">Cancellation &amp; Refund Policy</Link></li>
              <li><Link href="/shipping-delivery-policy" className="hover:text-rose-600">Shipping &amp; Delivery Policy</Link></li>
              <li><Link href="/contact" className="hover:text-rose-600">Help &amp; Support</Link></li>
              {publicConfig.supportPhone && (
                <li className="pt-1 text-stone-500">
                  <span>Helpline: {publicConfig.supportPhone}</span>
                </li>
              )}
            </ul>
          </div>

        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            &copy; {new Date().getFullYear()} {publicConfig.brandName || "Ek Duje Ke Liye"} &bull; Educational Seminars by Manish Vaghasiya. All rights reserved.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px]">
            <Link href="/privacy-policy" className="hover:underline">Privacy Policy</Link>
            <span>&bull;</span>
            <Link href="/terms" className="hover:underline">Terms &amp; Conditions</Link>
            <span>&bull;</span>
            <Link href="/cancellation-refund-policy" className="hover:underline">Refund Policy</Link>
            <span>&bull;</span>
            <Link href="/shipping-delivery-policy" className="hover:underline">Delivery Policy</Link>
            <span>&bull;</span>
            <Link href="/contact" className="hover:underline">Contact</Link>
          </div>
        </div>
      </footer>

      {/* Mobile Sticky Booking Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-white/95 backdrop-blur-xl border-t border-stone-200 flex items-center justify-between gap-3 shadow-2xl">
        <div className="pl-1">
          <span className="text-[10px] text-stone-500 block uppercase font-bold tracking-wider">Couple Admission Pass</span>
          <span className="text-base font-extrabold text-stone-900">
            ₹{(programs.length > 0 && programs[0].price !== undefined ? programs[0].price : 1500).toLocaleString('en-IN')} / Couple
          </span>
        </div>
        <a
          href="#events"
          className="px-5 py-2.5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-rose-600/25 text-center inline-flex items-center gap-1.5"
        >
          <TicketIcon className="w-3.5 h-3.5" />
          <span>Book Pass</span>
        </a>
      </div>

      {/* Structured Data (JSON-LD) for Educational Organization */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "EducationalOrganization",
            "name": "Ek Duje Ke Liye",
            "description": "Educational relationship and life-skills seminar initiative led by Manish Vaghasiya.",
            "url": "https://www.ekdujekeliye.in",
            "areaServed": "IN",
            "knowsAbout": ["Relationship Education", "Couple Communication", "Family Values", "Life Skills Training"]
          })
        }}
      />
    </div>
  );
}
