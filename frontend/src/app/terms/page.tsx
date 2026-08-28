import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangleIcon } from '../../components/Icons';

export const metadata: Metadata = {
  title: 'Terms & Conditions | Ek Duje Ke Liye - Educational Seminars',
  description: 'Terms and Conditions and registration guidelines for Ek Duje Ke Liye educational seminars and couple workshops led by Manish Vaghasiya.',
};

export default function TermsPage() {
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
              Official Educational Seminar Terms
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-stone-900 tracking-tight">Terms &amp; Conditions</h1>
            <p className="text-xs text-stone-500 mt-2">Last Updated: August 28, 2026 &bull; Domain: www.ekdujekeliye.in</p>
          </div>

          <div className="space-y-6 text-sm text-stone-700 leading-relaxed">
            
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">1. Acceptance of Terms &amp; Scope of Services</h2>
              <p>
                <strong>Ek Duje Ke Liye</strong> is an educational relationship and life-skills seminar initiative led by <strong>Manish Vaghasiya</strong>. The services offered through <strong>www.ekdujekeliye.in</strong> comprise educational seminars, couple communication workshops, registration services, digital attendance passes, and participant assistance (&quot;Services&quot;).
              </p>
              <p>
                By registering on this website, completing an order, or attending any educational seminar session, you agree to be bound by these Terms and Conditions.
              </p>
            </section>

            <section className="space-y-3 bg-amber-50/80 border border-amber-200/90 rounded-2xl p-5">
              <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span>2. Strict Non-Refundable &amp; Non-Transferable Policy</span>
              </h2>
              <p className="text-stone-800 font-semibold">
                કોઈપણ સંજોગોમાં સેમિનાર નોંધણી ફી રિફંડ કે બીજા કોઈ વ્યક્તિને ટ્રાન્સફર થશે નહીં.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-stone-700 text-xs">
                <li><strong>No Refunds:</strong> All payments made for couple seminar registration fees are <strong>100% Non-Refundable</strong> under any personal circumstances, absence, or late arrival.</li>
                <li><strong>No Transfers:</strong> Entry passes are personalized and issued exclusively to the registered married couple named and pictured on the digital badge. Passes cannot be transferred, resold, or assigned to other couples or individuals.</li>
                <li><strong>Advance Hall &amp; Material Commitments:</strong> Because seminar auditorium seats and educational materials are committed in advance for each registered couple, cancellations cannot be accommodated.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">3. Admission &amp; Seminar Code of Conduct</h2>
              <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
                <li>Each pass admits exactly one married couple (2 adults).</li>
                <li>Children and non-registered guests are strictly not permitted inside the seminar hall to ensure an undisturbed educational environment for all couples.</li>
                <li>Attendees must present their verified digital or printed pass with QR code and Inquiry ID at the seminar check-in desk.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">4. Rescheduling by Organizers</h2>
              <p>
                In the rare event that an educational seminar batch must be rescheduled due to administrative, weather, or unforeseen circumstances, all registered couples will automatically be allotted entry to the rescheduled session date without any extra charges.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">5. Communications &amp; WhatsApp Notifications</h2>
              <p>
                By providing your mobile number during registration, you authorize our team to send booking confirmations, digital pass download links, and seminar updates directly to your WhatsApp account and SMS.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">6. Official Contact &amp; Support</h2>
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 text-xs space-y-2 text-stone-700">
                <p><strong>Organizer:</strong> Ek Duje Ke Liye — Educational Seminars led by Manish Vaghasiya</p>
                <p><strong>Official Email:</strong> privacy.ekdujekeliye@gmail.com</p>
                <p><strong>Support Helpline:</strong> +91 82003 02328</p>
                <p><strong>Operating City:</strong> Surat, Gujarat, India</p>
                <p><strong>Venue Address:</strong> As specified on your official seminar booking pass.</p>
              </div>
            </section>

          </div>

          <div className="pt-6 border-t border-stone-200 flex justify-between items-center text-xs text-stone-600">
            <Link href="/" className="hover:text-rose-700 font-bold transition-colors">
              ← Return to Seminar Home
            </Link>
            <Link href="/privacy-policy" className="hover:text-rose-700 font-bold transition-colors">
              Privacy Policy →
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
