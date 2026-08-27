'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../config';

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

export const formatIndianDate = (dateStr?: string): string => {
  if (!dateStr || dateStr.toLowerCase() === 'tbd') return 'તારીખ ટૂંક સમયમાં (TBD)';
  const ymdMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = months[parseInt(month, 10) - 1] || month;
    return `${day}/${month}/${year} (${day} ${monthName} ${year})`;
  }
  return dateStr;
};

const GALLERY_IMAGES = [
  '/images/042A3829.JPG',
  '/images/042A4114.JPG',
  '/images/042A4417.JPG',
  '/images/042A4734.JPG',
  '/images/042A8596.JPG',
  '/images/042A8803.JPG',
  '/images/042A9259.JPG',
  '/images/DSC00892.JPG'
];

const FAQ_ITEMS = [
  {
    question: 'આ પ્રોગ્રામમાં કોણ ભાગ લઈ શકે છે? (Who can attend?)',
    answer: 'આ સેમિનાર ફક્ત પરિણીત દંપતીઓ (Married Couples) માટે જ છે. એક પાસ પર ફક્ત પતિ અને પત્ની (૨ વ્યક્તિ) ને જ પ્રવેશ મળશે.'
  },
  {
    question: 'શું બાળકોને સાથે લાવી શકાય? (Are children allowed?)',
    answer: 'ના, કાર્યક્રમની ગંભીરતા અને શાંત વાતાવરણ જાળવવા બાળકોને પ્રવેશ આપવામાં આવતો નથી.'
  },
  {
    question: 'પેમેન્ટ કર્યા પછી પાસ કેવી રીતે મળશે? (How will I receive the pass?)',
    answer: 'Razorpay દ્વારા પેમેન્ટ પૂર્ણ થતાં જ સ્ક્રીન પર તરત તમારો ફોટોવાળો ડિજિટલ પાસ ડાઉનલોડ કરવા માટે મળી જશે અને તમારા WhatsApp નંબર પર પણ લિંક મોકલવામાં આવશે.'
  },
  {
    question: 'જો પેમેન્ટ અટકી જાય તો શું કરવું? (What if payment gets interrupted?)',
    answer: 'તમારું રજીસ્ટ્રેશન અમારા ડેટાબેઝમાં સુરક્ષિત રહે છે. તમે વેબસાઇટ પરથી સીધા "Complete Payment" લિંક પર ક્લિક કરી પેમેન્ટ ફરીથી પૂર્ણ કરી શકો છો.'
  },
  {
    question: 'પાસ કેન્સલ અથવા ટ્રાન્સફર થઈ શકે? (Is pass refundable or transferable?)',
    answer: 'એકવાર પાસ જનરેટ થયા પછી પાસ નોન-રિફંડેબલ અને નોન-ટ્રાન્સફરેબલ છે.'
  }
];

export default function LandingPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      setLoadingEvents(true);
      const res = await fetch(`${API_BASE_URL}/api/programs`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // Robust filter to display only open upcoming events
          const activeUpcoming = data.filter((p: Program) => {
            if (p.isInquiryClosed === true || p.isDateFinal === false || p.date === 'TBD') {
              return false;
            }
            if (p.status === 'completed' || p.status === 'housefull' || p.status === 'registration_closed') {
              return false;
            }
            if (p.capacity > 0 && p.bookingsCount >= p.capacity) {
              return false;
            }
            return true;
          });
          setPrograms(activeUpcoming);
        }
      }
    } catch (err) {
      console.error('Error fetching programs from database API:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-[#080205] text-slate-100 font-sans selection:bg-rose-500 selection:text-white relative overflow-x-hidden">

      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-rose-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] bg-amber-600/10 rounded-full blur-[160px]" />
        <div className="absolute bottom-[10%] left-[-10%] w-[600px] h-[600px] bg-rose-700/10 rounded-full blur-[160px]" />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#0c0306]/85 backdrop-blur-xl border-b border-rose-950/40 px-6 lg:px-12 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/logo.png"
              alt="Ek Duje Ke Liye Logo"
              className="h-10 md:h-12 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <div>
              <span className="text-lg md:text-xl font-extrabold tracking-wider text-slate-100 uppercase block leading-tight">
                Ek Duje Ke Liye
              </span>
              <span className="text-[10px] tracking-widest text-rose-400 font-semibold uppercase block">
                by Manish Vaghasiya
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#events" className="hover:text-rose-400 transition-colors">Upcoming Events</a>
            <a href="#experience" className="hover:text-rose-400 transition-colors">The Experience</a>
            <a href="#about" className="hover:text-rose-400 transition-colors">About Host</a>
            <a href="#gallery" className="hover:text-rose-400 transition-colors">Gallery</a>
            <a href="#faq" className="hover:text-rose-400 transition-colors">FAQ</a>
          </div>

          {/* Header Action */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href="#events"
              className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-rose-500/20 hover:scale-105"
            >
              🎟️ Book Tickets
            </a>
          </div>

          {/* Mobile Menu Trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            className="md:hidden p-2 text-slate-300 hover:text-white"
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
          <div className="md:hidden pt-4 pb-6 px-4 border-t border-rose-950/40 flex flex-col gap-4 text-sm font-medium animate-fade-in">
            <a
              href="#events"
              onClick={() => setMobileMenuOpen(false)}
              className="text-slate-200 hover:text-rose-400 py-1"
            >
              Upcoming Events
            </a>
            <a
              href="#experience"
              onClick={() => setMobileMenuOpen(false)}
              className="text-slate-200 hover:text-rose-400 py-1"
            >
              The Experience
            </a>
            <a
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className="text-slate-200 hover:text-rose-400 py-1"
            >
              About Manish Vaghasiya
            </a>
            <a
              href="#gallery"
              onClick={() => setMobileMenuOpen(false)}
              className="text-slate-200 hover:text-rose-400 py-1"
            >
              Photo Gallery
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="text-slate-200 hover:text-rose-400 py-1"
            >
              FAQ
            </a>
            <a
              href="#events"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-3 bg-rose-500 text-white font-bold text-center rounded-xl text-xs uppercase tracking-wider mt-2"
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
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold uppercase tracking-widest mx-auto lg:mx-0">
              <span>❤️</span>
              <span>A Life-Transforming Couple Experience</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-100 tracking-tight leading-[1.15]">
              એક દૂજે કે લિયે <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-amber-300 to-rose-400">
                પ્રેમ અને સમજણનો સેમિનાર
              </span>
            </h1>

            <p className="text-slate-300 text-base md:text-lg leading-relaxed max-w-2xl mx-auto lg:mx-0">
              પતિ-પત્ની વચ્ચે ઊંડો પ્રેમ, અખૂટ વિશ્વાસ, મધુર સંવાદ અને અતૂટ સંબંધ બાંધવા માટેનો સ્પેશિયલ કપલ સેમિનાર by <strong>Manish Vaghasiya</strong>.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <a
                href="#events"
                className="px-8 py-4 bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-slate-950 font-extrabold rounded-2xl transition-all shadow-xl shadow-rose-500/25 text-sm uppercase tracking-wider transform hover:scale-105 active:scale-95"
              >
                🎟️ View Upcoming Events
              </a>
              <a
                href="#experience"
                className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold rounded-2xl transition-all text-sm"
              >
                Learn More ↓
              </a>
            </div>

            {/* Badges */}
            <div className="pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="text-rose-400">✓</span> For Married Couples Only
              </div>
              <div className="flex items-center gap-2">
                <span className="text-rose-400">✓</span> Instant Pass on Razorpay
              </div>
              <div className="flex items-center gap-2">
                <span className="text-rose-400">✓</span> WhatsApp Delivery
              </div>
            </div>
          </div>

          {/* Hero Visual Card */}
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="relative w-full max-w-md aspect-[4/5] rounded-3xl overflow-hidden border border-rose-950/60 shadow-2xl shadow-rose-950/50 bg-gradient-to-b from-rose-950/20 to-black">
              <img
                src="/images/1 (2).png"
                alt="Manish Vaghasiya - Ek Duje Ke Liye"
                className="w-full h-full object-cover object-top filter contrast-[1.05]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080205] via-transparent to-transparent opacity-90" />

              <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 text-left">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Keynote Host</span>
                <span className="text-lg font-extrabold text-white block">Manish Vaghasiya</span>
                <span className="text-xs text-slate-300 block">Life &amp; Relationship Facilitator</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Upcoming Events Section */}
      <section id="events" className="relative z-10 py-20 px-6 lg:px-12 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-7xl mx-auto space-y-12">

          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block">Reserve Your Seats</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-100">
              Upcoming Events &amp; Cities
            </h2>
            <p className="text-slate-400 text-sm">
              Choose your preferred city and book your couple admission pass securely.
            </p>
          </div>

          {/* Event Cards Grid */}
          {loadingEvents ? (
            <div className="flex justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
                <p className="text-xs text-rose-300 font-semibold">Loading upcoming events...</p>
              </div>
            </div>
          ) : programs.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center max-w-lg mx-auto space-y-3">
              <span className="text-3xl block">🎟️</span>
              <h3 className="text-xl font-bold text-slate-100">New Events Coming Soon</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                New seminar dates will be announced soon. Follow our official Instagram for instant updates.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
              {programs.map((prog) => {
                const isExternal = prog.registrationMode === 'external';
                const isHousefull = prog.status === 'housefull';
                const isClosed = prog.status === 'registration_closed';
                const isTba = prog.status === 'date_tba';
                const eventPrice = prog.price !== undefined ? prog.price : 1000;

                let statusLabel = 'UPCOMING';
                let statusClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
                if (prog.status === 'few_seats') {
                  statusLabel = 'FEW SEATS LEFT';
                  statusClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
                } else if (isHousefull) {
                  statusLabel = 'HOUSEFULL';
                  statusClass = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
                } else if (isClosed) {
                  statusLabel = 'REGISTRATION CLOSED';
                  statusClass = 'bg-slate-500/15 text-slate-400 border-slate-500/30';
                } else if (isTba) {
                  statusLabel = 'DATE TBA';
                  statusClass = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
                }

                return (
                  <div
                    key={prog.id}
                    className="bg-white/5 border border-white/10 hover:border-rose-500/40 rounded-3xl p-6 md:p-8 backdrop-blur-xl transition-all duration-300 hover:shadow-2xl hover:shadow-rose-950/40 flex flex-col justify-between space-y-6 group"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-3 py-1 bg-rose-500/20 text-rose-300 font-bold text-xs rounded-lg uppercase tracking-wider">
                          📍 {prog.city || 'Surat'}
                        </span>
                        <span className={`px-3 py-1 font-bold text-[11px] rounded-lg border uppercase tracking-wider ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </div>

                      <h3 className="text-2xl font-extrabold text-slate-100 group-hover:text-rose-300 transition-colors">
                        {prog.name}
                      </h3>

                      <div className="space-y-2 text-sm text-slate-300">
                        <div className="flex items-center gap-3">
                          <span className="text-base">📅</span>
                          <span>{formatIndianDate(prog.date)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-base">⏰</span>
                          <span>{prog.time}</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="text-base">📍</span>
                          <span className="text-xs text-slate-400 leading-tight">
                            {prog.venue || 'Sardar Patel Smruti Bhavan, Varachha, Surat'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[11px] text-slate-400 block uppercase">Couple Pass</span>
                        <span className="text-xl font-extrabold text-amber-400">₹{eventPrice}</span>
                      </div>

                      {isHousefull || isClosed ? (
                        <button
                          disabled
                          className="px-6 py-3 bg-slate-800 text-slate-500 font-bold text-xs uppercase rounded-xl cursor-not-allowed"
                        >
                          {isHousefull ? 'Housefull' : 'Closed'}
                        </button>
                      ) : isExternal ? (
                        <a
                          href={prog.externalRegistrationUrl || 'https://linktr.ee/ekdujekeliye'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/20 text-center"
                        >
                          Register on Portal ↗
                        </a>
                      ) : (
                        <Link
                          href={`/event/${prog.slug || prog.id}`}
                          className="px-6 py-3 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-rose-500/20 text-center"
                        >
                          Book Pass →
                        </Link>
                      )}
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
          <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block">Why Attend</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-100">
            તમારા સંબંધ માટે એક અવિસ્મરણીય સાંજ
          </h2>
          <p className="text-slate-400 text-sm">
            Discover the keys to a joyful, resilient, and romantic marital journey.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center text-2xl font-bold">
              💬
            </div>
            <h3 className="text-lg font-bold text-slate-100">હૃદયસ્પર્શી સંવાદ</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              રોજિંદા જીવનમાં અટવાઈ ગયેલી વાતોને મુક્ત મને વ્યક્ત કરવાની અને એકબીજાની લાગણીઓને સાંભળવાની કળા.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center text-2xl font-bold">
              💖
            </div>
            <h3 className="text-lg font-bold text-slate-100">નવો સ્નેહ &amp; રોમાન્સ</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              લગ્નના શરૂઆતી દિવસો જેવો પ્રેમ અને ઉત્સાહ ફરીથી તાજો કરવાનો સુંદર અવસર.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center text-2xl font-bold">
              🤝
            </div>
            <h3 className="text-lg font-bold text-slate-100">મતભેદોનું નિવારણ</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              નાની-મોટી તકરારોને શાંતિથી, સમજણપૂર્વક અને હાસ્ય સાથે ઉકેલવાની સરળ વ્યવહારુ રીતો.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center text-2xl font-bold">
              ✨
            </div>
            <h3 className="text-lg font-bold text-slate-100">આજીવન મિત્રતા</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              માત્ર પતિ-પત્ની નહીં પરંતુ જીવનભર એકબીજાના સૌથી સારા મિત્ર અને સાથીદાર બનવાની સફર.
            </p>
          </div>
        </div>
      </section>

      {/* How Registration Works (5 Simple Steps) */}
      <section className="relative z-10 py-16 px-6 lg:px-12 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-7xl mx-auto space-y-12">

          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block">Seamless Experience</span>
            <h2 className="text-3xl font-extrabold text-slate-100">સરળ ૫-સ્ટેપ રજીસ્ટ્રેશન</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
              <span className="text-2xl font-extrabold text-rose-400 block">01</span>
              <h4 className="text-sm font-bold text-slate-200">શહેર પસંદ કરો</h4>
              <p className="text-[11px] text-slate-400">તમારા અનુકૂળ શહેર અને તારીખ પર ક્લિક કરો.</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
              <span className="text-2xl font-extrabold text-amber-400 block">02</span>
              <h4 className="text-sm font-bold text-slate-200">વિગતો ભરો</h4>
              <p className="text-[11px] text-slate-400">પતિ-પત્નીનું નામ અને મોબાઈલ નંબર લખો.</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
              <span className="text-2xl font-extrabold text-rose-400 block">03</span>
              <h4 className="text-sm font-bold text-slate-200">કપલ ફોટો અપલોડ</h4>
              <p className="text-[11px] text-slate-400">પાસ માટે તમારો સુંદર ફોટો પસંદ કરો.</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
              <span className="text-2xl font-extrabold text-amber-400 block">04</span>
              <h4 className="text-sm font-bold text-slate-200">Razorpay પેમેન્ટ</h4>
              <p className="text-[11px] text-slate-400">UPI, Card કે NetBanking થી સુરક્ષિત પેમેન્ટ કરો.</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
              <span className="text-2xl font-extrabold text-emerald-400 block">05</span>
              <h4 className="text-sm font-bold text-slate-200">ડિજિટલ પાસ</h4>
              <p className="text-[11px] text-slate-400">તરત જ સ્ક્રીન અને WhatsApp પર પાસ મેળવો.</p>
            </div>
          </div>

        </div>
      </section>

      {/* About Manish Vaghasiya */}
      <section id="about" className="relative z-10 py-20 px-6 lg:px-12 max-w-6xl mx-auto">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12 backdrop-blur-xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">

          <div className="md:col-span-5 flex justify-center">
            <div className="relative w-64 h-80 rounded-2xl overflow-hidden border border-rose-500/30 shadow-xl">
              <img
                src="/images/46.png"
                alt="Manish Vaghasiya"
                className="w-full h-full object-cover object-top"
              />
            </div>
          </div>

          <div className="md:col-span-7 space-y-4 text-left">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block">Speaker &amp; Facilitator</span>
            <h2 className="text-3xl font-extrabold text-slate-100">Manish Vaghasiya</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              ગુજરાતભરમાં સેંકડો પરિવારો અને હજારો દંપતીઓને વૈવાહિક સુખ, આંતરિક જોડાણ અને પારિવારિક શાંતિ તરફ દોરનાર લોકપ્રિય વક્તા અને જીવન માર્ગદર્શક.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              &quot;એક દૂજે કે લિયે&quot; સેમિનાર દ્વારા તેઓ હળવાશ, ઊંડા મનોવૈજ્ઞાનિક દ્રષ્ટિકોણ અને વાસ્તવિક જીવનના ઉદાહરણો સાથે સંબંધોને પુનર્જીવિત કરવાનું કાર્ય કરે છે.
            </p>
            <div className="pt-2">
              <a
                href="#events"
                className="inline-block px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs uppercase rounded-xl transition-all"
              >
                Join Next Event With Manish Vaghasiya →
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* Event Photo Gallery */}
      <section id="gallery" className="relative z-10 py-20 px-6 lg:px-12 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-7xl mx-auto space-y-12">

          <div className="text-center space-y-3 max-w-xl mx-auto">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block">Moments &amp; Atmosphere</span>
            <h2 className="text-3xl font-extrabold text-slate-100">સેમિનારની અમૂલ્ય ક્ષણો</h2>
            <p className="text-slate-400 text-xs">Real glimpses from our previous Ek Duje Ke Liye couple seminars.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {GALLERY_IMAGES.map((src, idx) => (
              <div
                key={idx}
                className="aspect-square rounded-2xl overflow-hidden border border-white/10 hover:border-rose-500/40 transition-all duration-300 group bg-slate-950"
              >
                <img
                  src={src}
                  alt={`Event Moment ${idx + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative z-10 py-20 px-6 lg:px-12 max-w-4xl mx-auto space-y-10">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block">Got Questions?</span>
          <h2 className="text-3xl font-extrabold text-slate-100">વારંવાર પૂછાતા પ્રશ્નો (FAQ)</h2>
        </div>

        <div className="space-y-4">
          {FAQ_ITEMS.map((item, idx) => (
            <div
              key={idx}
              className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all"
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full p-5 text-left flex justify-between items-center gap-4 text-sm font-bold text-slate-100 hover:text-rose-300"
              >
                <span>{item.question}</span>
                <span className="text-rose-400 text-lg font-extrabold">
                  {openFaqIndex === idx ? '−' : '+'}
                </span>
              </button>
              {openFaqIndex === idx && (
                <div className="px-5 pb-5 text-xs text-slate-300 leading-relaxed border-t border-white/5 pt-3 animate-fade-in">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-rose-950/60 bg-[#0c0306] py-12 px-6 lg:px-12 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">

          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Ek Duje Ke Liye" className="h-10 w-auto" />
              <span className="text-lg font-bold text-slate-100 uppercase">Ek Duje Ke Liye</span>
            </div>
            <p className="text-slate-400 text-xs max-w-sm leading-relaxed">
              An emotional and transformational relationship seminar exclusively designed for married couples by Manish Vaghasiya.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-bold text-slate-200 block mb-2">Quick Links</span>
            <ul className="space-y-1.5">
              <li><a href="#events" className="hover:text-rose-400">Upcoming Events</a></li>
              <li><a href="#experience" className="hover:text-rose-400">The Experience</a></li>
              <li><a href="#about" className="hover:text-rose-400">About Host</a></li>
              <li><a href="#gallery" className="hover:text-rose-400">Photo Gallery</a></li>
              <li><Link href="/admin" className="hover:text-rose-400">Admin Portal</Link></li>
            </ul>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-bold text-slate-200 block mb-2">Connect &amp; Social</span>
            <ul className="space-y-1.5">
              <li>
                <a
                  href="https://linktr.ee/ekdujekeliye"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-rose-400"
                >
                  Official Linktree ↗
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/ekdujekeliye01"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-rose-400"
                >
                  Instagram @ekdujekeliye01 ↗
                </a>
              </li>
              <li><Link href="/privacy-policy" className="hover:text-rose-400">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-rose-400">Terms of Service</Link></li>
            </ul>
          </div>

        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>&copy; {new Date().getFullYear()} Ek Duje Ke Liye. All rights reserved.</div>
          <div className="flex gap-4">
            <Link href="/privacy-policy" className="hover:underline">Privacy Policy</Link>
            <span>&bull;</span>
            <Link href="/terms" className="hover:underline">Terms of Service</Link>
          </div>
        </div>
      </footer>

      {/* Mobile Sticky Booking Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-black/85 backdrop-blur-xl border-t border-rose-950/60 flex items-center justify-between gap-3 shadow-2xl">
        <div className="pl-1">
          <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Couple Admission Pass</span>
          <span className="text-base font-extrabold text-amber-400">₹1,000 / Couple</span>
        </div>
        <a
          href="#events"
          className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-rose-500/25 text-center flex items-center gap-1.5"
        >
          <span>🎟️ Book Now</span>
        </a>
      </div>

    </div>
  );
}
