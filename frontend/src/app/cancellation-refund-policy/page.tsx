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
              Cancellation, Refund &amp; Transfer Policy
            </h1>
            <p className="text-xs text-stone-500 mt-2 font-medium">
              Official Policy &bull; Domain: www.ekdujekeliye.in &bull; Valid for all Ek Duje Ke Liye Couple Programs
            </p>
          </div>

          {/* Quick Summary Highlights Card */}
          <div className="bg-gradient-to-br from-rose-50 via-amber-50/50 to-stone-50 border-2 border-rose-200/80 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-900 font-extrabold text-sm sm:text-base">
              <AlertTriangleIcon className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>Key Policy Highlights at a Glance (મહત્વપૂર્ણ નિયમો)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="p-3.5 bg-white/90 border border-rose-100 rounded-xl shadow-xs">
                <span className="font-black text-rose-900 block mb-1">❌ 1. No Refund Means No Refund</span>
                <p className="text-stone-700">
                  સેમિનાર ફી 100% નોન-રિફંડેબલ છે. કોઈપણ સંજોગોમાં, ભૂલથી પેમેન્ટ થયું હોય કે ન આવી શકો તો પણ રિફંડ મળશે નહીં.
                </p>
              </div>
              <div className="p-3.5 bg-white/90 border border-amber-200 rounded-xl shadow-xs">
                <span className="font-black text-amber-900 block mb-1">🚫 2. No Transfer to Other Events</span>
                <p className="text-stone-700">
                  ઓર્ગેનાઇઝર્સ દ્વારા તમારી ટિકિટ અન્ય તારીખ કે આગામી કોઈ ઇવેન્ટમાં ટ્રાન્સફર કરી શકાશે નહીં.
                </p>
              </div>
              <div className="p-3.5 bg-white/90 border border-blue-200 rounded-xl shadow-xs">
                <span className="font-black text-blue-900 block mb-1">🤝 3. You May Pass to Another Couple</span>
                <p className="text-stone-700">
                  જો તમે ન આવી શકો તો તમે તમારી જાતે (at your own end) અન્ય કપલને પાસ આપી શકો છો. આ કામ તમારે જાતે કરવાનું રહેશે.
                </p>
              </div>
              <div className="p-3.5 bg-white/90 border border-purple-200 rounded-xl shadow-xs">
                <span className="font-black text-purple-900 block mb-1">🎁 4. Gifts &amp; Photos Are Fixed</span>
                <p className="text-stone-700">
                  પર્સનલાઇઝ્ડ ગિફ્ટ અને ફોટો ફ્રેમ મૂળ કપલના નામથી જ રહેશે. નવા કપલને તેમના નામની નવી ગિફ્ટ કે ફોટો મળશે નહીં.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-7 text-sm text-stone-700 leading-relaxed">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                1. Nature of Registrations &amp; Limited Capacity
              </h2>
              <p>
                <strong>{brand}</strong> is an exclusive, high-demand relationship development program and live interactive workshop for couples led by{' '}
                <strong>{speaker}</strong>. Registration fees collected on <strong>www.ekdujekeliye.in</strong> are dedicated towards reserved auditorium seating, specialized couple engagement kits, customized gift mementos, and operational arrangements. Because seats are strictly limited per batch and logistic commitments are confirmed immediately, all bookings are governed by the strict terms detailed below.
              </p>
            </section>

            {/* Section 2: Strict 100% Non-Refundable Policy */}
            <section className="space-y-3 bg-red-50/60 border border-red-200/90 rounded-2xl p-5 sm:p-6">
              <h2 className="text-base sm:text-lg font-extrabold text-red-900 flex items-center gap-2">
                <AlertTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
                <span>2. 100% Non-Refundable Policy — &ldquo;No Refund Means Strictly No Refund&rdquo;</span>
              </h2>
              <p className="text-stone-900 font-bold text-xs sm:text-sm">
                સેમિનાર રજીસ્ટ્રેશન ફી કોઈપણ સંજોગોમાં રિફંડ થશે નહીં. &ldquo;નો રિફંડ&rdquo; એટલે કોઈ પણ શરતે રકમ પરત મળવાપાત્ર નથી.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-stone-700 text-xs">
                <li>
                  <strong>Absolute Non-Refundability:</strong> Once a registration payment is completed through our payment gateway (Razorpay) or official bank accounts, it is <strong>100% non-refundable</strong>.
                </li>
                <li>
                  <strong>Personal Circumstances &amp; Accidental Payments:</strong> No refunds will be issued for accidental bookings, mistaken payments, personal or family emergencies, medical reasons, travel cancellations, work conflicts, weather conditions, late arrival, or absenteeism.
                </li>
                <li>
                  <strong>Operational Rationale:</strong> Auditorium seats, audio-visual production, personalized gift production, and venue hospitality are pre-funded and committed based on confirmed seats.
                </li>
              </ul>
            </section>

            {/* Section 3: No Transfer to Upcoming or Other Events */}
            <section className="space-y-3 bg-amber-50/70 border border-amber-200/90 rounded-2xl p-5 sm:p-6">
              <h2 className="text-base sm:text-lg font-extrabold text-amber-900 flex items-center gap-2">
                <AlertTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span>3. Strictly No Transfer to Other or Upcoming Events</span>
              </h2>
              <p className="text-stone-900 font-bold text-xs sm:text-sm">
                ઓર્ગેનાઇઝર્સ દ્વારા તમારો પાસ આગામી તારીખ, બીજા શહેર કે ભવિષ્યના કોઈ પણ સેમિનારમાં ટ્રાન્સફર કરવામાં આવશે નહીં.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-stone-700 text-xs">
                <li>
                  <strong>Event-Specific Validity:</strong> Each couple pass is issued exclusively for the specific event date, venue, and time slot selected during checkout.
                </li>
                <li>
                  <strong>No Rescheduling or Carry-Forward by Organizers:</strong> The Ek Duje Ke Liye organization and management team will <strong>NOT</strong> carry forward, postpone, or adjust your pass to any future seminar batch or different city under any request.
                </li>
              </ul>
            </section>

            {/* Section 4: Self-Handover to Another Couple */}
            <section className="space-y-3 bg-stone-50 border border-stone-200/90 rounded-2xl p-5 sm:p-6">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                4. What If You Paid by Mistake or Cannot Attend? (Transfer at Your Own End)
              </h2>
              <p className="text-stone-800 text-xs sm:text-sm">
                જો તમે ભૂલથી પેમેન્ટ કરી દીધું હોય અથવા અણધાર્યા સંજોગોને કારણે સેમિનારમાં ન આવી શકો:
              </p>
              <div className="space-y-2.5 text-xs text-stone-700">
                <div className="p-3 bg-white border border-stone-200 rounded-xl space-y-1">
                  <p className="font-bold text-stone-900">
                    &bull; તમે તમારી જાતે અન્ય કોઈ કપલને પાસ આપી શકો છો (Self-Arranged Transfer):
                  </p>
                  <p>
                    You are permitted to hand over or give your confirmed pass to another couple (such as your relatives, friends, or family members) <strong>entirely at your own initiative and responsibility</strong>.
                  </p>
                </div>
                <div className="p-3 bg-white border border-stone-200 rounded-xl space-y-1">
                  <p className="font-bold text-stone-900">
                    &bull; સંસ્થા તમારા માટે કોઈ કપલ શોધી આપશે નહીં (We Will Not Find or Manage This for You):
                  </p>
                  <p>
                    The Ek Duje Ke Liye team will <strong>NOT</strong> find a replacement couple, will not resell your pass, and will not manage the exchange. Finding another couple to take your pass is strictly your own responsibility at your own end.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 5: Personalized Gifts & Photo Frame Exception */}
            <section className="space-y-3 bg-purple-50/70 border border-purple-200 rounded-2xl p-5 sm:p-6">
              <h2 className="text-base sm:text-lg font-extrabold text-purple-950 flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-purple-700 flex-shrink-0" />
                <span>5. Important Clause: Personalized Gifts &amp; Framed Photos</span>
              </h2>
              <div className="p-3.5 bg-white border border-purple-200/80 rounded-xl space-y-2 text-xs">
                <p className="font-bold text-purple-900 text-xs sm:text-sm">
                  પર્સનલાઇઝ્ડ ગિફ્ટ અને ફોટો ફ્રેમ બાબતે અત્યંત મહત્વપૂર્ણ સ્પષ્ટતા:
                </p>
                <p className="text-stone-700 leading-relaxed">
                  સેમિનારના વેલકમ કીટ્સ, ગિફ્ટ હેમ્પર્સ, મોમેન્ટો અને પ્રિન્ટેડ ફોટો ફ્રેમ્સ રજીસ્ટ્રેશન વખતે આપેલી વિગતો અને ફોટો અનુસાર <strong>મૂળ રજીસ્ટર્ડ કપલના નામથી જ અગાઉથી તૈયાર થઈ જાય છે</strong>.
                </p>
                <p className="text-stone-700 leading-relaxed">
                  તેથી, જો તમે તમારી જગ્યાએ કોઈ અન્ય કપલને તમારો પાસ આપો છો, તો <strong>નવા આવનાર કપલને તેમના નામની નવી પર્સનલાઇઝ્ડ ગિફ્ટ કે ફોટો મળશે નહીં</strong>. પ્રિન્ટ થયેલી ગિફ્ટ અને ફોટો મૂળ રજીસ્ટ્રેશન મુજબના જ રહેશે. સ્થળ પર કોઈ નવું પ્રિન્ટિંગ કે નામ બદલી આપવામાં આવશે નહીં.
                </p>
              </div>
              <ul className="list-disc pl-5 space-y-1.5 text-stone-700 text-xs">
                <li>
                  The replacement couple is welcome to attend the seminar sessions and participate fully in all stage activities using the original entry pass.
                </li>
                <li>
                  Any personalized merchandise, certificates, or photo items will bear the names and photo of the original registrant only.
                </li>
              </ul>
            </section>

            {/* Section 6: Admission Rules */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                6. Admission Guidelines for Passes Handed Over
              </h2>
              <ul className="list-disc pl-5 space-y-1.5 text-stone-600 text-xs">
                <li>Every pass admits exactly one couple (2 adults: husband &amp; wife / engaged / committed couple).</li>
                <li>Children and single attendees are strictly not allowed into the seminar hall under any circumstances.</li>
                <li>The attendee couple must present the original digital pass (PDF / QR code) at the reception desk for verification and entry.</li>
              </ul>
            </section>

            {/* Section 7: Gateway Errors */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                7. Gateway Technical Errors &amp; Duplicate Debits
              </h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                In the rare event that your bank account was debited multiple times for a single registration due to a payment gateway interruption:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-stone-600 text-xs">
                <li>Please send your bank transaction reference (UTR / Razorpay Payment ID) to our support desk.</li>
                <li>Once verified by our payment gateway partner, duplicate redundant debits are automatically refunded back to the original payment source within 5–7 business days.</li>
              </ul>
            </section>

            {/* Section 8: Organizer Rescheduling */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                8. Organizer Rescheduling (Administrative Necessity)
              </h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                In the rare event that an event session must be rescheduled by the organizers due to force majeure, venue changes, or administrative necessity:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-stone-600 text-xs">
                <li>All confirmed couple registrations will automatically be honored on the newly scheduled date at no additional fee.</li>
                <li>Registered attendees will be updated via WhatsApp, SMS, and email with the revised event schedule.</li>
              </ul>
            </section>

            {/* Section 9: Contact Support Desk */}
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                9. Official Support Desk
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

