import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Ek Duje Ke Liye - Educational Seminars',
  description: 'Privacy Policy and Data Protection guidelines for Ek Duje Ke Liye educational relationship seminar and workshop registration platform led by Manish Vaghasiya.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a050d] via-[#0c0306] to-[#080205] text-slate-100 flex flex-col justify-between font-sans relative">
      {/* Header */}
      <header className="py-6 px-8 border-b border-rose-950/40 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-10 w-auto object-contain" />
            <div>
              <span className="text-xl font-bold tracking-wider text-slate-100 uppercase block leading-tight">Ek Duje Ke Liye</span>
              <span className="text-[10px] tracking-widest text-rose-400 font-bold uppercase block">Educational Seminars by Manish Vaghasiya</span>
            </div>
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
            <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block mb-2">Legal &amp; Compliance</span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-100 tracking-tight">Privacy Policy</h1>
            <p className="text-xs text-slate-400 mt-2">Last Updated: August 28, 2026 &bull; Domain: www.ekdujekeliye.in</p>
          </div>

          <div className="space-y-6 text-sm text-slate-300 leading-relaxed">

            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">1. Introduction &amp; Operating Context</h2>
              <p>
                Welcome to <strong>Ek Duje Ke Liye</strong> (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). <strong>Ek Duje Ke Liye</strong> is an educational seminar and workshop initiative led by <strong>Manish Vaghasiya</strong>. We provide educational relationship seminars, couple communication workshops, and practical life-skills training programs on our website (<strong>ekdujekeliye.in</strong>).
              </p>
              <p>
                We respect your privacy and are committed to protecting the personal information you share with us when registering for our educational seminars, workshops, and digital pass services. This Privacy Policy describes how we collect, use, store, process, and safeguard your data.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">2. Information We Collect</h2>
              <p>When you register for an educational seminar or workshop on our platform, we collect the following information:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li><strong>Couple Names:</strong> Husband&apos;s Name, Wife&apos;s Name, and Surname to personalize your seminar entry pass and attendance record.</li>
                <li><strong>Contact Information:</strong> 10-digit Mobile Phone Number for booking confirmation, digital pass delivery, and seminar schedule reminders.</li>
                <li><strong>Couple Photograph:</strong> A couple photograph uploaded by you for generating your customized souvenir seminar entry badge.</li>
                <li><strong>Payment Transaction Data:</strong> Transaction identifiers, payment gateway order references, and status codes for verifying seminar fee payments. We do not store sensitive credit card numbers, CVVs, or bank account PINs.</li>
                <li><strong>Seminar Slot Selection:</strong> Chosen date, city, venue, and program batch details.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">3. How We Use Your Information</h2>
              <p>We use the collected information exclusively for legitimate educational seminar operations:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li>To generate and issue your personalized educational seminar admission pass and digital entry token.</li>
                <li>To verify seminar registration and process registration fees securely via our authorized payment processor (Razorpay).</li>
                <li>To manage seminar hall capacity, seating arrangements, educational materials, and attendee check-in.</li>
                <li>To send transactional notifications, pass download links, and critical schedule updates via WhatsApp and SMS.</li>
                <li>To provide attendee support and respond to inquiry requests.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">4. WhatsApp Cloud API &amp; Communications</h2>
              <p>
                We use the <strong>Meta WhatsApp Business Cloud API</strong> to deliver automated service messages. By submitting your registration form and providing your mobile number:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li>You consent to receive transactional notifications regarding your seminar registration status, digital pass delivery, and event reminders.</li>
                <li>We do not send unsolicited promotional spam, nor do we sell or share your phone number with unaffiliated marketing agencies.</li>
                <li>You may opt out of non-essential communications at any time by contacting our support team.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">5. Storage &amp; Data Security</h2>
              <p>
                We employ industry-standard technical and organizational security measures to protect your personal data:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li><strong>Cloud Storage:</strong> Photographs uploaded to our platform are stored on secured cloud media servers (Cloudinary) with encrypted transmission (HTTPS / SSL).</li>
                <li><strong>Database Protection:</strong> Registration records are stored in secure, access-controlled MongoDB Atlas cloud databases.</li>
                <li><strong>Access Control:</strong> Only authorized seminar coordinators have access to attendee details for verification and badge issuance.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">6. Third-Party Service Providers</h2>
              <p>
                We share data with trusted third-party technology providers strictly to fulfill the seminar registration, communication, and payment process:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li><strong>Razorpay:</strong> Payment gateway for secure, 256-bit encrypted processing of seminar registration fees.</li>
                <li><strong>Meta Platforms, Inc. (WhatsApp Business Cloud API):</strong> For message delivery and digital pass notifications.</li>
                <li><strong>Cloudinary:</strong> For secure image processing and pass asset hosting.</li>
                <li><strong>MongoDB Atlas / Cloud Hosting:</strong> For website hosting and encrypted database management.</li>
              </ul>
              <p>We do not sell, rent, or trade your personal information to any third party for commercial marketing purposes.</p>
            </section>

            {/* Section 7 - Data Deletion Instructions */}
            <section id="data-deletion" className="space-y-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-rose-400">7. User Data Deletion Instructions</h2>
              <p>
                In compliance with international data protection standards, you have the right to request the deletion of your personal data at any time.
              </p>
              <p className="font-semibold text-slate-200">How to request data deletion:</p>
              <ol className="list-decimal pl-5 space-y-1 text-slate-300">
                <li>Send an email to <strong>privacy.ekdujekeliye@gmail.com</strong> or message our support team with the subject line <em>&quot;Data Deletion Request&quot;</em>.</li>
                <li>Include your <strong>Inquiry ID</strong> (e.g., <code>EK01-01</code>) and registered <strong>Phone Number</strong>.</li>
                <li>Our team will verify your identity and permanently delete your registration records, uploaded photos, and pass data from our active databases and cloud storage within 7 business days.</li>
                <li>A confirmation notification will be sent once your data has been completely purged.</li>
              </ol>
            </section>

            {/* Section 8 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">8. Children&apos;s Privacy</h2>
              <p>
                Our educational seminars are intended exclusively for married couples and adult attendees. We do not knowingly collect or solicit personal information from individuals under the age of 18.
              </p>
            </section>

            {/* Section 9 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">9. Contact Us &amp; Grievance Redressal</h2>
              <p>If you have any questions, concerns, or requests regarding this Privacy Policy or our data handling practices, please contact us at:</p>
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs space-y-1">
                <p><strong>Organization:</strong> Ek Duje Ke Liye — Educational Seminars led by Manish Vaghasiya</p>
                <p><strong>Email:</strong> privacy.ekdujekeliye@gmail.com</p>
                <p><strong>Website:</strong> https://ekdujekeliye.in</p>
                <p><strong>WhatsApp Support:</strong> +91 82003 02328</p>
                <p><strong>Location:</strong> Surat, Gujarat, India</p>
              </div>
            </section>

          </div>

          <div className="pt-6 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
            <Link href="/" className="hover:text-rose-400 transition-colors">
              ← Return to Seminar Home
            </Link>
            <Link href="/terms" className="hover:text-rose-400 transition-colors">
              Terms &amp; Conditions →
            </Link>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-8 border-t border-slate-800/80 bg-slate-950/40 text-center text-xs text-slate-500 space-y-2">
        <div>
          &copy; {new Date().getFullYear()} Ek Duje Ke Liye &bull; Educational Seminars by Manish Vaghasiya. All rights reserved.
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-[11px]">
          <Link href="/privacy-policy" className="text-slate-400 hover:underline">Privacy Policy</Link>
          <span>&bull;</span>
          <Link href="/terms" className="text-slate-400 hover:underline">Terms &amp; Conditions</Link>
          <span>&bull;</span>
          <Link href="/cancellation-refund-policy" className="text-slate-400 hover:underline">Refund Policy</Link>
          <span>&bull;</span>
          <Link href="/shipping-delivery-policy" className="text-slate-400 hover:underline">Delivery Policy</Link>
          <span>&bull;</span>
          <Link href="/contact" className="text-slate-400 hover:underline">Contact Us</Link>
        </div>
      </footer>
    </div>
  );
}
