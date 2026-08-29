'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL } from '../../../config';
import { openRazorpayModal } from '../../../components/RazorpayModal';
import {
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  TicketIcon,
  SparklesIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  CameraIcon,
  UploadIcon,
  AlertTriangleIcon
} from '../../../components/Icons';
import toast from 'react-hot-toast';

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
  isRegistrationOpen?: boolean;
  isPaymentEnabled?: boolean;
  earlyRegistrationMode?: boolean;
  paymentOpenedAt?: string | null;
  paymentOpeningNote?: string;
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

  // Instant SWR Cache Initialization
  const [event, setEvent] = useState<ProgramDetail | null>(() => {
    if (typeof window !== 'undefined' && slug) {
      try {
        const cached = sessionStorage.getItem(`edkl_event_${slug.toLowerCase()}`);
        if (cached) return JSON.parse(cached);
        const allCached = sessionStorage.getItem('edkl_events');
        if (allCached) {
          const list: ProgramDetail[] = JSON.parse(allCached);
          const found = list.find((p) => (p.slug && p.slug.toLowerCase() === slug.toLowerCase()) || p.id === slug);
          if (found) return found;
        }
      } catch (e) {
        // Ignore cache parse error
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined' && slug) {
      try {
        const cached = sessionStorage.getItem(`edkl_event_${slug.toLowerCase()}`);
        if (cached) return false;
        const allCached = sessionStorage.getItem('edkl_events');
        if (allCached) {
          const list: ProgramDetail[] = JSON.parse(allCached);
          const found = list.find((p) => (p.slug && p.slug.toLowerCase() === slug.toLowerCase()) || p.id === slug);
          if (found) return false;
        }
      } catch (e) { }
    }
    return true;
  });

  const [error, setError] = useState<string | null>(null);

  // Form State
  const [husbandName, setHusbandName] = useState('');
  const [wifeName, setWifeName] = useState('');
  const [surname, setSurname] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [couplePhoto, setCouplePhoto] = useState<File | null>(null);
  const [couplePhotoPreview, setCouplePhotoPreview] = useState<string | null>(null);

  // Submission & Payment State
  const [submitting, setSubmitting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'created' | 'verifying' | 'success' | 'pending' | 'failed' | 'early_received'>('idle');
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
      // Only set full-page loading if we don't already have the event cached
      if (!event) {
        setLoading(true);
      }
      setError(null);

      // Try fetching by slug first
      let res = await fetch(`${API_BASE_URL}/api/programs/slug/${encodeURIComponent(slug)}`);
      if (!res.ok) {
        // Fallback: search in all programs
        const allRes = await fetch(`${API_BASE_URL}/api/programs`);
        if (allRes.ok) {
          const programs: ProgramDetail[] = await allRes.json();
          const match = programs.find((p) => (p.slug && p.slug.toLowerCase() === slug.toLowerCase()) || p.id === slug);
          if (match) {
            setEvent(match);
            try {
              if (typeof window !== 'undefined') {
                sessionStorage.setItem(`edkl_event_${slug.toLowerCase()}`, JSON.stringify(match));
              }
            } catch (e) { }
            return;
          }
        }
        if (!event) {
          throw new Error('Event not found or registration is closed.');
        }
        return;
      }
      const data = await res.json();
      setEvent(data);
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(`edkl_event_${slug.toLowerCase()}`, JSON.stringify(data));
        }
      } catch (e) { }
    } catch (err: any) {
      if (!event) {
        setError(err.message || 'Failed to load event details.');
      }
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
        description: `Registration fee for ${event?.name || 'Ek Duje Ke Liye couple program'}`,
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
      toast.error('કૃપા કરીને પતિ, પત્ની અને અટકનું નામ દાખલ કરો!');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phoneNumber.trim())) {
      toast.error('કૃપા કરીને સાચો 10-આંકડાનો મોબાઇલ નંબર દાખલ કરો!');
      return;
    }

    if (!couplePhoto) {
      toast.error('કૃપા કરીને તમારો કપલ ફોટો અપલોડ કરો!');
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
      formData.append('whatsappOptIn', whatsappOptIn ? 'true' : 'false');
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

      const isEarlyReg = Boolean(data.earlyRegistration || event.earlyRegistrationMode || event.isPaymentEnabled === false);

      if (isEarlyReg) {
        // Early registration mode: Do not launch Razorpay checkout
        setPaymentStatus('early_received');
        setSubmitting(false);
      } else {
        // Standard mode: Immediately launch Razorpay Standard Checkout
        await initiatePaymentForInquiry(data.inquiryId, data.customerToken);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during registration.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-rose-600/20 border-t-rose-600 rounded-full animate-spin" />
          <p className="text-sm font-semibold tracking-wide text-rose-700">Loading Event Details...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-3xl p-8 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-2xl font-bold">
            !
          </div>
          <h2 className="text-2xl font-extrabold text-stone-900">Event Not Found</h2>
          <p className="text-sm text-stone-600 leading-relaxed font-medium">
            {error || 'This event is either completed, unavailable, or the URL is incorrect.'}
          </p>
          <Link
            href="/"
            className="inline-block w-full py-3.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold rounded-2xl transition-all shadow-md shadow-rose-600/25"
          >
            ← View All Upcoming Events
          </Link>
        </div>
      </div>
    );
  }

  const isClosed = event.status === 'housefull' || event.status === 'registration_closed' || event.isInquiryClosed;
  const isEarlyReg = Boolean(event.earlyRegistrationMode || event.isPaymentEnabled === false);
  const price = event.price !== undefined ? event.price : 1500;

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex flex-col justify-between font-sans">
      {/* Header */}
      <header className="py-4 px-6 md:px-12 border-b border-stone-200 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-xs">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-10 w-auto object-contain" />
            <span className="text-lg font-extrabold tracking-wider text-stone-900 uppercase hidden sm:inline">Ek Duje Ke Liye</span>
          </Link>
          <Link
            href="/"
            className="text-xs text-rose-700 hover:text-rose-800 font-bold border border-rose-300 hover:bg-rose-50 px-4 py-2 rounded-xl transition-all"
          >
            ← All Events
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-5xl mx-auto px-6 py-10 w-full z-10">

        {/* Early Registration Success State */}
        {paymentStatus === 'early_received' && createdInquiryId && (
          <div className="bg-white border border-rose-200 rounded-3xl p-8 md:p-12 shadow-2xl text-center space-y-6 max-w-2xl mx-auto animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-3xl font-bold">
              <CheckCircleIcon className="w-8 h-8 text-rose-600" />
            </div>
            <div>
              <span className="text-xs font-extrabold text-rose-700 uppercase tracking-widest block mb-1">
                Early Registration Received &bull; વહેલી નોંધણી મળી ગઈ છે
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-stone-900">Registration Received</h2>
            </div>

            {/* Prominent Registration Number Badge */}
            <div className="bg-rose-50/80 border border-rose-300 rounded-2xl p-5 text-center space-y-1 shadow-inner">
              <span className="text-[11px] font-bold text-rose-900 uppercase tracking-widest block">
                Registration ID (નોંધણી નંબર)
              </span>
              <span className="text-3xl md:text-4xl font-extrabold text-rose-700 font-mono tracking-wider block select-all">
                {createdInquiryId}
              </span>
              <span className="text-xs text-stone-600 block font-medium">
                Payment is not required at this stage. (હાલમાં પેમેન્ટ કરવાની જરૂર નથી.)
              </span>
            </div>

            {/* English & Gujarati Success Messages */}
            <div className="space-y-4 text-left">
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-700 leading-relaxed space-y-2">
                <p className="font-bold text-stone-900 text-sm">English Notice:</p>
                <p>Thank you. Your early registration has been received successfully.</p>
                <p>Payment is not required at this stage.</p>
                <p>We will send the payment link to your registered WhatsApp number once online payment becomes available.</p>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-semibold">
                  <strong>Important:</strong> Your seat is not confirmed yet. Your seat and Digital Entry Pass will be confirmed only after successful payment.
                </div>
              </div>

              <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-700 leading-relaxed space-y-2">
                <p className="font-bold text-stone-900 text-sm">ગુજરાતી વિગત:</p>
                <p>આભાર. તમારી વહેલી નોંધણી સફળતાપૂર્વક મળી ગઈ છે.</p>
                <p>હાલમાં પેમેન્ટ કરવાની જરૂર નથી.</p>
                <p>ઓનલાઈન પેમેન્ટ શરૂ થયા પછી તમારા નોંધાયેલા WhatsApp નંબર પર પેમેન્ટ લિંક મોકલવામાં આવશે.</p>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-semibold">
                  <strong>મહત્વપૂર્ણ:</strong> હાલ તમારી સીટ કન્ફર્મ નથી. સફળ પેમેન્ટ થયા બાદ જ તમારી સીટ અને Digital Entry Pass કન્ફર્મ થશે.
                </div>
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 font-medium">Event:</span>
                <span className="font-bold text-stone-900">{event.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 font-medium">Date &amp; Time:</span>
                <span className="font-semibold text-stone-900">{formatIndianDate(event.date)} at {event.time}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 font-medium">Couple:</span>
                <span className="font-semibold text-stone-900">{husbandName} &amp; {wifeName} {surname}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-4">
              <Link
                href="/"
                className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all text-center text-sm shadow-md"
              >
                Back to Home Page
              </Link>
            </div>
          </div>
        )}

        {/* Success State (Paid) */}
        {paymentStatus === 'success' && createdInquiryId && (
          <div className="bg-white border border-emerald-200 rounded-3xl p-8 md:p-12 shadow-2xl text-center space-y-6 max-w-2xl mx-auto animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto text-3xl font-bold">
              <CheckCircleIcon className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest block mb-1">Registration Confirmed</span>
              <h2 className="text-3xl font-extrabold text-stone-900">Payment Successful!</h2>
              <p className="text-stone-600 text-sm mt-2 font-medium">
                Your registration for <strong>{event.name}</strong> has been successfully confirmed and your couple pass is ready.
              </p>
            </div>

            {/* Prominent Registration Number Badge */}
            <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 border border-amber-300 rounded-2xl p-5 text-center space-y-1 shadow-inner">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-widest block">
                તમારો રજીસ્ટ્રેશન નંબર (Registration Pass ID)
              </span>
              <span className="text-3xl md:text-4xl font-extrabold text-amber-700 font-mono tracking-wider block select-all">
                {createdInquiryId}
              </span>
              <span className="text-xs text-stone-600 block font-medium">
                Save this ID for reference &amp; check-in at the seminar venue.
              </span>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 font-medium">Event:</span>
                <span className="font-bold text-stone-900">{event.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 font-medium">Date &amp; Time:</span>
                <span className="font-semibold text-stone-900">{formatIndianDate(event.date)} at {event.time}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 font-medium">Couple:</span>
                <span className="font-semibold text-stone-900">{husbandName} &amp; {wifeName} {surname}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-4">
              <Link
                href={`/pass/${createdInquiryId}`}
                className="flex-1 py-4 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold rounded-2xl transition-all shadow-xl shadow-rose-600/20 text-center inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <TicketIcon className="w-4 h-4" />
                <span>View &amp; Download Couple Pass</span>
              </Link>
              <Link
                href="/"
                className="py-4 px-6 border border-stone-300 hover:bg-stone-100 text-stone-700 font-bold rounded-2xl transition-all text-center text-sm"
              >
                Back to Home
              </Link>
            </div>
          </div>
        )}

        {/* Pending / Incomplete State */}
        {paymentStatus === 'pending' && createdInquiryId && (
          <div className="bg-white border border-amber-300 rounded-3xl p-8 md:p-12 shadow-2xl text-center space-y-6 max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto text-3xl font-bold">
              <ClockIcon className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <span className="text-xs font-bold text-amber-800 uppercase tracking-widest block mb-1">Registration Saved</span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-stone-900">Payment Incomplete</h2>
              <p className="text-stone-600 text-sm mt-2 leading-relaxed font-medium">
                {errorMessage || 'Your registration details are securely saved, but payment has not been completed yet.'}
              </p>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-left text-xs space-y-1.5">
              <p><strong className="text-stone-500">Inquiry ID:</strong> <span className="text-amber-800 font-bold text-sm">{createdInquiryId}</span></p>
              <p><strong className="text-stone-500">Amount Due:</strong> ₹{price}</p>
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <button
                onClick={() => initiatePaymentForInquiry(createdInquiryId, createdCustomerToken || undefined)}
                disabled={submitting}
                className="w-full py-4 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold rounded-2xl transition-all shadow-xl shadow-rose-600/20 cursor-pointer"
              >
                Complete Payment (₹{price})
              </button>
              <Link
                href={`/payment/${createdInquiryId}`}
                className="text-xs text-rose-700 hover:text-rose-800 transition-colors py-2 font-semibold"
              >
                Save payment link for later →
              </Link>
            </div>
          </div>
        )}

        {/* Normal Registration Form View */}
        {paymentStatus !== 'success' && paymentStatus !== 'pending' && paymentStatus !== 'early_received' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left: Event Details Card */}
            <div className="lg:col-span-5 bg-white border border-stone-200/90 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-rose-700 uppercase tracking-widest block">
                    {event.city || 'Event Details'}
                  </span>
                  <span className="px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-bold rounded-md uppercase tracking-wider">
                    Couple Program
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-stone-900 leading-tight">
                  {event.name}
                </h1>
                <p className="text-xs text-stone-500 mt-1 font-medium">A Special Program for Couples led by Manish Vaghasiya</p>
              </div>

              {/* Prominent Early Registration Notice Box */}
              {isEarlyReg && (
                <div className="bg-rose-50/90 border border-rose-300 rounded-3xl p-5 shadow-xs space-y-4 text-stone-800">
                  <div className="flex items-center gap-2 border-b border-rose-200 pb-2.5">
                    <SparklesIcon className="w-4 h-4 text-rose-700 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-extrabold uppercase tracking-wider text-rose-900 block">
                        Early Registration Open &bull; વહેલી નોંધણી શરૂ
                      </span>
                      <span className="text-[10px] text-stone-500 font-medium">Online payment will open shortly</span>
                    </div>
                  </div>

                  {/* English Notice */}
                  <div className="space-y-1 text-xs text-stone-700 leading-relaxed bg-white/90 p-3.5 rounded-2xl border border-rose-100">
                    <h4 className="font-extrabold text-stone-900 text-xs">Early Registration Open</h4>
                    <p>Registration for this event is now open.</p>
                    <p>At present, only registration is being accepted. Online payment will be enabled shortly.</p>
                    <p className="font-semibold text-rose-900">
                      Your registration will be recorded now, but your seat will be confirmed only after the payment link is shared and your payment is successfully completed.
                    </p>
                    <p>Once payment opens, we will send the payment link to your registered WhatsApp number.</p>
                    <p>After successful payment, you will receive your confirmation and Digital Entry Pass.</p>
                  </div>

                  {/* Gujarati Notice */}
                  <div className="space-y-1 text-xs text-stone-700 leading-relaxed bg-white/90 p-3.5 rounded-2xl border border-rose-100">
                    <h4 className="font-extrabold text-stone-900 text-xs">વહેલી નોંધણી શરૂ</h4>
                    <p>આ કાર્યક્રમ માટે નોંધણી શરૂ થઈ ગઈ છે.</p>
                    <p>હાલમાં માત્ર નોંધણી સ્વીકારવામાં આવી રહી છે. ઓનલાઈન પેમેન્ટની સુવિધા થોડા દિવસોમાં શરૂ કરવામાં આવશે.</p>
                    <p className="font-semibold text-rose-900">
                      હમણાં તમારી નોંધણી નોંધાઈ જશે, પરંતુ તમારી સીટ પેમેન્ટ લિંક મળ્યા બાદ અને સફળ પેમેન્ટ પૂર્ણ થયા પછી જ કન્ફર્મ થશે.
                    </p>
                    <p>પેમેન્ટ શરૂ થયા પછી તમારા નોંધાયેલા WhatsApp નંબર પર પેમેન્ટ લિંક મોકલવામાં આવશે.</p>
                    <p>સફળ પેમેન્ટ થયા બાદ તમને કન્ફર્મેશન અને Digital Entry Pass મળશે.</p>
                  </div>
                </div>
              )}

              <div className="space-y-3.5 pt-2 text-sm">
                <div className="flex items-center gap-3 text-stone-700">
                  <CalendarIcon className="w-5 h-5 text-rose-600 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-stone-500 block font-medium">Date</span>
                    <span className="font-semibold text-stone-900">{formatIndianDate(event.date)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-stone-700">
                  <ClockIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-stone-500 block font-medium">Time</span>
                    <span className="font-semibold text-stone-900">{event.time}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-stone-700">
                  <MapPinIcon className="w-5 h-5 text-stone-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-stone-500 block font-medium">Venue</span>
                    <span className="font-semibold text-stone-900">{event.venue || `${event.city || 'Gujarat'}`}</span>
                    {event.mapUrl && (
                      <a
                        href={event.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-rose-700 hover:underline block mt-0.5 font-bold"
                      >
                        View on Google Maps →
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-stone-700">
                  <TicketIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-stone-500 block font-medium">Couple Pass Fee</span>
                    <span className="font-extrabold text-stone-900 text-2xl">₹{price}</span>
                    <span className="text-xs text-stone-500 ml-1.5 font-medium">
                      {isEarlyReg ? '(Payment opens shortly)' : '(Per Married Couple)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-stone-700 pt-1 border-t border-stone-100">
                  <span className="text-xs text-rose-700 font-bold block">Event Type:</span>
                  <span className="text-xs text-stone-700 font-semibold">Interactive Couple Seminar</span>
                </div>
              </div>

              {event.description && (
                <div className="pt-4 border-t border-stone-200 text-xs text-stone-600 leading-relaxed">
                  {event.description}
                </div>
              )}

              <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 text-xs text-rose-900 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <SparklesIcon className="w-3.5 h-3.5 text-rose-600" />
                  <span>Important Seminar Guidelines:</span>
                </p>
                <ul className="list-disc pl-4 space-y-1 text-stone-700">
                  <li>Program format exclusively for married couples (2 persons per pass).</li>
                  <li>Children are strictly not permitted inside the seminar hall.</li>
                  <li><strong className="text-amber-900 font-bold">Non-Refundable &amp; Non-Transferable:</strong> સેમિનાર ફી કોઈપણ સંજોગોમાં રિફંડ કે ટ્રાન્સફર થશે નહીં.</li>
                  <li>{isEarlyReg ? 'Digital pass issued after online payment opens and is completed.' : 'Instant digital pass issued immediately upon Razorpay payment.'}</li>
                </ul>
              </div>
            </div>

            {/* Right: Couple Registration Form */}
            <div className="lg:col-span-7 bg-white border border-stone-200/90 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">

              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-stone-900">
                  {isEarlyReg ? 'Early Registration' : 'Couple Seminar Registration'}
                </h2>
                <p className="text-xs text-stone-600 mt-1 font-medium">
                  {isEarlyReg
                    ? 'Fill in your details now. Payment link will be sent to your WhatsApp once online payment opens.'
                    : 'Fill in your details to register and reserve your official couple pass.'}
                </p>
                <div className="mt-3 p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-700 font-medium">
                  You are registering for Ek Duje Ke Liye couple program conducted by Manish Vaghasiya.
                </div>
              </div>

              {isClosed ? (
                <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
                  <h3 className="text-lg font-bold text-red-700">Registration Closed / Housefull</h3>
                  <p className="text-xs text-stone-600 leading-relaxed font-medium">
                    Online registrations for this batch are currently full. Please explore other upcoming dates on our homepage.
                  </p>
                  <Link
                    href="/"
                    className="inline-block text-xs font-bold text-rose-700 hover:underline pt-2"
                  >
                    View Other Upcoming Events →
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">

                  {errorMessage && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
                      {errorMessage}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1.5">
                        પતિનું નામ (Husband&apos;s Name) *
                      </label>
                      <input
                        type="text"
                        required
                        value={husbandName}
                        onChange={(e) => setHusbandName(e.target.value)}
                        placeholder="e.g. Ramesh"
                        className="w-full bg-stone-50 border border-stone-300 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-xl px-4 py-3 text-base text-stone-900 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1.5">
                        પત્નીનું નામ (Wife&apos;s Name) *
                      </label>
                      <input
                        type="text"
                        required
                        value={wifeName}
                        onChange={(e) => setWifeName(e.target.value)}
                        placeholder="e.g. Geeta"
                        className="w-full bg-stone-50 border border-stone-300 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-xl px-4 py-3 text-base text-stone-900 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1.5">
                        અટક (Surname) *
                      </label>
                      <input
                        type="text"
                        required
                        value={surname}
                        onChange={(e) => setSurname(e.target.value)}
                        placeholder="e.g. Patel"
                        className="w-full bg-stone-50 border border-stone-300 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-xl px-4 py-3 text-base text-stone-900 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1.5">
                        મોબાઇલ નંબર (10-Digit Mobile) *
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 9876543210"
                        className="w-full bg-stone-50 border border-stone-300 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-xl px-4 py-3 text-base text-stone-900 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Couple Photo Upload */}
                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1.5">
                      કપલ ફોટો (Couple Photograph for Pass) *
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-stone-300 hover:border-rose-400 rounded-2xl p-4 text-center cursor-pointer transition-all bg-stone-50 hover:bg-white flex flex-col items-center justify-center min-h-[120px]"
                    >
                      {couplePhotoPreview ? (
                        <div className="flex items-center gap-4">
                          <img
                            src={couplePhotoPreview}
                            alt="Couple Preview"
                            className="w-20 h-20 object-cover rounded-xl border border-rose-300 shadow-md"
                          />
                          <div className="text-left">
                            <span className="text-xs font-bold text-rose-700 block">Photo Selected ✓</span>
                            <span className="text-[11px] text-stone-500 font-medium">Click here to change photo</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <CameraIcon className="w-8 h-8 text-rose-500 mx-auto" />
                          <span className="text-xs font-bold text-stone-800 block">Click to select Couple Photo</span>
                          <span className="text-[11px] text-stone-500">JPG, PNG (Front facing couple photo)</span>
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

                  <label className="flex items-start gap-3 p-3.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={whatsappOptIn}
                      onChange={(e) => setWhatsappOptIn(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="leading-relaxed font-medium">
                      I agree to receive registration, payment, digital pass and event-related updates on WhatsApp.
                    </span>
                  </label>

                  {/* Early Registration Clarification Box */}
                  {isEarlyReg && (
                    <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-2xl text-xs text-stone-800 space-y-1.5">
                      <div className="font-extrabold text-rose-900 flex items-center gap-1.5">
                        <SparklesIcon className="w-4 h-4 text-rose-700 flex-shrink-0" />
                        <span>Early Registration Clarification:</span>
                      </div>
                      <p className="text-[11px] text-stone-700 leading-relaxed font-medium">
                        <strong>English:</strong> By registering now, I understand that this is an early registration and my seat will be confirmed only after successful payment.
                      </p>
                      <p className="text-[11px] text-stone-700 leading-relaxed font-medium">
                        <strong>ગુજરાતી:</strong> હું સમજું છું કે આ વહેલી નોંધણી છે અને સફળ પેમેન્ટ થયા પછી જ મારી સીટ કન્ફર્મ થશે.
                      </p>
                    </div>
                  )}

                  {/* Non-Refundable & Non-Transferable Warning Box */}
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-1">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-900">
                      <AlertTriangleIcon className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>Non-Refundable &amp; Non-Transferable Policy</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                      સેમિનાર રજીસ્ટ્રેશન ફી કોઈપણ સંજોગોમાં રિફંડ થશે નહીં કે અન્ય કોઈ વ્યક્તિના નામે ટ્રાન્સફર થશે નહીં.
                    </p>
                  </div>

                  {/* Submit CTA */}
                  <div className="pt-2 space-y-3">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-4 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-700 hover:to-amber-700 disabled:opacity-50 text-white font-extrabold rounded-2xl transition-all shadow-xl shadow-rose-600/25 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                    >
                      {submitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>{isEarlyReg ? 'Submitting Registration...' : 'Processing Order...'}</span>
                        </>
                      ) : (
                        <>
                          <span>{isEarlyReg ? 'Complete Registration (હમણાં નોંધણી કરો)' : `Pay ₹${price} & Register for Seminar`}</span>
                          <TicketIcon className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-center gap-2 text-[11px] text-stone-500 font-medium">
                      <ShieldCheckIcon className="w-3.5 h-3.5 text-stone-500" />
                      <span>256-Bit SSL Encrypted</span>
                      <span>&bull;</span>
                      <span>{isEarlyReg ? 'Payment Opens Shortly' : 'Powered by Razorpay'}</span>
                      <span>&bull;</span>
                      <span>{isEarlyReg ? 'WhatsApp Updates' : 'Instant Digital Pass'}</span>
                    </div>
                  </div>

                </form>
              )}

            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="py-6 px-8 border-t border-stone-200 bg-white text-center text-xs text-stone-500 space-y-2">
        <div>
          &copy; {new Date().getFullYear()} Ek Duje Ke Liye &bull; A Program for Couples by Manish Vaghasiya. All rights reserved.
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-[11px]">
          <Link href="/privacy-policy" className="text-stone-600 hover:text-rose-600 hover:underline">Privacy Policy</Link>
          <span>&bull;</span>
          <Link href="/terms" className="text-stone-600 hover:text-rose-600 hover:underline">Terms &amp; Conditions</Link>
          <span>&bull;</span>
          <Link href="/cancellation-refund-policy" className="text-stone-600 hover:text-rose-600 hover:underline">Refund Policy</Link>
          <span>&bull;</span>
          <Link href="/shipping-delivery-policy" className="text-stone-600 hover:text-rose-600 hover:underline">Delivery Policy</Link>
          <span>&bull;</span>
          <Link href="/contact" className="text-stone-600 hover:text-rose-600 hover:underline">Contact Us</Link>
        </div>
      </footer>
    </div>
  );
}
