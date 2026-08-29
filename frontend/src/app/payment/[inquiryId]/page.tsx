'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL } from '../../../config';
import { openRazorpayModal } from '../../../components/RazorpayModal';
import {
  TicketIcon,
  CheckCircleIcon,
  ClockIcon,
  CalendarIcon,
  MapPinIcon,
  AlertTriangleIcon,
  PhoneIcon,
  UserIcon,
  ShieldCheckIcon
} from '../../../components/Icons';

interface PaymentStatusResponse {
  inquiryId: string;
  registrationStatus: string;
  paymentStatus: string;
  paymentProvider: string;
  amount: number;
  price?: number;
  paidAt: string | null;
  passAvailable: boolean;
  coupleName?: string;
  husbandName?: string;
  wifeName?: string;
  surname?: string;
  phoneNumber?: string;
  programName: string;
  programDate: string;
  programTime?: string;
  venue?: string;
  venueAddress?: string;
  isPaymentEnabled?: boolean;
  earlyRegistrationMode?: boolean;
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

export default function PaymentRetryPage() {
  const params = useParams();
  const router = useRouter();
  const inquiryId = params?.inquiryId as string;

  const [statusData, setStatusData] = useState<PaymentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  useEffect(() => {
    if (!inquiryId) return;
    fetchStatus();
  }, [inquiryId]);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/payments/status/${encodeURIComponent(inquiryId)}`);
      if (!res.ok) {
        throw new Error('Registration record not found.');
      }
      const data = await res.json();
      setStatusData(data);
      if (data.passAvailable || data.paymentStatus === 'captured') {
        setPaySuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve payment information.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async () => {
    if (!statusData) return;
    setPaying(true);
    setError(null);

    try {
      const orderRes = await fetch(`${API_BASE_URL}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: statusData.inquiryId })
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Failed to initialize payment.');
      }

      const coupleDisplayName = statusData.husbandName && statusData.wifeName
        ? `${statusData.husbandName} & ${statusData.wifeName} ${statusData.surname || ''}`.trim()
        : statusData.coupleName || 'Registered Couple';

      await openRazorpayModal({
        keyId: orderData.keyId,
        orderId: orderData.orderId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Ek Duje Ke Liye',
        description: 'Couple Seminar Registration Fee - Ek Duje Ke Liye',
        prefill: {
          name: coupleDisplayName,
          contact: statusData.phoneNumber || orderData.phoneNumber
        },
        notes: {
          inquiryId: statusData.inquiryId,
          couple: coupleDisplayName,
          phone: statusData.phoneNumber || ''
        },
        onSuccess: async (response) => {
          try {
            const verifyRes = await fetch(`${API_BASE_URL}/api/payments/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                inquiryId: statusData.inquiryId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              setPaySuccess(true);
              setStatusData((prev) => prev ? { ...prev, passAvailable: true, paymentStatus: 'captured' } : null);
            }
          } catch (vErr) {
            console.error('Signature verification error:', vErr);
          }
        },
        onFailure: (err) => {
          setError('Payment was not completed. Please try again.');
        }
      });
    } catch (err: any) {
      setError(err.message || 'Error opening payment gateway.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-rose-600/20 border-t-rose-600 rounded-full animate-spin" />
          <p className="text-sm font-semibold tracking-wide text-rose-700">Checking Registration &amp; Payment Status...</p>
        </div>
      </div>
    );
  }

  if (error || !statusData) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-3xl p-8 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-2xl font-bold">
            !
          </div>
          <h2 className="text-2xl font-extrabold text-stone-900">Record Not Found</h2>
          <p className="text-sm text-stone-600 leading-relaxed font-medium">
            {error || 'We could not find this registration inquiry.'}
          </p>
          <Link
            href="/"
            className="inline-block w-full py-3.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold rounded-2xl transition-all shadow-md shadow-rose-600/25"
          >
            ← Return to Home
          </Link>
        </div>
      </div>
    );
  }

  const coupleDisplayName = statusData.husbandName && statusData.wifeName
    ? `${statusData.husbandName} & ${statusData.wifeName} ${statusData.surname || ''}`.trim()
    : statusData.coupleName || 'Registered Couple';

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex flex-col justify-between font-sans">
      {/* Header */}
      <header className="py-4 px-6 md:px-12 border-b border-stone-200 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-xs">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-10 w-auto object-contain" />
            <span className="text-lg font-extrabold tracking-wider text-stone-900 uppercase hidden sm:inline">Ek Duje Ke Liye</span>
          </Link>
          <Link
            href="/"
            className="text-xs text-rose-700 hover:text-rose-800 font-bold border border-rose-300 hover:bg-rose-50 px-4 py-2 rounded-xl transition-all"
          >
            ← Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-xl mx-auto px-6 py-10 w-full z-10 flex flex-col justify-center">
        
        {paySuccess || statusData.passAvailable ? (
          /* Payment Completed View */
          <div className="bg-white border border-emerald-200 rounded-3xl p-8 md:p-10 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircleIcon className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest block mb-1">Payment Captured</span>
              <h1 className="text-2xl md:text-3xl font-extrabold text-stone-900">Pass Confirmed!</h1>
              <p className="text-stone-600 text-sm mt-2 font-medium">
                Your payment for <strong>{statusData.programName}</strong> is confirmed.
              </p>
            </div>

            {/* Prominent Registration Number Badge */}
            <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 border border-amber-300 rounded-2xl p-4 text-center space-y-1 shadow-inner">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-widest block">
                રજીસ્ટ્રેશન નંબર (Registration Pass ID)
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-700 font-mono tracking-wider block select-all">
                {statusData.inquiryId}
              </span>
              <span className="text-[10px] text-stone-600 block font-medium">Save this ID for reference &amp; venue check-in</span>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-left text-xs space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-medium flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-stone-400" />
                  <span>Couple Name:</span>
                </span>
                <span className="font-bold text-stone-900">{coupleDisplayName}</span>
              </div>
              {statusData.phoneNumber && (
                <div className="flex justify-between items-center">
                  <span className="text-stone-500 font-medium flex items-center gap-1.5">
                    <PhoneIcon className="w-3.5 h-3.5 text-stone-400" />
                    <span>Mobile Number:</span>
                  </span>
                  <span className="font-bold font-mono text-stone-900">{statusData.phoneNumber}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-medium flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-stone-400" />
                  <span>Event Date:</span>
                </span>
                <span className="font-semibold text-stone-900">{formatIndianDate(statusData.programDate)}</span>
              </div>
            </div>

            <Link
              href={`/pass/${statusData.inquiryId}`}
              className="inline-flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold rounded-2xl transition-all shadow-xl shadow-rose-600/25 text-center cursor-pointer"
            >
              <TicketIcon className="w-4 h-4" />
              <span>View &amp; Download Pass</span>
            </Link>
          </div>
        ) : (
          /* Payment Pending View */
          <div className="bg-white border border-amber-300 rounded-3xl p-6 sm:p-8 md:p-10 shadow-2xl space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                <ClockIcon className="w-7 h-7 text-amber-600" />
              </div>
              <span className="text-xs font-bold text-amber-800 uppercase tracking-widest block">Complete Your Booking</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">Payment Pending</h1>
              <p className="text-xs text-stone-600 font-medium">
                Please complete your payment to register and receive your official couple entry pass.
              </p>
            </div>

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl text-center">
                {error}
              </div>
            )}

            {/* Verification Notice Badge */}
            <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-center space-y-1">
              <span className="text-[11px] font-bold text-amber-900 inline-flex items-center justify-center gap-1.5 flex-wrap">
                <ShieldCheckIcon className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <span>કૃપા કરીને પેમેન્ટ કરતાં પહેલાં તમારી વિગતો (નામ અને મોબાઈલ નંબર) ચકાસી લો.</span>
              </span>
              <span className="text-[10px] text-amber-800 font-medium block">
                Please verify your registered couple name and mobile number below before proceeding.
              </span>
            </div>

            {/* Couple Registration Details Card */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 sm:p-5 text-xs space-y-3 text-stone-700">
              <div className="flex justify-between items-center border-b border-stone-200/60 pb-2">
                <span className="text-stone-500 font-medium">Inquiry / Token ID:</span>
                <span className="font-mono font-extrabold text-sm text-rose-700">{statusData.inquiryId}</span>
              </div>

              {/* Couple Name Highlighted */}
              <div className="flex justify-between items-center border-b border-stone-200/60 pb-2">
                <span className="text-stone-500 font-medium flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-stone-400" />
                  <span>Couple Name:</span>
                </span>
                <span className="font-extrabold text-stone-900 text-right">{coupleDisplayName}</span>
              </div>

              {/* Registered Phone Number */}
              {statusData.phoneNumber && (
                <div className="flex justify-between items-center border-b border-stone-200/60 pb-2">
                  <span className="text-stone-500 font-medium flex items-center gap-1.5">
                    <PhoneIcon className="w-3.5 h-3.5 text-stone-400" />
                    <span>Mobile Number:</span>
                  </span>
                  <span className="font-extrabold font-mono text-stone-900">{statusData.phoneNumber}</span>
                </div>
              )}

              <div className="flex justify-between items-center border-b border-stone-200/60 pb-2">
                <span className="text-stone-500 font-medium flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-stone-400" />
                  <span>Seminar Slot:</span>
                </span>
                <span className="font-semibold text-stone-900 text-right max-w-[220px] truncate">{statusData.programName}</span>
              </div>

              <div className="flex justify-between items-center border-b border-stone-200/60 pb-2">
                <span className="text-stone-500 font-medium">Date &amp; Time:</span>
                <span className="font-semibold text-stone-900 text-right">
                  {formatIndianDate(statusData.programDate)}
                  {statusData.programTime ? ` • ${statusData.programTime}` : ''}
                </span>
              </div>

              {statusData.venue && (
                <div className="flex justify-between items-center border-b border-stone-200/60 pb-2">
                  <span className="text-stone-500 font-medium flex items-center gap-1.5">
                    <MapPinIcon className="w-3.5 h-3.5 text-stone-400" />
                    <span>Venue:</span>
                  </span>
                  <span className="font-semibold text-stone-900 text-right max-w-[220px] truncate">{statusData.venue}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-1">
                <span className="text-stone-500 font-bold uppercase tracking-wider">Couple Seminar Fee:</span>
                <span className="text-lg font-extrabold text-stone-900 font-mono">
                  ₹{statusData.price !== undefined ? statusData.price : (statusData.amount || 1500)}
                </span>
              </div>
            </div>

            {/* Non-Refundable Policy */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-0.5">
              <span className="text-[11px] font-bold text-amber-900 flex items-center justify-center gap-1.5">
                <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <span>Non-Refundable &amp; Non-Transferable</span>
              </span>
              <p className="text-[10px] text-amber-800 font-medium">
                સેમિનાર ફી કોઈપણ સંજોગોમાં રિફંડ કે ટ્રાન્સફર થશે નહીં.
              </p>
            </div>

            {/* Early Registration Mode: Online Payment Disabled Notice */}
            {statusData.isPaymentEnabled === false || statusData.earlyRegistrationMode ? (
              <div className="space-y-3">
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-left text-xs space-y-2 text-stone-800">
                  <div className="font-extrabold text-rose-900 text-xs flex items-center gap-1.5">
                    <ShieldCheckIcon className="w-4 h-4 text-rose-700 flex-shrink-0" />
                    <span>Online Payment Opening Soon &bull; ઓનલાઇન પેમેન્ટ ટૂંક સમયમાં શરૂ થશે</span>
                  </div>
                  <p className="text-stone-700 leading-relaxed">
                    <strong>English:</strong> Registration is accepted. Online payment for this event will be enabled shortly. You will receive a direct payment link on your registered WhatsApp number once payment opens. Your seat will be confirmed after successful payment.
                  </p>
                  <p className="text-stone-700 leading-relaxed">
                    <strong>ગુજરાતી:</strong> તમારી નોંધણી સ્વીકારાઈ ગઈ છે. આ કાર્યક્રમ માટે ઓનલાઈન પેમેન્ટની સુવિધા ટૂંક સમયમાં શરૂ કરવામાં આવશે. પેમેન્ટ શરૂ થયા પછી તમારા WhatsApp પર લિંક મોકલવામાં આવશે.
                  </p>
                </div>

                <button
                  disabled
                  className="w-full py-4 bg-stone-200 text-stone-500 font-bold rounded-2xl cursor-not-allowed text-xs uppercase tracking-wider"
                >
                  Online Payment Opening Soon (ઓનલાઈન પેમેન્ટ ટૂંક સમયમાં શરૂ થશે)
                </button>
              </div>
            ) : (
              <button
                onClick={handlePayNow}
                disabled={paying}
                className="w-full py-4 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 disabled:opacity-50 text-white font-extrabold rounded-2xl transition-all shadow-xl shadow-rose-600/25 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                {paying ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Opening Razorpay Gateway...</span>
                  </>
                ) : (
                  <>
                    <TicketIcon className="w-4 h-4" />
                    <span>Pay ₹{statusData.price !== undefined ? statusData.price : (statusData.amount || 1500)} via Razorpay</span>
                  </>
                )}
              </button>
            )}
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
