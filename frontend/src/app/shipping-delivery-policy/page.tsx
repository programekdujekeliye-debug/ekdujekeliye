import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SparklesIcon, CheckCircleIcon } from '../../components/Icons';

export const metadata: Metadata = {
  title: 'Shipping & Delivery Policy | Ek Duje Ke Liye',
  description: 'Digital Pass and Registration Delivery Policy for Ek Duje Ke Liye educational relationship seminars led by Manish Vaghasiya.',
};

export default function ShippingDeliveryPolicyPage() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col justify-between font-sans relative">
      {/* Header */}
      <header className="py-5 px-6 md:px-8 border-b border-stone-200 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-xs">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-9 w-auto object-contain" />
            <div>
              <span className="text-lg font-bold tracking-tight text-stone-900 uppercase block leading-tight">Ek Duje Ke Liye</span>
              <span className="text-[10px] tracking-widest text-rose-700 font-bold uppercase block">Educational Seminars by Manish Vaghasiya</span>
            </div>
          </Link>
          <Link
            href="/"
            className="text-xs text-rose-700 hover:text-rose-800 font-bold border border-stone-300 hover:bg-stone-100 px-4 py-2 rounded-xl transition-all shadow-xs"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-4xl mx-auto px-6 py-12 w-full z-10">
        <div className="bg-white border border-stone-200 rounded-3xl p-8 md:p-12 shadow-xl space-y-8">
          
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold uppercase tracking-wider mb-2">
              Official Electronic Delivery Policy
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-stone-900 tracking-tight">Shipping &amp; Delivery Policy</h1>
            <p className="text-xs text-stone-500 mt-2">Last Updated: August 28, 2026 &bull; Domain: www.ekdujekeliye.in</p>
          </div>

          <div className="space-y-6 text-sm text-stone-700 leading-relaxed">
            
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">1. Digital &amp; Electronic Service Delivery</h2>
              <p>
                <strong>Ek Duje Ke Liye</strong> is an educational seminar and workshop initiative led by <strong>Manish Vaghasiya</strong>. We provide in-person educational couple seminars and workshops.
              </p>
              <p>
                <strong>No physical shipping of merchandise or goods is involved.</strong> All seminar admissions, booking confirmations, and couple entry passes are delivered 100% electronically and digitally.
              </p>
            </section>

            <section className="space-y-3 bg-rose-50/80 border border-rose-200/90 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-rose-900 flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-rose-600 flex-shrink-0" />
                <span>2. Delivery Channels &amp; Timelines</span>
              </h2>
              <ul className="list-disc pl-5 space-y-2.5 text-stone-700 text-xs">
                <li><strong>Instant On-Screen Delivery:</strong> Immediately upon successful payment verification via Razorpay, your personalized digital seminar couple pass with official QR code is generated on screen for instant viewing and image download.</li>
                <li><strong>WhatsApp Notification:</strong> An electronic confirmation containing your Inquiry ID, seminar details, and digital pass download link is sent to your registered mobile number via Meta WhatsApp Business Cloud API within 1–5 minutes of successful registration.</li>
                <li><strong>On-Demand Lookup:</strong> Attendees can view or re-download their digital admission pass at any time by visiting <code>https://ekdujekeliye.in/pass/[InquiryID]</code>.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">3. Physical Seminar Kits &amp; Materials</h2>
              <p>
                Physical educational materials (such as printed participant badges, workshop activity sheets, and seminar stationery) are handed over directly to registered couples in person at the seminar venue reception desk upon presentation of their digital pass and verified Inquiry ID.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">4. Delivery Support &amp; Assistance</h2>
              <p>
                If you have completed your payment but did not receive your digital pass or WhatsApp confirmation message within 15 minutes:
              </p>
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 text-xs space-y-2 text-stone-700">
                <p><strong>Support Helpline:</strong> +91 92135 32835 (Call or WhatsApp)</p>
                <p><strong>Support Email:</strong> privacy.ekdujekeliye@gmail.com</p>
                <p><strong>Organization:</strong> Ek Duje Ke Liye — Educational Seminars led by Manish Vaghasiya</p>
                <p><strong>Operating Location:</strong> Surat, Gujarat, India</p>
              </div>
            </section>

          </div>

          <div className="pt-6 border-t border-stone-200 flex justify-between items-center text-xs text-stone-600">
            <Link href="/" className="hover:text-rose-700 font-bold transition-colors">
              ← Return to Seminar Home
            </Link>
            <Link href="/terms" className="hover:text-rose-700 font-bold transition-colors">
              Terms &amp; Conditions →
            </Link>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-8 border-t border-stone-200 bg-white text-center text-xs text-stone-500 space-y-2">
        <div>
          &copy; {new Date().getFullYear()} Ek Duje Ke Liye &bull; Educational Seminars by Manish Vaghasiya. All rights reserved.
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-[11px]">
          <Link href="/privacy-policy" className="text-stone-600 hover:underline">Privacy Policy</Link>
          <span>&bull;</span>
          <Link href="/terms" className="text-stone-600 hover:underline">Terms &amp; Conditions</Link>
          <span>&bull;</span>
          <Link href="/cancellation-refund-policy" className="text-stone-600 hover:underline">Refund Policy</Link>
          <span>&bull;</span>
          <Link href="/shipping-delivery-policy" className="text-stone-600 hover:underline">Delivery Policy</Link>
          <span>&bull;</span>
          <Link href="/contact" className="text-stone-600 hover:underline">Contact Us</Link>
        </div>
      </footer>
    </div>
  );
}
