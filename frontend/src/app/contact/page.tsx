'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../config';
import { PhoneIcon, MapPinIcon, MessageSquareIcon, ShieldCheckIcon } from '../../components/Icons';

export default function ContactPage() {
  const [config, setConfig] = useState<{
    brandName?: string;
    supportPhone?: string;
    supportWhatsapp?: string;
    supportEmail?: string;
    defaultCity?: string;
    businessCategory?: string;
    businessDescription?: string;
  }>({
    brandName: 'Ek Duje Ke Liye',
    supportPhone: '+91 92135 32835',
    supportWhatsapp: '+91 92135 32835',
    supportEmail: 'privacy.ekdujekeliye@gmail.com',
    defaultCity: 'Surat, Gujarat',
    businessCategory: 'Education & Training',
    businessDescription: 'Relationship Education, Couple Communication, Life Skills Training and Educational Seminars/Workshops'
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
          }));
        }
      })
      .catch((err) => console.error('Failed to load contact config:', err));
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col justify-between font-sans relative">
      {/* Header */}
      <header className="py-5 px-6 md:px-8 border-b border-stone-200 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-xs">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-9 w-auto object-contain" />
            <div>
              <span className="text-lg font-bold tracking-tight text-stone-900 uppercase block leading-tight">
                {config.brandName || 'Ek Duje Ke Liye'}
              </span>
              <span className="text-[10px] tracking-widest text-rose-700 font-bold uppercase block">
                Educational Seminars by Manish Vaghasiya
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
      <main className="flex-grow max-w-4xl mx-auto px-6 py-12 w-full z-10">
        <div className="bg-white border border-stone-200 rounded-3xl p-8 md:p-12 shadow-xl space-y-8">
          
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold uppercase tracking-wider mb-2">
              Official Help &amp; Support Desk
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-stone-900 tracking-tight">Contact Us</h1>
            <p className="text-xs text-stone-500 mt-2">
              Have questions regarding seminar schedules, couple registration, or pass downloads? Our coordination team is here to assist you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Contact Card 1: Initiative Details */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-rose-600" />
                <span>Initiative Information</span>
              </h2>
              <div className="space-y-2 text-xs text-stone-700">
                <p><strong>Organization:</strong> {config.brandName || 'Ek Duje Ke Liye'}</p>
                <p><strong>Initiative Lead:</strong> Manish Vaghasiya</p>
                <p><strong>Business Category:</strong> {config.businessCategory || 'Education & Training'}</p>
                <p><strong>Description:</strong> {config.businessDescription || 'Relationship Education, Couple Communication, Life Skills Training and Educational Seminars/Workshops'}</p>
                <p><strong>Official Website:</strong> https://ekdujekeliye.in</p>
              </div>
            </div>

            {/* Contact Card 2: Support Channels */}
            <div className="bg-rose-50/60 border border-rose-200/90 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-bold text-rose-900 flex items-center gap-2">
                <PhoneIcon className="w-5 h-5 text-rose-600" />
                <span>Support Helplines</span>
              </h2>
              <div className="space-y-3 text-xs text-stone-700">
                {config.supportPhone && (
                  <div>
                    <span className="block text-stone-500 font-semibold">Phone Helpline:</span>
                    <a href={`tel:${config.supportPhone}`} className="text-sm font-bold text-rose-700 hover:underline">
                      {config.supportPhone}
                    </a>
                  </div>
                )}
                {config.supportWhatsapp && (
                  <div>
                    <span className="block text-stone-500 font-semibold">WhatsApp Assistance:</span>
                    <a
                      href={`https://wa.me/${config.supportWhatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-emerald-700 hover:underline"
                    >
                      {config.supportWhatsapp} ↗
                    </a>
                  </div>
                )}
                <div>
                  <span className="block text-stone-500 font-semibold">Support Email:</span>
                  <a href={`mailto:${config.supportEmail || 'privacy.ekdujekeliye@gmail.com'}`} className="font-bold text-stone-900 hover:underline">
                    {config.supportEmail || 'privacy.ekdujekeliye@gmail.com'}
                  </a>
                </div>
              </div>
            </div>

            {/* Operating Address Card */}
            <div className="md:col-span-2 bg-stone-50 border border-stone-200 rounded-2xl p-6 space-y-2 text-xs text-stone-700">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <MapPinIcon className="w-4 h-4 text-rose-600" />
                <span>Operating Location &amp; Venues</span>
              </h3>
              <p>
                <strong>Headquarters / Operating City:</strong> Surat, Gujarat, India.
              </p>
              <p>
                <strong>Seminar Venues:</strong> Specific auditorium and venue addresses for each seminar batch are clearly printed on your official digital registration pass and booking confirmation receipt.
              </p>
            </div>

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
