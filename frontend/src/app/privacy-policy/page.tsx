'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../config';
import { ShieldCheckIcon } from '../../components/Icons';

export default function PrivacyPolicyPage() {
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
      .catch((err) => console.error('Failed to load dynamic privacy config:', err));
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
              <span>Legal &amp; Compliance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-stone-900 tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-xs text-stone-500 mt-2 font-medium">
              Last Updated: August 2026 &bull; Domain: www.ekdujekeliye.in
            </p>
          </div>

          <div className="space-y-6 text-sm text-stone-700 leading-relaxed">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                1. Introduction &amp; Operating Context
              </h2>
              <p>
                Welcome to <strong>{brand}</strong> (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;).{' '}
                <strong>{brand}</strong> is an interactive relationship seminar and couple workshop initiative led by{' '}
                <strong>{speaker}</strong>. We provide seminar registration services, digital entry pass issuance, and event coordination through our official platform (<strong>ekdujekeliye.in</strong>).
              </p>
              <p>
                We respect your privacy and are committed to protecting the personal information you provide when booking seats for our seminars. This Privacy Policy outlines how your data is collected, utilized, stored, and protected.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                2. Information We Collect
              </h2>
              <p>When you register for a couple seminar, we collect the following details:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
                <li><strong>Couple Names:</strong> Husband&apos;s Name, Wife&apos;s Name, and Family Surname for generating personalized digital passes and hall attendance rosters.</li>
                <li><strong>Contact Phone:</strong> 10-digit Mobile Number for booking confirmation, pass delivery, and seminar updates.</li>
                <li><strong>Couple Photograph:</strong> An uploaded photograph used strictly to personalize your official souvenir seminar entry badge.</li>
                <li><strong>Payment Transaction Data:</strong> Gateway order identifiers, payment status, and verification timestamps processed through Razorpay. We do not collect or store card CVVs, PINs, or net banking passwords.</li>
                <li><strong>Seminar Slot:</strong> Selected event date, batch timing, and venue location.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                3. Purpose &amp; Use of Information
              </h2>
              <p>Collected information is used strictly for legitimate event management purposes:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
                <li>Issuing official digital couple passes with encrypted QR entry codes.</li>
                <li>Processing seminar registration fees securely via our payment gateway (Razorpay).</li>
                <li>Managing hall capacity, seating allocation, and check-in desk verification.</li>
                <li>Sending transactional booking receipts, pass download links, and reminder alerts via WhatsApp and SMS.</li>
                <li>Providing customer support and answering event inquiries.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                4. WhatsApp Business Cloud API &amp; Communications
              </h2>
              <p>
                We use the <strong>Meta WhatsApp Business Cloud API</strong> to deliver automated transactional updates. By submitting your registration form:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-stone-600">
                <li>You consent to receive booking receipts, pass download URLs, and seminar reminder notices on WhatsApp.</li>
                <li>We do not send unsolicited commercial spam or share your mobile number with external marketing agencies.</li>
                <li>You may request communication preferences at any time through our support channels.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                5. Data Security &amp; Storage
              </h2>
              <p>
                We implement robust security controls including 256-bit SSL encryption, restricted administrative access, and encrypted cloud storage to protect attendee information from unauthorized access or alteration.
              </p>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                6. Contact &amp; Grievance Redressal
              </h2>
              <p>For any privacy-related questions or data update requests, please contact our administrative desk:</p>
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 text-xs space-y-2.5 text-stone-700">
                <p><strong>Initiative:</strong> {brand} &bull; Led by {speaker}</p>
                <p><strong>Support Helpline:</strong> <a href={`tel:${config.supportPhone}`} className="text-rose-700 font-bold hover:underline">{config.supportPhone}</a></p>
                <p><strong>WhatsApp Support:</strong> <a href={`https://wa.me/${config.supportWhatsapp?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-bold hover:underline">{config.supportWhatsapp} ↗</a></p>
                <p><strong>Official Email:</strong> <a href={`mailto:${config.supportEmail}`} className="text-stone-900 font-bold hover:underline">{config.supportEmail}</a></p>
                <p><strong>Operating City:</strong> {config.defaultCity || 'Surat, Gujarat, India'}</p>
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
