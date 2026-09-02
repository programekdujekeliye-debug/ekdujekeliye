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
  AlertTriangleIcon,
  InstagramIcon,
  FacebookIcon,
  YoutubeIcon,
  LinkedinIcon,
  TwitterXIcon,
  WhatsappIcon,
  PhoneIcon,
  SearchIcon,
  StarIcon,
  ArrowRightIcon,
  ArrowDownIcon,
  CheckIcon,
  LinktreeIcon
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
  isRegistrationOpen?: boolean;
  isPaymentEnabled?: boolean;
  earlyRegistrationMode?: boolean;
  paymentOpenedAt?: string | null;
  paymentOpeningNote?: string;
}

const FAQ_ITEMS = [
  {
    question: "કોણ આ સેમિનારમાં ભાગ લઈ શકે છે? (Who can attend?)",
    answer: "આ સેમિનાર તમામ કપલ્સ (Married, Engaged અને Committed Couples) માટે છે. કપલ તરીકે બંને પાર્ટનર્સનું સાથે આવવું ફરજિયાત છે. સિંગલ વ્યક્તિઓ કે બાળકોને પ્રવેશ મળશે નહીં."
  },
  {
    question: "સેમિનારનો સમયગાળો કેટલો રહેશે? (What is the duration?)",
    answer: "સેમિનાર સામાન્ય રીતે ૩ થી ૪ કલાકનો હોય છે જેમાં ઊંડાણપૂર્વકના સત્રો, વ્યવહારુ સંવાદ અને હૃદયસ્પર્શી પ્રવૃત્તિઓ સામેલ છે."
  },
  {
    question: "શું બાળકોને સાથે લાવી શકાય? (Are children allowed?)",
    answer: "ના, બંને પાર્ટનર્સ સંપૂર્ણ ધ્યાન એકબીજા પર અને સેમિનારના વિષય પર કેન્દ્રિત કરી શકે તે માટે બાળકોને લાવવાની સખત મનાઈ છે."
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
  "/seminar-optimized/042A3829.webp",
  "/seminar-optimized/042A3854.webp",
  "/seminar-optimized/042A3968.webp",
  "/seminar-optimized/042A4114.webp",
  "/seminar-optimized/042A4417.webp",
  "/seminar-optimized/042A4734.webp",
  "/seminar-optimized/042A8596.webp",
  "/seminar-optimized/042A8803.webp"
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
    manishYoutubeUrl?: string;
    manishInstagramUrl?: string;
    manishFacebookUrl?: string;
    manishLinkedinUrl?: string;
    manishTwitterUrl?: string;
    defaultPrice?: number;
  }>({});
  const [selectedCity, setSelectedCity] = useState('All');
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedGalleryIdx, setSelectedGalleryIdx] = useState<number | null>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  // Swipe detection for mobile gallery lightbox
  const touchStartX = React.useRef<number | null>(null);
  const touchEndX = React.useRef<number | null>(null);

  // Smooth scroll handler for all devices (iPhone, Android, Mac, Windows, Linux)
  const scrollToEvents = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const el = document.getElementById('events');
    if (el) {
      const headerOffset = 70;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  // Keyboard navigation & body scroll lock for Lightbox
  useEffect(() => {
    if (selectedGalleryIdx === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedGalleryIdx(null);
      } else if (e.key === 'ArrowLeft') {
        setSelectedGalleryIdx((prev) => (prev !== null ? (prev - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length : null));
      } else if (e.key === 'ArrowRight') {
        setSelectedGalleryIdx((prev) => (prev !== null ? (prev + 1) % GALLERY_IMAGES.length : null));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedGalleryIdx]);

  // Track scroll position for Mobile Sticky Bottom Booking Bar
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 280) {
        setShowStickyBar(true);
      } else {
        setShowStickyBar(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

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
            const finalPrograms = sorted.length > 0 ? sorted : list;
            setPrograms(finalPrograms);
            try {
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('edkl_events', JSON.stringify(finalPrograms));
                finalPrograms.forEach(p => {
                  if (p.slug) sessionStorage.setItem(`edkl_event_${p.slug.toLowerCase()}`, JSON.stringify(p));
                  if (p.id) sessionStorage.setItem(`edkl_event_${p.id.toLowerCase()}`, JSON.stringify(p));
                });
              }
            } catch (e) {
              // Ignore session storage errors
            }
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
            <button
              onClick={scrollToEvents}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-rose-600/20 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <TicketIcon className="w-4 h-4" />
              <span>Book Passes</span>
            </button>
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
            <button
              onClick={(e) => {
                setMobileMenuOpen(false);
                scrollToEvents(e);
              }}
              className="text-left text-stone-700 hover:text-rose-600 py-1 font-semibold cursor-pointer"
            >
              Upcoming Events
            </button>
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
              <span>A Special Program for Couples</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-stone-900 tracking-tight leading-[1.18]">
              એક દૂજે કે લિયે <br />
              <span className="text-gradient-royal">
                પ્રેમ અને વિશ્વાસનો અનોખો સેમિનાર
              </span>
            </h1>

            <p className="text-stone-600 text-base md:text-lg leading-relaxed max-w-2xl mx-auto lg:mx-0 font-normal">
              પતિ-પત્ની વચ્ચે ઊંડો પ્રેમ, અખૂટ વિશ્વાસ અને મધુર સંવાદ કેળવવા માટેનો વિશેષ કપલ સેમિનાર led by <strong>Manish Vaghasiya</strong>.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                onClick={scrollToEvents}
                className="inline-flex items-center gap-2.5 px-8 py-4 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-extrabold rounded-2xl transition-all shadow-xl shadow-rose-600/25 text-sm uppercase tracking-wider transform hover:scale-105 active:scale-95 cursor-pointer"
              >
                <TicketIcon className="w-4 h-4" />
                <span>View Upcoming Seminars</span>
              </button>
              <a
                href="#experience"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 font-bold rounded-2xl transition-all text-sm shadow-sm"
              >
                <span>Explore Experience</span>
                <ArrowDownIcon className="w-4 h-4 text-stone-500" />
              </a>
            </div>

            {/* Badges */}
            <div className="pt-6 border-t border-stone-200 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs font-semibold text-stone-600">
              <div className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>A Special Program for Couples (Married &amp; Committed)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>Instant Digital Pass on Razorpay</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>WhatsApp Delivery</span>
              </div>
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <CheckIcon className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Strictly Non-Refundable &amp; Non-Transferable</span>
              </div>
            </div>
          </div>

          {/* Hero Visual Card */}
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="relative w-full max-w-md aspect-[4/5] rounded-3xl overflow-hidden border border-stone-200 shadow-2xl bg-stone-100">
              <img
                src="/images/opt_042A3646.jpg"
                alt="Manish Vaghasiya - Ek Duje Ke Liye"
                className="w-full h-full object-cover object-top scale-x-[-1]"
                loading="eager"
                decoding="async"
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
              Upcoming Couple Seminars &amp; Programs
            </h2>
            <p className="text-stone-600 text-sm font-medium">
              Choose your preferred city and register for your couple pass securely.
            </p>
          </div>

          {/* Dynamic City Filter */}
          {!loadingEvents && programs.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto">
              {['All', ...Array.from(new Set(programs.map(p => p.city).filter((c): c is string => Boolean(c))))].map((city) => (
                <button
                  key={city}
                  onClick={() => setSelectedCity(city)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedCity === city
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
                <p className="text-xs text-rose-700 font-bold">Loading upcoming seminars...</p>
              </div>
            </div>
          ) : programs.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-3xl p-12 text-center max-w-lg mx-auto space-y-3 shadow-md">
              <TicketIcon className="w-8 h-8 text-rose-600 mx-auto" />
              <h3 className="text-xl font-bold text-stone-900">New Seminar Dates Coming Soon</h3>
              <p className="text-xs text-stone-600 leading-relaxed font-medium">
                New seminar dates will be announced soon. Follow our official channels for instant updates.
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
                const isEarlyReg = Boolean(prog.earlyRegistrationMode || prog.isPaymentEnabled === false);
                const eventPrice = prog.price !== undefined ? prog.price : 1500;

                let statusLabel = 'UPCOMING';
                let statusClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                if (isCompleted) {
                  statusLabel = 'COMPLETED';
                  statusClass = 'bg-stone-100 text-stone-600 border-stone-200';
                } else if (isEarlyReg) {
                  statusLabel = 'EARLY REGISTRATION OPEN';
                  statusClass = 'bg-rose-50 text-rose-800 border-rose-300 font-extrabold';
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
                            Couple Program
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

                      {isEarlyReg && (
                        <div className="p-3 bg-rose-50/70 border border-rose-200/90 rounded-2xl text-[11px] text-rose-900 space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <SparklesIcon className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                            <span>Early Registration Open (વહેલી નોંધણી શરૂ)</span>
                          </div>
                          <p className="text-stone-600 leading-relaxed font-medium">
                            Register now without immediate payment. Online payment link will be sent on your WhatsApp shortly.
                          </p>
                        </div>
                      )}
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
                            <span>{isEarlyReg ? 'Register Now' : 'Register for Seminar'}</span>
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
              <span className="text-2xl font-extrabold text-rose-600 block">01</span>
              <h4 className="text-sm font-bold text-stone-900">શહેર પસંદ કરો</h4>
              <p className="text-[11px] text-stone-600 font-medium">તમારા અનુકૂળ શહેર અને તારીખ પર ક્લિક કરો.</p>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-2 shadow-sm">
              <span className="text-2xl font-extrabold text-amber-600 block">02</span>
              <h4 className="text-sm font-bold text-stone-900">વિગતો ભરો</h4>
              <p className="text-[11px] text-stone-600 font-medium">પતિ-પત્નીનું નામ અને મોબાઈલ નંબર લખો.</p>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-2 shadow-sm">
              <span className="text-2xl font-extrabold text-rose-600 block">03</span>
              <h4 className="text-sm font-bold text-stone-900">કપલ ફોટો અપલોડ</h4>
              <p className="text-[11px] text-stone-600 font-medium">પાસ માટે તમારો સુંદર ફોટો પસંદ કરો.</p>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-2 shadow-sm">
              <span className="text-2xl font-extrabold text-amber-600 block">04</span>
              <h4 className="text-sm font-bold text-stone-900">Razorpay પેમેન્ટ</h4>
              <p className="text-[11px] text-stone-600 font-medium">UPI, Card કે NetBanking થી સુરક્ષિત પેમેન્ટ કરો.</p>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-2 shadow-sm">
              <span className="text-2xl font-extrabold text-emerald-600 block">05</span>
              <h4 className="text-sm font-bold text-stone-900">ડિજિટલ પાસ</h4>
              <p className="text-[11px] text-stone-600 font-medium">તરત જ સ્ક્રીન અને WhatsApp પર પાસ મેળવો.</p>
            </div>
          </div>

        </div>
      </section>

      {/* Couple Reflections & Real Impact Section */}
      <section className="relative z-10 py-20 px-6 lg:px-12 max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-bold text-rose-700 uppercase tracking-widest block">Real Couple Stories</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-stone-900 tracking-tight">
            દંપતીઓના હૃદયસ્પર્શી અનુભવો
          </h2>
          <p className="text-stone-600 text-sm font-medium">
            Hear from couples whose relationships blossomed through Ek Duje Ke Liye.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-stone-200/90 rounded-3xl p-6 md:p-8 space-y-4 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <StarIcon key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-stone-700 text-xs sm:text-sm leading-relaxed italic">
                &ldquo;આ સેમિનારમાં આવ્યા પછી અમને સમજાયું કે રોજિંદી વ્યસ્તતામાં અમે એકબીજા માટે સમય કાઢવાનું ભૂલી ગયા હતા. મનીષભાઈના માર્ગદર્શને અમારા દાંપત્યજીવનમાં નવો ઉમંગ ભરી દીધો.&rdquo;
              </p>
            </div>
            <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
              <div>
                <span className="font-extrabold text-stone-900 text-xs block">ભાવેશ &amp; શીતલ પટેલ</span>
                <span className="text-[10px] text-rose-700 font-semibold">સુરત • લગ્નના ૧૨ વર્ષ</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-700 font-bold rounded-md border border-rose-200">Verified Couple</span>
            </div>
          </div>

          <div className="bg-white border border-stone-200/90 rounded-3xl p-6 md:p-8 space-y-4 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <StarIcon key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-stone-700 text-xs sm:text-sm leading-relaxed italic">
                &ldquo;વાતચીત કેવી રીતે કરવી અને નાની નાની ગેરસમજો કેવી રીતે દૂર કરવી તે આ સેમિનારમાંથી શીખવા મળ્યું. દરેક પરણેલા કપલે આ સેમિનાર ચોક્કસ એટેન્ડ કરવો જોઈએ.&rdquo;
              </p>
            </div>
            <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
              <div>
                <span className="font-extrabold text-stone-900 text-xs block">મેહુલ &amp; પ્રીતિ શાહ</span>
                <span className="text-[10px] text-rose-700 font-semibold">અમદાવાદ • લગ્નના ૮ વર્ષ</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-700 font-bold rounded-md border border-rose-200">Verified Couple</span>
            </div>
          </div>

          <div className="bg-white border border-stone-200/90 rounded-3xl p-6 md:p-8 space-y-4 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <StarIcon key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-stone-700 text-xs sm:text-sm leading-relaxed italic">
                &ldquo;સેમિનારનું વાતાવરણ ખૂબ જ પવિત્ર અને હૃદયસ્પર્શી હતું. કોઈ બોરિંગ લેક્ચર નહીં પણ પ્રેક્ટિકલ એક્ટિવિટીઝ સાથે અમારા પ્રેમને ફરી તાજો કર્યો. દિલથી આભાર!&rdquo;
              </p>
            </div>
            <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
              <div>
                <span className="font-extrabold text-stone-900 text-xs block">જયેશ &amp; પૂજા વાઘાણી</span>
                <span className="text-[10px] text-rose-700 font-semibold">રાજકોટ • લગ્નના ૧૫ વર્ષ</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-700 font-bold rounded-md border border-rose-200">Verified Couple</span>
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
                src="/images/opt_042A8497.jpg"
                alt="Manish Vaghasiya"
                className="w-full h-full object-cover object-top"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>

          <div className="md:col-span-7 space-y-4 text-left">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-widest block">About the Program</span>
            <h2 className="text-3xl font-extrabold text-stone-900">Manish Vaghasiya</h2>
            <p className="text-sm text-stone-700 leading-relaxed font-medium">
              Ek Duje Ke Liye is a special seminar and interactive program initiative created for couples (married, engaged &amp; committed), led by Manish Vaghasiya. The program focuses on strengthening relationships, deep communication, mutual trust, and understanding through engaging and meaningful sessions.
            </p>
            <p className="text-xs text-stone-600 leading-relaxed font-normal">
              ગુજરાતભરમાં સેંકડો પરિવારો અને હજારો કપલ્સને જીવનભરના સ્નેહ, આંતરિક જોડાણ અને સંબંધોમાં ખુશી તરફ દોરવા માટે વ્યવહારુ સંવાદ અને જીવનશૈલીની પ્રેરણા આપવામાં આવે છે.
            </p>
            <div className="pt-2">
              <a
                href="#events"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold text-xs uppercase rounded-xl transition-all shadow-md shadow-rose-600/20"
              >
                <span>Register for Upcoming Seminar</span>
                <ArrowRightIcon className="w-4 h-4" />
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* Event Photo Gallery */}
      <section id="gallery" className="relative z-10 py-20 px-6 lg:px-12 bg-stone-50 border-y border-stone-200">
        <div className="max-w-7xl mx-auto space-y-12">

          <div className="text-center space-y-3 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold uppercase tracking-widest">
              Moments &amp; Atmosphere
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-stone-900 tracking-tight">
              સેમિનારની અમૂલ્ય ક્ષણો
            </h2>
            <p className="text-stone-600 text-sm font-medium">
              Real glimpses from our previous Ek Duje Ke Liye couple seminars by Manish Vaghasiya.
            </p>
          </div>

          {/* 8-Image Grid (4x2 on desktop, 2x4 on mobile) */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
            {GALLERY_IMAGES.map((src, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedGalleryIdx(idx)}
                className="aspect-[4/3] rounded-2xl overflow-hidden border border-stone-200 hover:border-rose-500 transition-all duration-300 group bg-stone-100 shadow-sm hover:shadow-xl cursor-pointer relative"
              >
                <img
                  src={src}
                  alt={`Seminar Moment ${idx + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                />
                <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/25 transition-all duration-300 flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 bg-white/95 text-stone-900 text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-lg backdrop-blur-xs flex items-center gap-1.5">
                    <SearchIcon className="w-3.5 h-3.5 text-stone-800" />
                    <span>View Photo</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Fullscreen Lightbox Modal with Touch Swipe & Keyboard Navigation */}
        {selectedGalleryIdx !== null && (
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 md:p-6 select-none animate-fade-in"
            onClick={() => setSelectedGalleryIdx(null)}
            onTouchStart={(e) => {
              touchStartX.current = e.touches[0].clientX;
              touchEndX.current = null;
            }}
            onTouchMove={(e) => {
              touchEndX.current = e.touches[0].clientX;
            }}
            onTouchEnd={() => {
              if (!touchStartX.current || !touchEndX.current) return;
              const diffX = touchStartX.current - touchEndX.current;
              if (diffX > 40) {
                // Swiped Left -> Next Photo
                setSelectedGalleryIdx((prev) => (prev !== null ? (prev + 1) % GALLERY_IMAGES.length : null));
              } else if (diffX < -40) {
                // Swiped Right -> Prev Photo
                setSelectedGalleryIdx((prev) => (prev !== null ? (prev - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length : null));
              }
              touchStartX.current = null;
              touchEndX.current = null;
            }}
          >
            {/* Top Bar: Counter & Close */}
            <div
              className="w-full max-w-5xl flex items-center justify-between z-20 py-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3.5 py-1.5 rounded-full bg-white/10 text-white text-xs font-bold backdrop-blur-md">
                Photo {selectedGalleryIdx + 1} of {GALLERY_IMAGES.length}
              </div>
              <button
                onClick={() => setSelectedGalleryIdx(null)}
                className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center text-sm font-bold transition-all cursor-pointer shadow-md"
                aria-label="Close Photo Lightbox"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Middle: Prev Arrow, Image, Next Arrow */}
            <div
              className="relative w-full max-w-5xl flex-1 flex items-center justify-center my-2"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Prev Arrow */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedGalleryIdx((selectedGalleryIdx - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length);
                }}
                className="absolute left-2 md:left-4 z-20 w-11 h-11 md:w-14 md:h-14 rounded-full bg-white/15 hover:bg-white/30 active:scale-90 text-white flex items-center justify-center text-2xl md:text-3xl font-bold transition-all cursor-pointer backdrop-blur-sm shadow-xl"
                aria-label="Previous Photo"
              >
                ‹
              </button>

              {/* Main Photo Container */}
              <div className="relative max-w-full max-h-[70vh] md:max-h-[76vh] flex items-center justify-center">
                <img
                  key={selectedGalleryIdx}
                  src={GALLERY_IMAGES[selectedGalleryIdx]}
                  alt={`Ek Duje Ke Liye Seminar Moment ${selectedGalleryIdx + 1}`}
                  decoding="async"
                  className="max-w-full max-h-[70vh] md:max-h-[76vh] object-contain rounded-2xl shadow-2xl border border-white/10 transition-all duration-200"
                />
              </div>

              {/* Next Arrow */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedGalleryIdx((selectedGalleryIdx + 1) % GALLERY_IMAGES.length);
                }}
                className="absolute right-2 md:right-4 z-20 w-11 h-11 md:w-14 md:h-14 rounded-full bg-white/15 hover:bg-white/30 active:scale-90 text-white flex items-center justify-center text-2xl md:text-3xl font-bold transition-all cursor-pointer backdrop-blur-sm shadow-xl"
                aria-label="Next Photo"
              >
                ›
              </button>
            </div>

            {/* Bottom Bar: Thumbnail Indicators */}
            <div
              className="w-full max-w-2xl flex items-center justify-center gap-2 py-2 overflow-x-auto no-scrollbar z-20"
              onClick={(e) => e.stopPropagation()}
            >
              {GALLERY_IMAGES.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedGalleryIdx(i)}
                  className={`relative w-10 h-7 md:w-12 md:h-9 rounded-lg overflow-hidden border-2 transition-all cursor-pointer flex-shrink-0 ${selectedGalleryIdx === i
                      ? 'border-rose-500 scale-110 shadow-lg ring-2 ring-rose-400/40'
                      : 'border-white/20 opacity-50 hover:opacity-100'
                    }`}
                >
                  <img src={src} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
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
      <footer className="relative z-10 border-t border-stone-200 bg-white pt-14 pb-20 md:pb-12 px-6 lg:px-12 text-stone-600 text-xs">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10 mb-10">

          {/* Brand Bio & Support Details (5 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt={publicConfig.brandName || "Ek Duje Ke Liye"} className="h-11 w-auto object-contain" />
              <div>
                <span className="text-lg font-extrabold text-stone-900 uppercase block leading-tight">
                  {publicConfig.brandName || "Ek Duje Ke Liye"}
                </span>
                <span className="text-[11px] font-bold text-rose-700 block">
                  A Program for Couples by Manish Vaghasiya
                </span>
              </div>
            </div>
            <p className="text-stone-600 text-xs leading-relaxed font-normal">
              Ek Duje Ke Liye is an interactive seminar initiative led by Manish Vaghasiya, designed for couples (married, engaged &amp; committed) to cultivate lifelong love, unbreakable trust, communication, and lasting relationship happiness.
            </p>

            {/* Direct Contact / Helpline */}
            <div className="pt-2 space-y-2 text-xs">
              <a
                href={`tel:${(publicConfig.supportPhone || '+91 82003 02328').replace(/\s+/g, '')}`}
                className="inline-flex items-center gap-2 text-stone-800 hover:text-rose-600 font-bold transition-colors"
              >
                <PhoneIcon className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>Helpline: {publicConfig.supportPhone || '+91 82003 02328'}</span>
              </a>
              <div>
                <a
                  href={`https://wa.me/${(publicConfig.supportWhatsapp || '918200302328').replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-emerald-700 hover:text-emerald-800 font-bold transition-colors"
                >
                  <WhatsappIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>WhatsApp Assistance</span>
                </a>
              </div>
            </div>
          </div>

          {/* Quick Navigation Links (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-stone-900 block">
              Quick Links
            </span>
            <ul className="space-y-2 font-semibold text-stone-600 text-xs">
              <li>
                <a href="#events" className="hover:text-rose-600 transition-colors">Upcoming Seminars</a>
              </li>
              <li>
                <a href="#experience" className="hover:text-rose-600 transition-colors">The Experience</a>
              </li>
              <li>
                <a href="#about" className="hover:text-rose-600 transition-colors">About Manish Vaghasiya</a>
              </li>
              <li>
                <a href="#gallery" className="hover:text-rose-600 transition-colors">Photo Gallery</a>
              </li>
              <li>
                <a href="#faq" className="hover:text-rose-600 transition-colors">Frequently Asked Questions</a>
              </li>
              <li>
                <Link href="/contact" className="hover:text-rose-600 transition-colors">Contact &amp; Support</Link>
              </li>
            </ul>
          </div>

          {/* Legal & Regulatory Policies (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-stone-900 block">
              Legal &amp; Compliance
            </span>
            <ul className="space-y-2 font-medium text-stone-600 text-xs">
              <li>
                <Link href="/privacy-policy" className="hover:text-rose-600 transition-colors">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-rose-600 transition-colors">Terms &amp; Conditions</Link>
              </li>
              <li>
                <Link href="/cancellation-refund-policy" className="hover:text-rose-600 transition-colors">Cancellation &amp; Refund Policy</Link>
              </li>
              <li>
                <Link href="/shipping-delivery-policy" className="hover:text-rose-600 transition-colors">Shipping &amp; Delivery Policy</Link>
              </li>
              <li className="pt-2 text-[11px] text-amber-800 font-medium">
                Passes are strictly non-refundable and valid only for registered couples.
              </li>
            </ul>
          </div>

          {/* Official Social Media Channels (3 cols) */}
          <div className="lg:col-span-3 space-y-5">
            {/* Ek Duje Ke Liye Pages */}
            <div className="space-y-2.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-rose-800 block">
                Ek Duje Ke Liye Official
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={publicConfig.instagramUrl || "https://www.instagram.com/ekdujekeliye"}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ek Duje Ke Liye Instagram"
                  className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-rose-50 border border-stone-200 hover:border-rose-300 text-stone-700 hover:text-rose-600 flex items-center justify-center transition-all shadow-xs"
                  title="Ek Duje Ke Liye Instagram"
                >
                  <InstagramIcon className="w-4 h-4" />
                </a>
                <a
                  href={publicConfig.facebookUrl || "https://www.facebook.com/ekdujekeliye"}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ek Duje Ke Liye Facebook"
                  className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-rose-50 border border-stone-200 hover:border-rose-300 text-stone-700 hover:text-rose-600 flex items-center justify-center transition-all shadow-xs"
                  title="Ek Duje Ke Liye Facebook"
                >
                  <FacebookIcon className="w-4 h-4" />
                </a>
                {publicConfig.linktreeUrl && (
                  <a
                    href={publicConfig.linktreeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Ek Duje Ke Liye Linktree"
                    className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-emerald-50 border border-stone-200 hover:border-emerald-300 text-stone-700 hover:text-emerald-700 flex items-center justify-center transition-all shadow-xs"
                    title="Official Linktree / All Profiles"
                  >
                    <LinktreeIcon className="w-4 h-4" />
                  </a>
                )}
                {publicConfig.youtubeUrl && (
                  <a
                    href={publicConfig.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Ek Duje Ke Liye YouTube"
                    className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-red-50 border border-stone-200 hover:border-red-300 text-stone-700 hover:text-red-600 flex items-center justify-center transition-all shadow-xs"
                    title="YouTube Channel"
                  >
                    <YoutubeIcon className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Manish Vaghasiya Channels */}
            <div className="space-y-2.5 pt-2 border-t border-stone-200">
              <span className="text-xs font-extrabold uppercase tracking-wider text-stone-900 block">
                Manish Vaghasiya
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={publicConfig.manishYoutubeUrl || publicConfig.youtubeUrl || "https://www.youtube.com/@manishvaghasiya"}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Manish Vaghasiya YouTube"
                  className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-rose-50 border border-stone-200 hover:border-rose-300 text-stone-700 hover:text-red-600 flex items-center justify-center transition-all shadow-xs"
                  title="YouTube Channel"
                >
                  <YoutubeIcon className="w-4 h-4" />
                </a>
                <a
                  href={publicConfig.manishInstagramUrl || "https://www.instagram.com/manishvaghasiya_"}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Manish Vaghasiya Instagram"
                  className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-rose-50 border border-stone-200 hover:border-rose-300 text-stone-700 hover:text-pink-600 flex items-center justify-center transition-all shadow-xs"
                  title="Instagram Profile"
                >
                  <InstagramIcon className="w-4 h-4" />
                </a>
                <a
                  href={publicConfig.manishFacebookUrl || "https://www.facebook.com/manishvaghasiya"}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Manish Vaghasiya Facebook"
                  className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-rose-50 border border-stone-200 hover:border-rose-300 text-stone-700 hover:text-blue-600 flex items-center justify-center transition-all shadow-xs"
                  title="Facebook Profile"
                >
                  <FacebookIcon className="w-4 h-4" />
                </a>
                <a
                  href={publicConfig.manishLinkedinUrl || "https://www.linkedin.com/in/manishvaghasiya"}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Manish Vaghasiya LinkedIn"
                  className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-rose-50 border border-stone-200 hover:border-rose-300 text-stone-700 hover:text-sky-700 flex items-center justify-center transition-all shadow-xs"
                  title="LinkedIn"
                >
                  <LinkedinIcon className="w-4 h-4" />
                </a>
                <a
                  href={publicConfig.manishTwitterUrl || "https://twitter.com/manishvaghasiya"}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Manish Vaghasiya X / Twitter"
                  className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-rose-50 border border-stone-200 hover:border-rose-300 text-stone-700 hover:text-stone-900 flex items-center justify-center transition-all shadow-xs"
                  title="X (Twitter)"
                >
                  <TwitterXIcon className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Bar: Copyright & Inline Links (No Admin link) */}
        <div className="max-w-7xl mx-auto pt-6 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-xs">
          <div>
            &copy; {new Date().getFullYear()} {publicConfig.brandName || "Ek Duje Ke Liye"} &bull; A Special Program for Couples by Manish Vaghasiya. All rights reserved.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px]">
            <Link href="/privacy-policy" className="hover:text-rose-600 hover:underline">Privacy Policy</Link>
            <span>&bull;</span>
            <Link href="/terms" className="hover:text-rose-600 hover:underline">Terms &amp; Conditions</Link>
            <span>&bull;</span>
            <Link href="/cancellation-refund-policy" className="hover:text-rose-600 hover:underline">Refund Policy</Link>
            <span>&bull;</span>
            <Link href="/shipping-delivery-policy" className="hover:text-rose-600 hover:underline">Delivery Policy</Link>
            <span>&bull;</span>
            <Link href="/contact" className="hover:text-rose-600 hover:underline">Contact Us</Link>
          </div>
        </div>
      </footer>

      {/* Mobile Sticky Booking Bar with Safe Area Support */}
      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 pb-safe bg-white/95 backdrop-blur-xl border-t border-stone-200/90 shadow-2xl flex items-center justify-between gap-3 transition-all duration-300 transform ${showStickyBar ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
          }`}
      >
        <div className="pl-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block">Couple Pass</span>
            <span className="px-1.5 py-0.2 bg-rose-50 text-rose-700 text-[9px] font-bold rounded-md border border-rose-200">2 Persons</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-extrabold text-stone-900 leading-tight">
              ₹{(programs.length > 0 && programs[0].price !== undefined ? programs[0].price : 1500).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-stone-500 font-medium">/ Couple</span>
          </div>
        </div>

        <button
          onClick={scrollToEvents}
          className="px-5 py-2.5 min-h-[42px] bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-700 hover:to-amber-700 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-rose-600/30 text-center inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <TicketIcon className="w-4 h-4 text-white flex-shrink-0" />
          <span>Book Pass</span>
        </button>
      </div>

      {/* Structured Data (JSON-LD) for Event Organization */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Ek Duje Ke Liye",
            "description": "A special interactive program for couples led by Manish Vaghasiya.",
            "url": "https://www.ekdujekeliye.in",
            "areaServed": "IN"
          })
        }}
      />
    </div>
  );
}
