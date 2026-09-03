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

        const res = await fetch(`${API_BASE_URL}/api/passes/${encodeURIComponent(inquiryId)}`, {
          headers: {
            'Accept': 'application/json'
          }
        });
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

  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [passImageDataUrl, setPassImageDataUrl] = useState<string | null>(null);
  const [showIosModal, setShowIosModal] = useState<boolean>(false);

  /**
   * Render high-resolution 720x1260 Digital Pass Canvas
   */
  const generatePassCanvas = async (data: PassData, qrSrc: string): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');

    const width = 720;
    const height = 1260;
    canvas.width = width;
    canvas.height = height;

    // 1. Overall Background
    ctx.fillStyle = '#FAF9F6';
    ctx.fillRect(0, 0, width, height);

    // Helper: Rounded Rectangle
    const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    // 2. Outer Card with Rounded Corners
    const cardX = 30;
    const cardY = 30;
    const cardW = width - 60;
    const cardH = height - 60;
    const cardRadius = 32;

    ctx.save();
    drawRoundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.clip();

    // Fill Card Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // 3. Header Gradient
    const headerH = 220;
    const headerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + headerH);
    headerGrad.addColorStop(0, '#9f1239'); // rose-700
    headerGrad.addColorStop(0.5, '#be123c'); // rose-600
    headerGrad.addColorStop(1, '#b45309'); // amber-700
    ctx.fillStyle = headerGrad;
    ctx.fillRect(cardX, cardY, cardW, headerH);

    // Top Subtitle
    ctx.fillStyle = '#fecdd3';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OFFICIAL GATE ENTRY PASS', width / 2, 75);

    // Main Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('EK DUJE KE LIYE', width / 2, 118);

    // Tagline
    ctx.fillStyle = '#ffe4e6';
    ctx.font = '500 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('A Special Program for Couples', width / 2, 146);

    // Status Pill: ENTRY APPROVED
    const pillW = 210;
    const pillH = 34;
    const pillX = (width - pillW) / 2;
    const pillY = 170;
    ctx.fillStyle = '#10b981';
    drawRoundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('✓  ENTRY APPROVED', width / 2, pillY + 22);

    ctx.restore(); // Restore from card clip

    // Card border
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    drawRoundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.stroke();

    // 4. Hero Registration Number Box
    const regX = 60;
    const regY = 275;
    const regW = width - 120;
    const regH = 125;
    ctx.fillStyle = '#fffbeb'; // amber-50
    drawRoundRect(regX, regY, regW, regH, 20);
    ctx.fill();
    ctx.strokeStyle = '#fcd34d'; // amber-300
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#78350f'; // amber-900
    ctx.font = '900 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('REGISTRATION NUMBER', width / 2, regY + 30);

    ctx.fillStyle = '#451a03'; // amber-950
    ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(data.inquiryId, width / 2, regY + 82);

    ctx.fillStyle = '#92400e';
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Please present this number or QR code at entry', width / 2, regY + 108);

    // 5. Couple Details Row
    const coupleBoxY = 420;
    const coupleBoxH = 95;
    ctx.fillStyle = '#fafaf9'; // stone-50
    drawRoundRect(regX, coupleBoxY, regW, coupleBoxH, 18);
    ctx.fill();
    ctx.strokeStyle = '#e7e5e4';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Try loading couple photo safely without tainting canvas
    let coupleImgLoaded = false;
    if (data.couplePhoto) {
      try {
        const photoPath = data.couplePhoto;
        const cImg = new Image();
        cImg.crossOrigin = 'anonymous';
        await new Promise<void>((res) => {
          cImg.onload = () => {
            const photoX = regX + 15;
            const photoY = coupleBoxY + 12;
            const photoSize = 71;
            ctx.save();
            drawRoundRect(photoX, photoY, photoSize, photoSize, 14);
            ctx.clip();
            ctx.drawImage(cImg, photoX, photoY, photoSize, photoSize);
            ctx.restore();
            ctx.strokeStyle = '#d6d3d1';
            ctx.lineWidth = 1;
            drawRoundRect(photoX, photoY, photoSize, photoSize, 14);
            ctx.stroke();
            coupleImgLoaded = true;
            res();
          };
          cImg.onerror = () => res(); // Never fail the pass generation
          cImg.src = photoPath.startsWith('data:') || photoPath.startsWith('http')
            ? photoPath
            : `${API_BASE_URL}${photoPath.startsWith('/') ? photoPath : `/${photoPath}`}`;
        });
      } catch (_) {}
    }

    if (!coupleImgLoaded) {
      const photoX = regX + 15;
      const photoY = coupleBoxY + 12;
      const photoSize = 71;
      ctx.fillStyle = '#ffe4e6';
      drawRoundRect(photoX, photoY, photoSize, photoSize, 14);
      ctx.fill();
      ctx.fillStyle = '#be123c';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EDKL', photoX + photoSize / 2, photoY + 44);
    }

    // Couple Name
    ctx.textAlign = 'left';
    ctx.fillStyle = '#be123c';
    ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('ADMIT COUPLE', regX + 105, coupleBoxY + 38);

    ctx.fillStyle = '#1c1917';
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const coupleText = data.coupleName.length > 28 ? data.coupleName.substring(0, 27) + '…' : data.coupleName;
    ctx.fillText(coupleText, regX + 105, coupleBoxY + 70);

    // 6. Seminar Details Box
    const evBoxY = 535;
    const evBoxH = 135;
    ctx.fillStyle = '#fafaf9';
    drawRoundRect(regX, evBoxY, regW, evBoxH, 18);
    ctx.fill();
    ctx.strokeStyle = '#e7e5e4';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#1c1917';
    ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const progText = data.programName.length > 38 ? data.programName.substring(0, 37) + '…' : data.programName;
    ctx.fillText(progText, regX + 22, evBoxY + 36);

    ctx.fillStyle = '#44403c';
    ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`📅  ${data.programDate}    •    ⏰  ${data.programTime}`, regX + 22, evBoxY + 74);

    ctx.fillStyle = '#57534e';
    ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const venueText = data.venue.length > 44 ? data.venue.substring(0, 43) + '…' : data.venue;
    ctx.fillText(`📍  ${venueText}`, regX + 22, evBoxY + 110);

    // 7. QR Code Box
    const qrBoxW = 400;
    const qrBoxH = 370;
    const qrBoxX = (width - qrBoxW) / 2;
    const qrBoxY = 690;
    ctx.fillStyle = '#FFFFFF';
    drawRoundRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw QR Code
    if (qrSrc) {
      const qrImg = new Image();
      await new Promise<void>((res) => {
        qrImg.onload = () => {
          const qrSize = 280;
          const qrImgX = (width - qrSize) / 2;
          const qrImgY = qrBoxY + 25;
          ctx.drawImage(qrImg, qrImgX, qrImgY, qrSize, qrSize);
          res();
        };
        qrImg.onerror = () => res();
        qrImg.src = qrSrc;
      });
    }

    ctx.fillStyle = '#78716c';
    ctx.font = '800 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCAN AT GATE ENTRANCE', width / 2, qrBoxY + 340);

    // 8. Security & Info Footer
    ctx.fillStyle = '#78716c';
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Pass Security ID: ${data.passId}`, width / 2, 1095);

    ctx.fillStyle = '#a8a29e';
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Valid for admission of registered couple only • Please keep screen brightness high', width / 2, 1125);

    ctx.fillStyle = '#d6d3d1';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('© 2026 Ek Duje Ke Liye • All Rights Reserved', width / 2, 1152);

    return canvas;
  };

  /**
   * Helper to trigger direct browser file download
   */
  const triggerDirectDownload = (url: string) => {
    if (!pass) return;
    const link = document.createElement('a');
    link.download = `EDKL_Pass_${pass.inquiryId}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Seamless Download & Save to Gallery (Optimized for iPhone / iOS Photos & Android/Desktop)
   */
  const handleDownloadPass = async () => {
    if (!pass || !qrDataUrl) return;
    setDownloading(true);
    setDownloadSuccess(false);

    try {
      const canvas = await generatePassCanvas(pass, qrDataUrl);
      const dataUrl = canvas.toDataURL('image/png');
      setPassImageDataUrl(dataUrl);

      const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent || '');

      canvas.toBlob(async (blob) => {
        if (!blob) {
          triggerDirectDownload(dataUrl);
          setDownloading(false);
          return;
        }

        const fileName = `EDKL_Pass_${pass.inquiryId}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        // 1. Native Web Share API (Highest quality for iOS / iPhone Photos & Camera Roll)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'Ek Duje Ke Liye Gate Pass',
              text: `Official Gate Pass for ${pass.coupleName} (${pass.inquiryId})`
            });
            setDownloadSuccess(true);
            setDownloading(false);
            return;
          } catch (shareErr: any) {
            if (shareErr.name === 'AbortError') {
              // User dismissed sheet
              setDownloading(false);
              return;
            }
          }
        }

        // 2. iOS fallback: Show dedicated preview sheet to press & hold "Save to Photos"
        if (isIos) {
          setShowIosModal(true);
          setDownloading(false);
          return;
        }

        // 3. Android / Desktop fallback: Instant direct PNG download into Gallery/Downloads
        triggerDirectDownload(dataUrl);
        setDownloadSuccess(true);
        setDownloading(false);
      }, 'image/png');
    } catch (err: any) {
      console.error('Download pass error:', err);
      setDownloading(false);
    }
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
        <div className="bg-stone-50 p-4 border-t border-stone-200 flex flex-col gap-2.5 print:hidden">
          {/* Main Download Pass Button */}
          <button
            type="button"
            onClick={handleDownloadPass}
            disabled={downloading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-rose-600 via-rose-700 to-amber-700 hover:from-rose-700 hover:to-amber-800 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-600/25 active:scale-[0.98] cursor-pointer disabled:opacity-75"
          >
            {downloading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Preparing Pass Image...</span>
              </>
            ) : (
              <>
                <DownloadIcon className="w-4.5 h-4.5 text-amber-200" />
                <span>Download Pass (Save to Gallery)</span>
              </>
            )}
          </button>

          {downloadSuccess && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 py-2 px-3 rounded-xl animate-in fade-in duration-200">
              <CheckCircleIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Pass saved! Check your Photos / Downloads.</span>
            </div>
          )}

          {/* Personalized Invitation Secondary Button */}
          <button
            type="button"
            onClick={handleDownloadInvitation}
            className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <SparklesIcon className="w-4 h-4 text-rose-600" />
            <span>Personalized Couple Photo Invitation</span>
            <DownloadIcon className="w-3.5 h-3.5 text-rose-500" />
          </button>
        </div>

      </div>

      {/* iOS iPhone Save to Photos Modal */}
      {showIosModal && passImageDataUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 flex flex-col items-center text-center shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center font-bold text-sm hover:bg-stone-200 cursor-pointer"
            >
              ✕
            </button>

            <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <DownloadIcon className="w-5 h-5" />
            </div>

            <h3 className="text-base font-bold text-stone-900">Save Pass to iPhone Photos</h3>
            <p className="text-xs text-stone-600 mt-1 mb-4 leading-relaxed">
              <strong>Press and hold</strong> the pass image below, then tap <span className="font-bold text-rose-700">"Save to Photos"</span> to keep it directly in your camera roll gallery.
            </p>

            <div className="w-full max-h-[52vh] overflow-y-auto rounded-2xl border border-stone-200 bg-stone-50 p-2 mb-4">
              <img
                src={passImageDataUrl}
                alt="Digital Pass"
                className="w-full rounded-xl shadow-xs pointer-events-auto select-auto"
                style={{ WebkitTouchCallout: 'default' } as React.CSSProperties}
              />
            </div>

            <div className="w-full flex gap-2">
              <button
                type="button"
                onClick={() => triggerDirectDownload(passImageDataUrl)}
                className="flex-1 py-2.5 px-3 bg-stone-900 text-white rounded-xl font-bold text-xs hover:bg-stone-800 cursor-pointer"
              >
                Download File
              </button>
              <button
                type="button"
                onClick={() => setShowIosModal(false)}
                className="py-2.5 px-4 bg-stone-100 text-stone-700 rounded-xl font-bold text-xs hover:bg-stone-200 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brand Watermark */}
      <div className="mt-4 text-center text-xs text-stone-500 font-medium print:hidden">
        &copy; {new Date().getFullYear()} Ek Duje Ke Liye &bull; All Rights Reserved
      </div>
    </div>
  );
}
