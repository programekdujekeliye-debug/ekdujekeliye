'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../config';
import { AlertTriangleIcon, ShieldCheckIcon } from '../../components/Icons';

export default function CancellationRefundPolicyPage() {
  const [config, setConfig] = useState<{
    brandName?: string;
    supportPhone?: string;
    supportWhatsapp?: string;
    supportEmail?: string;
    defaultCity?: string;
    businessCategory?: string;
    businessDescription?: string;
    defaultSpeakerName?: string;
  }>({
    brandName: 'Ek Duje Ke Liye',
    supportPhone: '+91 82003 02328',
    supportWhatsapp: '+91 82003 02328',
    supportEmail: 'privacy.ekdujekeliye@gmail.com',
    defaultCity: 'Surat, Gujarat',
    businessCategory: 'Events & Programs',
    businessDescription: 'Ek Duje Ke Liye - A Special Program for Couples',
    defaultSpeakerName: 'Manish Vaghasiya'
  });

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/config/public`)
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setConfig((prev) => ({
            ...prev,
            ...data,
            supportPhone: data.supportPhone || prev.supportPhone,
            supportWhatsapp: data.supportWhatsapp || prev.supportWhatsapp,
            supportEmail: data.supportEmail || prev.supportEmail,
            defaultCity: data.defaultCity || prev.defaultCity,
            brandName: data.brandName || prev.brandName,
            defaultSpeakerName: data.defaultSpeakerName || prev.defaultSpeakerName
          }));
        }
      })
      .catch((err) => console.error('Failed to load dynamic refund config:', err));
  }, []);

  const brand = config.brandName || 'Ek Duje Ke Liye';
  const speaker = config.defaultSpeakerName || 'Manish Vaghasiya';

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex flex-col justify-between font-sans relative">
      {/* Header */}
      <header className="py-5 px-6 md:px-8 border-b border-stone-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-xs">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-9 w-auto object-contain" />
            <div>
              <span className="text-lg font-extrabold tracking-tight text-stone-900 uppercase block leading-tight">
                {brand}
              </span>
              <span className="text-[10px] tracking-widest text-rose-700 font-bold uppercase block">
                A Program for Couples by {speaker}
              </span>
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
      <main className="flex-grow max-w-4xl mx-auto px-6 py-10 sm:py-12 w-full z-10">
        <div className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-10 md:p-12 shadow-xl space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-extrabold uppercase tracking-wider mb-2">
              <ShieldCheckIcon className="w-3.5 h-3.5" />
              <span>Official Cancellation &amp; Refund Policy</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-stone-900 tracking-tight">
              Cancellation &amp; Refund Policy
            </h1>
            <p className="text-xs text-stone-500 mt-2 font-medium">
              Last Updated: August 2026 &bull; Domain: www.ekdujekeliye.in
            </p>
          </div>

          <div className="space-y-6 text-sm text-stone-700 leading-relaxed">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                1. Nature of Services
              </h2>
              <p>
                <strong>{brand}</strong> is an interactive relationship seminar and couple program led by{' '}
                <strong>{speaker}</strong>. Fees collected on <strong>www.ekdujekeliye.in</strong> are registration fees for reserved couple seating and digital entry passes at scheduled live workshops.
              </p>
            </section>

            {/* Section 2: Strict Non-Refundable Policy */}
            <section className="space-y-3 bg-amber-50/80 border border-amber-200/90 rounded-2xl p-5 sm:p-6">
              <h2 className="text-base sm:text-lg font-extrabold text-amber-900 flex items-center gap-2">
                <AlertTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span>2. 100% Non-Refundable &amp; Non-Transferable Policy</span>
              </h2>
              <p className="text-stone-900 font-bold text-xs sm:text-sm">
                કોઈપણ સંજોગોમાં સેમિનાર નોંધણી ફી રિફંડ કે બીજા કોઈ વ્યક્તિને ટ્રાન્સફર થશે નહીં.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-stone-700 text-xs">
                <li>
                  <strong>No Cancellations &amp; No Refunds:</strong> Once a couple registration fee is paid through our authorized gateway (Razorpay) or official accounts, it is <strong>100% non-refundable</strong> under any personal circumstances, schedule conflicts, late arrival, or absenteeism.
                </li>
                <li>
                  <strong>Strictly Non-Transferable:</strong> Admission passes are issued exclusively in the name and photograph of the registered couple. Passes cannot be re-assigned, transferred, or resold to any other couple or individual.
                </li>
                <li>
                  <strong>Operational Rationale:</strong> Auditorium seats, venue arrangements, program materials, and logistical resources are reserved and pre-funded in advance based on confirmed registrations.
                </li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                3. Organizer Rescheduling
              </h2>
              <p>
                In the rare event that a seminar batch must be rescheduled by the organizers due to administrative necessity or force majeure:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
                <li>All confirmed couple registrations will automatically be transferred and honored for the rescheduled seminar date at no additional charge.</li>
                <li>Participants will be notified immediately of the revised date and venue via WhatsApp, SMS, and email.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                4. Gateway Technical Errors &amp; Duplicate Debits
              </h2>
              <p>
                In the rare case of a technical glitch during payment processing (e.g., amount debited from your bank but network interruption prevented receipt generation):
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
                <li>Please message our support helpline with your bank transaction reference number.</li>
                <li>If a duplicate debit is verified by Razorpay, the redundant payment will be credited back to your original payment method within 5–7 banking days.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                5. Contact Support Desk
              </h2>
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 text-xs space-y-2.5 text-stone-700">
                <p><strong>Initiative:</strong> {brand} &bull; Led by {speaker}</p>
                <p><strong>Support Helpline:</strong> <a href={`tel:${config.supportPhone}`} className="text-rose-700 font-bold hover:underline">{config.supportPhone}</a></p>
                <p><strong>WhatsApp Support:</strong> <a href={`https://wa.me/${config.supportWhatsapp?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-bold hover:underline">{config.supportWhatsapp} ↗</a></p>
                <p><strong>Official Email:</strong> <a href={`mailto:${config.supportEmail}`} className="text-stone-900 font-bold hover:underline">{config.supportEmail}</a></p>
                <p><strong>Operating Location:</strong> {config.defaultCity || 'Surat, Gujarat, India'}</p>
              </div>
            </section>
          </div>

          <div className="pt-6 border-t border-stone-200 flex justify-between items-center text-xs text-stone-600">
            <Link href="/" className="hover:text-rose-700 font-bold transition-colors">
              ← Return to Home
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
          &copy; {new Date().getFullYear()} {brand} &bull; A Program for Couples by {speaker}. All rights reserved.
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
