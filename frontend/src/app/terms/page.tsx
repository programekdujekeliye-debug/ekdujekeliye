import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms & Refund Policy | Ek Duje Ke Liye',
  description: 'Terms and conditions, strict non-refundable and non-transferable pass policy for Ek Duje Ke Liye events by Manish Vaghasiya.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col justify-between font-sans relative">
      {/* Header */}
      <header className="py-5 px-6 md:px-8 border-b border-stone-200 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-xs">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-9 w-auto object-contain" />
            <span className="text-lg font-bold tracking-tight text-stone-900 uppercase">Ek Duje Ke Liye</span>
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
              Official Event Terms &amp; Conditions
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-stone-900 tracking-tight">Terms of Service &amp; Refund Policy</h1>
            <p className="text-xs text-stone-500 mt-2">Last Updated: August 27, 2026 &bull; Domain: www.ekdujekeliye.in</p>
          </div>

          <div className="space-y-6 text-sm text-stone-700 leading-relaxed">
            
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">1. Acceptance of Terms</h2>
              <p>
                By registering on <strong>www.ekdujekeliye.in</strong>, purchasing an entry pass, or attending any couple seminar session conducted by <strong>Manish Vaghasiya</strong>, you agree to be bound by these Terms and Conditions.
              </p>
            </section>

            <section className="space-y-3 bg-amber-50/80 border border-amber-200/90 rounded-2xl p-5">
              <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                <span>⚠️</span> 2. Strict Non-Refundable &amp; Non-Transferable Policy
              </h2>
              <p className="text-stone-800 font-semibold">
                કોઈપણ સંજોગોમાં સેમિનાર નોંધણી ફી રિફંડ કે બીજા કોઈ વ્યક્તિને ટ્રાન્સફર થશે નહીં.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-stone-700 text-xs">
                <li><strong>No Refunds:</strong> All payments made for couple admission passes are <strong>100% Non-Refundable</strong> under any personal circumstances, absenteeism, or late arrival.</li>
                <li><strong>No Transfers:</strong> Entry passes are issued exclusively to the registered married couple whose names and photograph are printed on the badge. Passes cannot be transferred, sold, or gifted to other individuals.</li>
                <li><strong>Limited Seating:</strong> Because hall seats and materials are committed in advance for each couple, cancellations cannot be accommodated.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">3. Admission &amp; Venue Rules</h2>
              <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
                <li>Each pass admits exactly one married couple (2 adults).</li>
                <li>Children and non-registered persons are strictly not permitted inside the seminar hall.</li>
                <li>Attendees must present their digital or printed pass with the verified QR code and Inquiry ID at the registration desk.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">4. Rescheduling by Organizers</h2>
              <p>
                In the rare event that a session must be rescheduled due to administrative or unforeseen reasons, registered couples will automatically be allotted entry to the rescheduled session date without extra charges.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">5. Communications &amp; WhatsApp Updates</h2>
              <p>
                By providing your mobile number, you authorize our team to send booking confirmations, digital pass download links, and seminar updates directly to your WhatsApp account.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">6. Official Contact &amp; Support</h2>
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 text-xs space-y-2 text-stone-700">
                <p><strong>Organizer:</strong> Ek Duje Ke Liye by Manish Vaghasiya</p>
                <p><strong>Official Email:</strong> privacy.ekdujekeliye@gmail.com</p>
                <p><strong>Support Helpline:</strong> +91 92135 32835</p>
                <p><strong>Venue Address:</strong> Sardar Patel Smruti Bhavan, Mini Bazar, Varachha Road, Surat, Gujarat 395006</p>
              </div>
            </section>

          </div>

          <div className="pt-6 border-t border-stone-200 flex justify-between items-center text-xs text-stone-600">
            <Link href="/" className="hover:text-rose-700 font-bold transition-colors">
              ← Return to Home
            </Link>
            <Link href="/privacy-policy" className="hover:text-rose-700 font-bold transition-colors">
              Privacy Policy →
            </Link>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-8 border-t border-stone-200 bg-white text-center text-xs text-stone-500">
        &copy; {new Date().getFullYear()} Ek Duje Ke Liye by Manish Vaghasiya. All rights reserved. &bull; <Link href="/privacy-policy" className="text-stone-700 font-medium hover:underline">Privacy Policy</Link> &bull; <Link href="/terms" className="text-stone-700 font-medium hover:underline">Terms of Service</Link>
      </footer>
    </div>
  );
}
