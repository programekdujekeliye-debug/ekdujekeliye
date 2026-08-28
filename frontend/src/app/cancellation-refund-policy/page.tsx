import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangleIcon, ShieldCheckIcon } from '../../components/Icons';

export const metadata: Metadata = {
  title: 'Cancellation & Refund Policy | Ek Duje Ke Liye',
  description: 'Cancellation and Refund Policy for Ek Duje Ke Liye educational relationship seminars and couple workshops led by Manish Vaghasiya.',
};

export default function CancellationRefundPolicyPage() {
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
              Official Cancellation &amp; Refund Policy
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-stone-900 tracking-tight">Cancellation &amp; Refund Policy</h1>
            <p className="text-xs text-stone-500 mt-2">Last Updated: August 28, 2026 &bull; Domain: www.ekdujekeliye.in</p>
          </div>

          <div className="space-y-6 text-sm text-stone-700 leading-relaxed">
            
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">1. Nature of Services</h2>
              <p>
                <strong>Ek Duje Ke Liye</strong> is an educational seminar and workshop initiative led by <strong>Manish Vaghasiya</strong>. All fees collected on <strong>www.ekdujekeliye.in</strong> are registration fees for reserved seats at structured educational couple seminars and workshops.
              </p>
            </section>

            <section className="space-y-3 bg-amber-50/80 border border-amber-200/90 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span>2. 100% Non-Refundable &amp; Non-Transferable Policy</span>
              </h2>
              <p className="text-stone-800 font-semibold">
                કોઈપણ સંજોગોમાં સેમિનાર નોંધણી ફી રિફંડ કે બીજા કોઈ વ્યક્તિને ટ્રાન્સફર થશે નહીં.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-stone-700 text-xs">
                <li><strong>No Cancellations / No Refunds:</strong> Once an educational seminar registration fee is paid through our payment gateway (Razorpay) or official channels, it is <strong>100% non-refundable</strong> under all circumstances including personal emergencies, change of mind, schedule conflicts, late arrival, or absenteeism.</li>
                <li><strong>Strictly Non-Transferable:</strong> Admission passes are issued in the name and photograph of the specific married couple registered. Passes cannot be re-assigned, transferred, or sold to any other couple or individual.</li>
                <li><strong>Operational Rationale:</strong> Auditorium seats, seminar kits, interactive study materials, and logistic resources are reserved and pre-funded in advance based on confirmed registrations.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">3. Organizer Rescheduling or Postponement</h2>
              <p>
                In the rare event that an educational seminar batch must be rescheduled by the organizers due to administrative necessity, venue unavailability, or force majeure events:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
                <li>All confirmed couple registrations will automatically be transferred and honored for the rescheduled seminar date at no additional fee.</li>
                <li>Participants will be notified immediately of the revised date and venue via WhatsApp, SMS, and/or email.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">4. Payment Issues &amp; Double Charges</h2>
              <p>
                In case of technical errors during payment processing (e.g., amount debited from your bank account but registration token was not generated due to network disruption):
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
                <li>Please email our support team at <strong>privacy.ekdujekeliye@gmail.com</strong> or message our helpline at <strong>+91 92135 32835</strong> with your transaction reference or bank debit statement.</li>
                <li>If a genuine duplicate payment is verified by our payment gateway (Razorpay), the redundant transaction will be credited back to your original payment source within 5–7 working days as per standard banking timelines.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">5. Contact Support</h2>
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 text-xs space-y-2 text-stone-700">
                <p><strong>Initiative:</strong> Ek Duje Ke Liye — Educational Seminars led by Manish Vaghasiya</p>
                <p><strong>Support Email:</strong> privacy.ekdujekeliye@gmail.com</p>
                <p><strong>Support Helpline:</strong> +91 92135 32835</p>
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
