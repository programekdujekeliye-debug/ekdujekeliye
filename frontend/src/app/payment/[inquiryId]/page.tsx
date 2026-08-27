'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL } from '../../../config';
import { openRazorpayModal } from '../../../components/RazorpayModal';

interface PaymentStatusResponse {
  inquiryId: string;
  registrationStatus: string;
  paymentStatus: string;
  paymentProvider: string;
  amount: number;
  paidAt: string | null;
  passAvailable: boolean;
  coupleName: string;
  programName: string;
  programDate: string;
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
          inquiryId: statusData.inquiryId
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
      <div className="min-h-screen bg-gradient-to-br from-[#1a050d] via-[#0c0306] to-[#080205] text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
          <p className="text-sm font-semibold tracking-wide text-rose-300">Checking Payment Status...</p>
        </div>
      </div>
    );
  }

  if (error || !statusData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a050d] via-[#0c0306] to-[#080205] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-2xl font-bold">
            !
          </div>
          <h2 className="text-2xl font-extrabold text-slate-100">Record Not Found</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            {error || 'We could not find this registration inquiry.'}
          </p>
          <Link
            href="/"
            className="inline-block w-full py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl transition-all"
          >
            ← Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a050d] via-[#0c0306] to-[#080205] text-slate-100 flex flex-col justify-between font-sans">
      {/* Header */}
      <header className="py-5 px-6 md:px-12 border-b border-rose-950/40 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-10 w-auto object-contain" />
            <span className="text-lg font-bold tracking-wider text-slate-100 uppercase hidden sm:inline">Ek Duje Ke Liye</span>
          </Link>
          <Link
            href="/"
            className="text-xs text-rose-400 hover:text-rose-300 font-semibold border border-rose-500/30 hover:bg-rose-500/10 px-4 py-2 rounded-xl transition-all"
          >
            ← Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-xl mx-auto px-6 py-12 w-full z-10 flex flex-col justify-center">
        
        {paySuccess || statusData.passAvailable ? (
          /* Payment Completed View */
          <div className="bg-white/5 border border-emerald-500/30 rounded-3xl p-8 md:p-10 backdrop-blur-xl shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-3xl font-bold">
              ✓
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block mb-1">Payment Completed</span>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100">Pass Confirmed!</h1>
              <p className="text-slate-300 text-sm mt-2">
                Your payment for <strong>{statusData.programName}</strong> has been successfully captured.
              </p>
            </div>

            {/* Prominent Registration Number Badge */}
            <div className="bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-amber-500/15 border border-amber-500/40 rounded-2xl p-4 text-center space-y-1">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-widest block">
                રજીસ્ટ્રેશન નંબર (Registration Pass ID)
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono tracking-wider block select-all">
                {statusData.inquiryId}
              </span>
              <span className="text-[10px] text-slate-400 block">Save this ID for reference &amp; venue check-in</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Couple:</span>
                <span className="font-semibold text-slate-200">{statusData.coupleName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Event Date:</span>
                <span className="font-semibold text-slate-200">{formatIndianDate(statusData.programDate)}</span>
              </div>
            </div>

            <Link
              href={`/pass/${statusData.inquiryId}`}
              className="inline-block w-full py-4 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-slate-950 font-bold rounded-2xl transition-all shadow-xl shadow-rose-500/25 text-center"
            >
              🎟️ View &amp; Download Pass
            </Link>
          </div>
        ) : (
          /* Payment Pending View */
          <div className="bg-white/5 border border-amber-500/30 rounded-3xl p-8 md:p-10 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-2xl font-bold">
                💳
              </div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block">Complete Your Booking</span>
              <h1 className="text-2xl font-extrabold text-slate-100">Payment Pending</h1>
              <p className="text-slate-300 text-xs leading-relaxed">
                Complete your online payment via Razorpay to instantly receive your couple entry pass.
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Inquiry ID:</span>
                <span className="font-bold text-amber-400">{statusData.inquiryId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Couple:</span>
                <span className="font-semibold text-slate-200">{statusData.coupleName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Event:</span>
                <span className="font-semibold text-slate-200">{statusData.programName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Date:</span>
                <span className="font-semibold text-slate-200">{statusData.programDate}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-800 text-sm">
                <span className="text-slate-300 font-semibold">Total Amount:</span>
                <span className="font-extrabold text-amber-400 text-base">₹{statusData.amount || 1499}</span>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                {error}
              </div>
            )}

            <button
              onClick={handlePayNow}
              disabled={paying}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 disabled:opacity-50 text-slate-950 font-extrabold rounded-2xl transition-all shadow-xl shadow-rose-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              {paying ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Opening Gateway...</span>
                </>
              ) : (
                <>
                  <span>Pay ₹{statusData.amount || 1499} via Razorpay</span>
                  <span>💳</span>
                </>
              )}
            </button>

            <p className="text-center text-[11px] text-slate-500">
              🔒 Safe &amp; Secure 256-Bit SSL Encrypted Payment
            </p>
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
