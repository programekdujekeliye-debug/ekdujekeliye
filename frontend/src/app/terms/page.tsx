import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms and Conditions | Ek Duje Ke Liye',
  description: 'Terms and conditions for attending Ek Duje Ke Liye events and using our invitation pass services.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a050d] via-[#0c0306] to-[#080205] text-slate-100 flex flex-col justify-between font-sans relative">
      {/* Header */}
      <header className="py-6 px-8 border-b border-rose-950/40 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-10 w-auto object-contain" />
            <span className="text-xl font-bold tracking-wider text-slate-100 uppercase">Ek Duje Ke Liye</span>
          </Link>
          <Link
            href="/"
            className="text-xs text-rose-400 hover:text-rose-300 font-semibold border border-rose-500/30 hover:bg-rose-500/10 px-4 py-2 rounded-xl transition-all"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-4xl mx-auto px-6 py-12 w-full z-10">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12 backdrop-blur-xl shadow-2xl space-y-8">
          
          <div>
            <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block mb-2">Legal Information</span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-100 tracking-tight">Terms and Conditions</h1>
            <p className="text-xs text-slate-400 mt-2">Last Updated: August 27, 2026</p>
          </div>

          <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
            
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">1. Acceptance of Terms</h2>
              <p>
                By registering on the <strong>Ek Duje Ke Liye</strong> website (<strong>ekdujekeliye.in</strong>), generating an invitation pass, or attending our event, you agree to be bound by these Terms and Conditions.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">2. Registration &amp; Couple Pass Policy</h2>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li>Each registration pass admits one married couple (2 individuals).</li>
                <li>Passes are strictly <strong>non-refundable</strong> and <strong>non-transferable</strong> once approved and issued.</li>
                <li>Registrations are confirmed only after payment verification by the event administrator.</li>
                <li>Entry to the venue requires presentation of the digital or printed event pass carrying your unique Inquiry ID.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">3. Program Schedule &amp; Venue Rules</h2>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li>Attendees must arrive on time according to the allocated program slot and time.</li>
                <li>The event organizers reserve the right to reschedule or modify program batches due to unforeseen circumstances. Registered attendees will be notified in advance via WhatsApp or phone.</li>
                <li>Organizers reserve the right to deny admission in the event of disorderly conduct or counterfeit passes.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">4. WhatsApp Messaging Consent</h2>
              <p>
                By submitting your phone number, you authorize <strong>Ek Duje Ke Liye</strong> to send event-related updates, pass download links, schedule reminders, and photo gallery links to your WhatsApp account.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">5. Contact Details</h2>
              <p>For inquiries, support, or complaints, please reach out to:</p>
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs space-y-1">
                <p><strong>Organization:</strong> Ek Duje Ke Liye Event Team</p>
                <p><strong>Email:</strong> privacy.ekdujekeliye@gmail.com</p>
                <p><strong>Support Phone:</strong> +91 92135 32835</p>
              </div>
            </section>

          </div>

          <div className="pt-6 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
            <Link href="/" className="hover:text-rose-400 transition-colors">
              ← Return to Event Registration
            </Link>
            <Link href="/privacy-policy" className="hover:text-rose-400 transition-colors">
              Privacy Policy →
            </Link>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-8 border-t border-slate-800/80 bg-slate-950/40 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Ek Duje Ke Liye. All rights reserved. &bull; <Link href="/privacy-policy" className="text-slate-400 hover:underline">Privacy Policy</Link> &bull; <Link href="/terms" className="text-slate-400 hover:underline">Terms of Service</Link>
      </footer>
    </div>
  );
}
