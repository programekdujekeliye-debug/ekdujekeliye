import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Ek Duje Ke Liye',
  description: 'Privacy Policy and Data Protection guidelines for Ek Duje Ke Liye event registration and pass generation platform.',
};

export default function PrivacyPolicyPage() {
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
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-100 tracking-tight">Privacy Policy</h1>
            <p className="text-xs text-slate-400 mt-2">Last Updated: August 27, 2026</p>
          </div>

          <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
            
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">1. Introduction</h2>
              <p>
                Welcome to <strong>Ek Duje Ke Liye</strong> (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We respect your privacy and are committed to protecting the personal information you share with us when registering for our events, programs, and invitation pass generation services on our website (<strong>ekdujekeliye.in</strong>).
              </p>
              <p>
                This Privacy Policy describes how we collect, use, store, process, and safeguard your data, and how you can exercise your privacy rights under applicable data protection laws.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">2. Information We Collect</h2>
              <p>When you register for an event or interact with our platform, we may collect the following personal information:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li><strong>Couple Names:</strong> Husband&apos;s Name, Wife&apos;s Name, and Surname to personalize your event pass.</li>
                <li><strong>Contact Information:</strong> 10-digit Mobile Phone Number for booking confirmation, pass delivery, and event reminders.</li>
                <li><strong>Couple Photograph:</strong> A photograph uploaded by you for generating your customized souvenir entry pass.</li>
                <li><strong>Payment Transaction Data:</strong> Transaction references, screenshot receipts, or payment gateway order identifiers for verifying registration fees. We do not store sensitive credit card or bank account PINs.</li>
                <li><strong>Event Slot Selection:</strong> Chosen date, time, and program batch details.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">3. How We Use Your Information</h2>
              <p>We use the collected information exclusively for the following purposes:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li>To generate and issue your personalized event invitation pass and entry token.</li>
                <li>To verify event registration and process payments.</li>
                <li>To manage program capacity, seating arrangements, and attendee check-in.</li>
                <li>To send transactional event notifications, pass download links, and critical schedule updates via WhatsApp and SMS.</li>
                <li>To provide customer support and respond to inquiry requests.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">4. WhatsApp Cloud API &amp; Communications</h2>
              <p>
                We use the <strong>Meta WhatsApp Business Cloud API</strong> to deliver automated service messages. By submitting your registration form and providing your mobile number:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li>You consent to receive transactional notifications regarding your registration status, pass delivery, and event reminders.</li>
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
                <li><strong>Access Control:</strong> Only authorized event administrators have access to attendee details for verification and badge printing purposes.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">6. Third-Party Service Providers</h2>
              <p>
                We may share your data with trusted third-party technology providers strictly to fulfill the registration and communication process:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li><strong>Meta Platforms, Inc. (WhatsApp Business Cloud API):</strong> For message delivery and pass notifications.</li>
                <li><strong>Cloudinary:</strong> For secure image processing and pass asset hosting.</li>
                <li><strong>Payment Processors:</strong> For secure, encrypted transaction processing.</li>
                <li><strong>MongoDB Atlas / Cloud Hosting (Vercel &amp; Render):</strong> For website hosting and database management.</li>
              </ul>
              <p>We do not sell, rent, or trade your personal information to any third party for commercial marketing purposes.</p>
            </section>

            {/* Section 7 - Data Deletion Instructions */}
            <section id="data-deletion" className="space-y-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-rose-400">7. User Data Deletion Instructions</h2>
              <p>
                In compliance with Facebook/Meta Platform Data Policy and international data protection standards, you have the right to request the deletion of your personal data at any time.
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
                Our services are intended for married couples and adult attendees. We do not knowingly collect or solicit personal information from individuals under the age of 18.
              </p>
            </section>

            {/* Section 9 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-rose-300">9. Contact Us &amp; Grievance Officer</h2>
              <p>If you have any questions, concerns, or requests regarding this Privacy Policy or our data handling practices, please contact us at:</p>
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs space-y-1">
                <p><strong>Organization:</strong> Ek Duje Ke Liye Event Team</p>
                <p><strong>Email:</strong> privacy.ekdujekeliye@gmail.com</p>
                <p><strong>Website:</strong> https://ekdujekeliye.in</p>
                <p><strong>WhatsApp Support:</strong> +91 92135 32835</p>
              </div>
            </section>

          </div>

          <div className="pt-6 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
            <Link href="/" className="hover:text-rose-400 transition-colors">
              ← Return to Event Registration
            </Link>
            <Link href="/terms" className="hover:text-rose-400 transition-colors">
              Terms &amp; Conditions →
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
