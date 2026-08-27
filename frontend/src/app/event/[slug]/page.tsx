'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL } from '../../../config';
import { openRazorpayModal } from '../../../components/RazorpayModal';

interface ProgramDetail {
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
  date: string;
  time: string;
  capacity: number;
  bookingsCount: number;
  activeBookings?: number;
  availableSeats?: number;
  isDateFinal?: boolean;
  cardTemplate?: string;
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

const compressImage = (file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.75): Promise<File> => {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve(file), 3000);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            clearTimeout(timeoutId);
            return resolve(file);
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              clearTimeout(timeoutId);
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            quality
          );
        } catch {
          clearTimeout(timeoutId);
          resolve(file);
        }
      };
      img.onerror = () => {
        clearTimeout(timeoutId);
        resolve(file);
      };
    };
    reader.onerror = () => {
      clearTimeout(timeoutId);
      resolve(file);
    };
  });
};

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [event, setEvent] = useState<ProgramDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [husbandName, setHusbandName] = useState('');
  const [wifeName, setWifeName] = useState('');
  const [surname, setSurname] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [couplePhoto, setCouplePhoto] = useState<File | null>(null);
  const [couplePhotoPreview, setCouplePhotoPreview] = useState<string | null>(null);

  // Submission & Payment State
  const [submitting, setSubmitting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'created' | 'verifying' | 'success' | 'pending' | 'failed'>('idle');
  const [createdInquiryId, setCreatedInquiryId] = useState<string | null>(null);
  const [createdCustomerToken, setCreatedCustomerToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!slug) return;
    fetchEventDetails();
  }, [slug]);

  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      // Try fetching by slug first
      let res = await fetch(`${API_BASE_URL}/api/programs/slug/${encodeURIComponent(slug)}`);
      if (!res.ok) {
        // Fallback: search in all programs
        const allRes = await fetch(`${API_BASE_URL}/api/programs`);
        if (allRes.ok) {
          const programs: ProgramDetail[] = await allRes.json();
          const match = programs.find((p) => p.slug === slug || p.id === slug);
          if (match) {
            setEvent(match);
            return;
          }
        }
        throw new Error('Event not found or registration is closed.');
      }
      const data = await res.json();
      setEvent(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load event details.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const originalFile = e.target.files[0];
      try {
        const compressed = await compressImage(originalFile);
        setCouplePhoto(compressed);
        const url = URL.createObjectURL(compressed);
        setCouplePhotoPreview(url);
      } catch {
        setCouplePhoto(originalFile);
        setCouplePhotoPreview(URL.createObjectURL(originalFile));
      }
    }
  };

  const initiatePaymentForInquiry = async (inquiryId: string, token?: string) => {
    try {
      setPaymentStatus('created');
      setSubmitting(true);

      const orderRes = await fetch(`${API_BASE_URL}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId, customerToken: token })
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Failed to create payment order.');
      }

      // Open Razorpay modal
      await openRazorpayModal({
        keyId: orderData.keyId,
        orderId: orderData.orderId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Ek Duje Ke Liye',
        description: `${orderData.programName || 'Couple Pass'} Registration`,
        prefill: {
          name: orderData.customerName,
          contact: orderData.phoneNumber
        },
        notes: {
          inquiryId
        },
        onSuccess: async (response) => {
          setPaymentStatus('verifying');
          try {
            const verifyRes = await fetch(`${API_BASE_URL}/api/payments/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                inquiryId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              setPaymentStatus('success');
            } else {
              setPaymentStatus('pending');
              setErrorMessage(verifyData.error || 'Payment received. Awaiting server confirmation.');
            }
          } catch (verifyErr) {
            setPaymentStatus('pending');
          }
        },
        onFailure: (err) => {
          console.warn('Razorpay payment failed or cancelled:', err);
          setPaymentStatus('pending');
          setErrorMessage('Payment was not completed. You can retry anytime using the button below.');
        },
        onDismiss: () => {
          setPaymentStatus('pending');
          setErrorMessage('Payment window closed. Your registration is saved. Please complete payment to get your pass.');
        }
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Error initializing payment.');
      setPaymentStatus('failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    if (!husbandName.trim() || !wifeName.trim() || !surname.trim()) {
      alert('કૃપા કરીને પતિ, પત્ની અને અટકનું નામ દાખલ કરો!');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phoneNumber.trim())) {
      alert('કૃપા કરીને સાચો 10-આંકડાનો મોબાઇલ નંબર દાખલ કરો!');
      return;
    }

    if (!couplePhoto) {
      alert('કૃપા કરીને તમારો કપલ ફોટો અપલોડ કરો!');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('husbandName', husbandName.trim());
      formData.append('wifeName', wifeName.trim());
      formData.append('surname', surname.trim());
      formData.append('phoneNumber', phoneNumber.trim());
      formData.append('programId', event.id);
      formData.append('couplePhoto', couplePhoto);

      const res = await fetch(`${API_BASE_URL}/api/submit`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.alreadyRegistered && data.inquiryId) {
          router.push(`/payment/${data.inquiryId}`);
          return;
        }
        throw new Error(data.error || 'Registration failed. Please try again.');
      }

      setCreatedInquiryId(data.inquiryId);
      setCreatedCustomerToken(data.customerToken);

      // Immediately launch Razorpay Standard Checkout
      await initiatePaymentForInquiry(data.inquiryId, data.customerToken);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during registration.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a050d] via-[#0c0306] to-[#080205] text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
          <p className="text-sm font-semibold tracking-wide text-rose-300">Loading Event Details...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a050d] via-[#0c0306] to-[#080205] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-2xl font-bold">
            !
          </div>
          <h2 className="text-2xl font-extrabold text-slate-100">Event Not Found</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            {error || 'This event is either completed, unavailable, or the URL is incorrect.'}
          </p>
          <Link
            href="/"
            className="inline-block w-full py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-rose-500/25"
          >
            ← View All Upcoming Events
          </Link>
        </div>
      </div>
    );
  }

  const isClosed = event.status === 'housefull' || event.status === 'registration_closed' || event.isInquiryClosed;
  const price = event.price !== undefined ? event.price : 1000;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a050d] via-[#0c0306] to-[#080205] text-slate-100 flex flex-col justify-between font-sans">
      {/* Header */}
      <header className="py-5 px-6 md:px-12 border-b border-rose-950/40 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-10 w-auto object-contain" />
            <span className="text-lg font-bold tracking-wider text-slate-100 uppercase hidden sm:inline">Ek Duje Ke Liye</span>
          </Link>
          <Link
            href="/"
            className="text-xs text-rose-400 hover:text-rose-300 font-semibold border border-rose-500/30 hover:bg-rose-500/10 px-4 py-2 rounded-xl transition-all"
          >
            ← All Events
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-5xl mx-auto px-6 py-10 w-full z-10">
        
        {/* Success State */}
        {paymentStatus === 'success' && createdInquiryId && (
          <div className="bg-white/5 border border-emerald-500/30 rounded-3xl p-8 md:p-12 backdrop-blur-xl shadow-2xl text-center space-y-6 max-w-2xl mx-auto animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-3xl font-bold">
              ✓
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block mb-1">Registration Confirmed</span>
              <h2 className="text-3xl font-extrabold text-slate-100">Payment Successful!</h2>
              <p className="text-slate-300 text-sm mt-2">
                Your registration for <strong>{event.name}</strong> has been successfully confirmed and your couple pass is ready.
              </p>
            </div>

            {/* Prominent Registration Number Badge */}
            <div className="bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-amber-500/15 border border-amber-500/40 rounded-2xl p-5 text-center space-y-1">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-widest block">
                તમારો રજીસ્ટ્રેશન નંબર (Registration Pass ID)
              </span>
              <span className="text-3xl md:text-4xl font-extrabold text-amber-400 font-mono tracking-wider block select-all">
                {createdInquiryId}
              </span>
              <span className="text-xs text-slate-400 block">
                Save this ID for reference &amp; check-in at the seminar venue.
              </span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Event:</span>
                <span className="font-semibold text-slate-200">{event.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Date &amp; Time:</span>
                <span className="font-semibold text-slate-200">{formatIndianDate(event.date)} at {event.time}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Couple:</span>
                <span className="font-semibold text-slate-200">{husbandName} &amp; {wifeName} {surname}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-4">
              <Link
                href={`/pass/${createdInquiryId}`}
                className="flex-1 py-4 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-slate-950 font-bold rounded-2xl transition-all shadow-xl shadow-rose-500/20 text-center"
              >
                🎟️ View &amp; Download Couple Pass
              </Link>
              <Link
                href="/"
                className="py-4 px-6 border border-slate-700 hover:bg-white/5 text-slate-300 font-semibold rounded-2xl transition-all text-center text-sm"
              >
                Back to Home
              </Link>
            </div>
          </div>
        )}

        {/* Pending / Incomplete State */}
        {paymentStatus === 'pending' && createdInquiryId && (
          <div className="bg-white/5 border border-amber-500/30 rounded-3xl p-8 md:p-12 backdrop-blur-xl shadow-2xl text-center space-y-6 max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-3xl font-bold">
              ⏳
            </div>
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block mb-1">Registration Saved</span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-100">Payment Incomplete</h2>
              <p className="text-slate-300 text-sm mt-2 leading-relaxed">
                {errorMessage || 'Your registration details are securely saved, but payment has not been completed yet.'}
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-left text-xs space-y-1">
              <p><strong className="text-slate-400">Inquiry ID:</strong> <span className="text-amber-400 font-bold">{createdInquiryId}</span></p>
              <p><strong className="text-slate-400">Amount Due:</strong> ₹{price}</p>
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <button
                onClick={() => initiatePaymentForInquiry(createdInquiryId, createdCustomerToken || undefined)}
                disabled={submitting}
                className="w-full py-4 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-slate-950 font-bold rounded-2xl transition-all shadow-xl shadow-rose-500/20"
              >
                💳 Complete Payment (₹{price})
              </button>
              <Link
                href={`/payment/${createdInquiryId}`}
                className="text-xs text-slate-400 hover:text-rose-400 transition-colors py-2"
              >
                Save payment link for later →
              </Link>
            </div>
          </div>
        )}

        {/* Normal Registration Form View */}
        {paymentStatus !== 'success' && paymentStatus !== 'pending' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left: Event Details Card */}
            <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl space-y-6">
              <div>
                <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block mb-2">
                  {event.city || 'Event Details'}
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 leading-tight">
                  {event.name}
                </h1>
                <p className="text-xs text-slate-400 mt-1">by Manish Vaghasiya</p>
              </div>

              <div className="space-y-3 pt-2 text-sm">
                <div className="flex items-center gap-3 text-slate-300">
                  <span className="text-lg">📅</span>
                  <div>
                    <span className="text-xs text-slate-400 block">Date</span>
                    <span className="font-semibold text-slate-100">{formatIndianDate(event.date)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-slate-300">
                  <span className="text-lg">⏰</span>
                  <div>
                    <span className="text-xs text-slate-400 block">Time</span>
                    <span className="font-semibold text-slate-100">{event.time}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-slate-300">
                  <span className="text-lg">📍</span>
                  <div>
                    <span className="text-xs text-slate-400 block">Venue</span>
                    <span className="font-semibold text-slate-100">{event.venue || `${event.city || 'Gujarat'}`}</span>
                    {event.mapUrl && (
                      <a
                        href={event.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-rose-400 hover:underline block mt-0.5"
                      >
                        View on Google Maps →
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-slate-300">
                  <span className="text-lg">🎟️</span>
                  <div>
                    <span className="text-xs text-slate-400 block">Pass Price</span>
                    <span className="font-extrabold text-amber-400 text-lg">₹{price}</span>
                    <span className="text-xs text-slate-400 ml-1.5">(Per Married Couple)</span>
                  </div>
                </div>
              </div>

              {event.description && (
                <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-400 leading-relaxed">
                  {event.description}
                </div>
              )}

              <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-xs text-rose-300 space-y-1">
                <p className="font-bold">✨ Important Event Guidelines:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                  <li>Only married couples admitted (2 persons per pass).</li>
                  <li>Children are strictly not allowed.</li>
                  <li>Instant pass issued immediately upon Razorpay payment.</li>
                </ul>
              </div>
            </div>

            {/* Right: Couple Registration Form */}
            <div className="lg:col-span-7 bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6">
              
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-100">Couple Registration</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Fill in your details to book your official couple entry pass.
                </p>
              </div>

              {isClosed ? (
                <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-center space-y-3">
                  <h3 className="text-lg font-bold text-red-400">Registration Closed / Housefull</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Online registrations for this batch are currently full. Please explore other upcoming dates on our homepage.
                  </p>
                  <Link
                    href="/"
                    className="inline-block text-xs font-semibold text-rose-400 hover:underline pt-2"
                  >
                    View Other Upcoming Events →
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  
                  {errorMessage && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold">
                      {errorMessage}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                        પતિનું નામ (Husband&apos;s Name) *
                      </label>
                      <input
                        type="text"
                        required
                        value={husbandName}
                        onChange={(e) => setHusbandName(e.target.value)}
                        placeholder="e.g. Ramesh"
                        className="w-full bg-slate-900/80 border border-slate-700/80 focus:border-rose-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                        પત્નીનું નામ (Wife&apos;s Name) *
                      </label>
                      <input
                        type="text"
                        required
                        value={wifeName}
                        onChange={(e) => setWifeName(e.target.value)}
                        placeholder="e.g. Geeta"
                        className="w-full bg-slate-900/80 border border-slate-700/80 focus:border-rose-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                        અટક (Surname) *
                      </label>
                      <input
                        type="text"
                        required
                        value={surname}
                        onChange={(e) => setSurname(e.target.value)}
                        placeholder="e.g. Patel"
                        className="w-full bg-slate-900/80 border border-slate-700/80 focus:border-rose-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                        મોબાઇલ નંબર (10-Digit Mobile) *
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 9876543210"
                        className="w-full bg-slate-900/80 border border-slate-700/80 focus:border-rose-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Couple Photo Upload */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      કપલ ફોટો (Couple Photograph for Pass) *
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-700 hover:border-rose-500/60 rounded-2xl p-4 text-center cursor-pointer transition-all bg-slate-950/40 hover:bg-slate-950/60 flex flex-col items-center justify-center min-h-[120px]"
                    >
                      {couplePhotoPreview ? (
                        <div className="flex items-center gap-4">
                          <img
                            src={couplePhotoPreview}
                            alt="Couple Preview"
                            className="w-20 h-20 object-cover rounded-xl border border-rose-500/40 shadow-md"
                          />
                          <div className="text-left">
                            <span className="text-xs font-bold text-rose-400 block">Photo Selected ✓</span>
                            <span className="text-[11px] text-slate-400">Click here to change photo</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-2xl block">📸</span>
                          <span className="text-xs font-semibold text-slate-200 block">Click to select Couple Photo</span>
                          <span className="text-[11px] text-slate-400">JPG, PNG (Front facing couple photo)</span>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Payment CTA */}
                  <div className="pt-3 space-y-3">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-4 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 disabled:opacity-50 text-slate-950 font-extrabold rounded-2xl transition-all shadow-xl shadow-rose-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                    >
                      {submitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          <span>Processing Order...</span>
                        </>
                      ) : (
                        <>
                          <span>Pay ₹{price} &amp; Confirm Booking</span>
                          <span>💳</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
                      <span>🔒 256-Bit SSL Encrypted</span>
                      <span>&bull;</span>
                      <span>Powered by Razorpay</span>
                      <span>&bull;</span>
                      <span>Instant Digital Pass</span>
                    </div>
                  </div>

                </form>
              )}

            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="py-6 px-8 border-t border-slate-800/80 bg-slate-950/40 text-center text-xs text-slate-500 space-y-1">
        <div>&copy; {new Date().getFullYear()} Ek Duje Ke Liye. All rights reserved.</div>
        <div className="space-x-3">
          <Link href="/privacy-policy" className="text-slate-400 hover:text-rose-400 hover:underline">Privacy Policy</Link>
          <span>&bull;</span>
          <Link href="/terms" className="text-slate-400 hover:text-rose-400 hover:underline">Terms &amp; Conditions</Link>
        </div>
      </footer>
    </div>
  );
}
