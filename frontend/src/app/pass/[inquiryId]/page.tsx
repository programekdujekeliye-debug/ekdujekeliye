'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import { API_BASE_URL } from '../../../config';
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  HourglassIcon,
  PrinterIcon,
  DownloadIcon,
  SparklesIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon
} from '../../../components/Icons';

interface PassData {
  passId: string;
  qrToken: string;
  inquiryId: string;
  coupleName: string;
  couplePhoto?: string;
  photoThumbnailUrl?: string;
  status: string;
  programName: string;
  programDate: string;
  programTime: string;
  venue: string;
  venueAddress?: string;
  issuedAt?: string;
}

export default function DigitalPassPage() {
  const params = useParams();
  const rawInquiryId = (params?.inquiryId as string) || '';
  const inquiryId = decodeURIComponent(rawInquiryId).toUpperCase();

  const [pass, setPass] = useState<PassData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!inquiryId) return;

    async function loadPass() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE_URL}/api/passes/${encodeURIComponent(inquiryId)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Unable to load digital entry pass.');
        }

        setPass(data);

        // Generate high-resolution, high-contrast QR Code data URL
        if (data.qrToken) {
          const url = await QRCode.toDataURL(data.qrToken, {
            width: 480,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff'
            },
            errorCorrectionLevel: 'M'
          });
          setQrDataUrl(url);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load pass.');
      } finally {
        setLoading(false);
      }
    }

    loadPass();
  }, [inquiryId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadInvitation = () => {
    if (!inquiryId) return;
    window.location.href = `/invitation/${encodeURIComponent(inquiryId)}`;
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-4 text-stone-900">
        <div className="w-10 h-10 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-stone-700">Loading your Digital Entry Pass...</p>
      </div>
    );
  }

  if (error || !pass) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-4 text-stone-900">
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangleIcon className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Pass Not Available</h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            {error || 'The requested digital pass could not be found or payment verification is still pending.'}
          </p>
          <div className="pt-2">
            <a
              href="/"
              className="inline-block px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20"
            >
              Return to Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex flex-col items-center justify-center p-3 sm:p-6 select-none print:bg-white print:text-black">

      {/* Mobile-First Digital Pass Card */}
      <div className="w-full max-w-sm bg-white text-stone-900 rounded-3xl shadow-2xl overflow-hidden border border-stone-200/90 flex flex-col print:shadow-none print:border-stone-400">

        {/* Pass Header Banner */}
        <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-700 text-white p-5 text-center relative">
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-rose-200 mb-1">
            <ShieldCheckIcon className="w-3.5 h-3.5" />
            <span>Official Gate Entry Pass</span>
          </div>
          <h1 className="text-lg font-black tracking-tight leading-tight">EK DUJE KE LIYE</h1>
          <p className="text-xs text-rose-100 font-medium mt-0.5">A Special Program for Couples</p>

          {/* Top Status & Registration Number Banner */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="inline-flex items-center gap-1 bg-emerald-500 text-white px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wide uppercase shadow-xs">
              <CheckCircleIcon className="w-3.5 h-3.5" />
              <span>ENTRY APPROVED</span>
            </div>
          </div>
        </div>

        {/* Pass Body */}
        <div className="p-5 sm:p-6 flex flex-col items-center text-center space-y-4">

          {/* HUGE HERO REGISTRATION NUMBER BOX */}
          <div className="w-full bg-amber-50 border-2 border-amber-300 rounded-2xl p-3.5 text-center shadow-xs">
            <span className="text-[11px] font-black text-amber-900 uppercase tracking-widest block">
              REGISTRATION NUMBER
            </span>
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-amber-950 my-0.5">
              {pass.inquiryId}
            </div>
            <span className="text-[10px] text-amber-800/80 font-semibold block">
              Please present this number or QR code at entry
            </span>
          </div>

          {/* Couple Info with Compact Thumbnail */}
          <div className="flex items-center gap-3 bg-stone-50 border border-stone-200/80 rounded-2xl p-3 w-full text-left">
            {pass.couplePhoto ? (
              <img
                src={pass.couplePhoto}
                alt="Couple"
                className="w-12 h-12 rounded-xl object-cover border border-stone-300 flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 font-bold flex items-center justify-center flex-shrink-0 text-sm">
                EDKL
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider block">
                Admit Couple
              </span>
              <h2 className="text-sm font-bold text-stone-900 truncate">
                {pass.coupleName}
              </h2>
            </div>
          </div>

          {/* Event Details Box */}
          <div className="w-full bg-stone-50/70 border border-stone-200/60 rounded-2xl p-3 text-left space-y-1.5 text-xs text-stone-700">
            <div className="font-bold text-stone-900 text-xs leading-snug">
              {pass.programName}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-stone-600">
              <CalendarIcon className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
              <span>{pass.programDate}</span>
              <span className="text-stone-300">&bull;</span>
              <ClockIcon className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
              <span>{pass.programTime}</span>
            </div>
            <div className="flex items-start gap-1.5 text-[11px] text-stone-600">
              <MapPinIcon className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
              <span className="leading-tight">{pass.venue}</span>
            </div>
          </div>

          {/* Large, Reliable Gate QR Code */}
          <div className="bg-white p-3.5 rounded-2xl border-2 border-stone-900/10 shadow-sm flex flex-col items-center w-full">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Entry QR Code"
                className="w-56 h-56 sm:w-60 sm:h-60 object-contain mx-auto"
              />
            ) : (
              <div className="w-56 h-56 bg-stone-100 flex items-center justify-center text-xs text-stone-400 mx-auto">
                Generating QR...
              </div>
            )}
            <span className="text-[10px] font-bold text-stone-500 mt-2 uppercase tracking-wider">
              Scan at Gate Entrance
            </span>
          </div>

          {/* Discreet Staff Manual Fallback Box */}
          <div className="w-full bg-stone-100 border border-stone-200 rounded-xl p-2.5 text-center text-stone-600">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-stone-500 font-medium">Pass Security ID:</span>
              <span className="font-bold text-stone-800">{pass.passId}</span>
            </div>
            <span className="text-[9px] text-stone-400 block mt-0.5 font-medium">
              (For gate coordinator use only if camera scanner fails)
            </span>
          </div>

          {/* Security Notice */}
          <p className="text-[10px] text-stone-500 leading-tight text-center">
            Please keep your screen brightness high when presenting this pass at the gate. Valid for admission of registered couple only.
          </p>
        </div>

        {/* Action Footer */}
        <div className="bg-stone-50 p-4 border-t border-stone-200 flex flex-col gap-2 print:hidden">
          <button
            type="button"
            onClick={handleDownloadInvitation}
            className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <SparklesIcon className="w-4 h-4 text-rose-600" />
            <span>Download Personalized Photo Invitation</span>
            <DownloadIcon className="w-3.5 h-3.5 text-rose-500" />
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="w-full py-2.5 px-4 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <PrinterIcon className="w-4 h-4 text-stone-600" />
            <span>Print Entry Pass</span>
          </button>
        </div>

      </div>

      {/* Brand Watermark */}
      <div className="mt-4 text-center text-xs text-stone-500 font-medium print:hidden">
        &copy; {new Date().getFullYear()} Ek Duje Ke Liye &bull; All Rights Reserved
      </div>
    </div>
  );
}
