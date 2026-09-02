'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL } from '../../../config';
import {
  DownloadIcon,
  SparklesIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  QrCodeIcon,
  AlertTriangleIcon,
  Share2Icon,
  CheckCircleIcon
} from '../../../components/Icons';

interface SubmissionData {
  _id?: string;
  inquiryId: string;
  husbandName?: string;
  wifeName?: string;
  surname?: string;
  coupleName?: string;
  couplePhoto?: string;
  photoThumbnailUrl?: string;
  status: string;
  programId?: string;
  programName?: string;
  programDate?: string;
  programTime?: string;
  venue?: string;
  cardTemplate?: string;
  cardTemplateUrl?: string;
  heartX?: number;
  heartY?: number;
  heartWidth?: number;
  heartHeight?: number;
  photoZoom?: number;
  photoOffsetY?: number;
  program?: {
    name?: string;
    date?: string;
    time?: string;
    venue?: string;
    cardTemplate?: string;
    cardTemplateUrl?: string;
    heartX?: number;
    heartY?: number;
    heartWidth?: number;
    heartHeight?: number;
  };
}

export default function PersonalizedInvitationPage() {
  const params = useParams();
  const rawInquiryId = (params?.inquiryId as string) || '';
  const inquiryId = decodeURIComponent(rawInquiryId).toUpperCase();

  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Canvas States
  const [cardReady, setCardReady] = useState(false);
  const [canvasDataUrl, setCanvasDataUrl] = useState<string>('');
  const [useCanvasDirectly, setUseCanvasDirectly] = useState(false);
  const [userZoom, setUserZoom] = useState<number>(1.0);
  const [userOffsetY, setUserOffsetY] = useState<number>(0);
  const [savingAdjustments, setSavingAdjustments] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    setCanvasElement(node);
  }, []);

  useEffect(() => {
    if (!inquiryId) return;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch registration details
        const res = await fetch(`${API_BASE_URL}/api/submissions/status/${encodeURIComponent(inquiryId)}`);
        const data = await res.json();

        if (!res.ok || !data) {
          throw new Error(data.error || 'Registration not found.');
        }

        setSubmission(data);
        if (data.photoZoom) setUserZoom(data.photoZoom);
        if (data.photoOffsetY !== undefined) setUserOffsetY(data.photoOffsetY);
      } catch (err: any) {
        setError(err.message || 'Failed to load invitation card data.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [inquiryId]);

  // Draw Gold CPL Number on Card
  const drawTextDetails = (ctx: CanvasRenderingContext2D, sub: SubmissionData) => {
    ctx.save();
    const hX = sub.program?.heartX ?? sub.heartX ?? 157;
    const hY = sub.program?.heartY ?? sub.heartY ?? 91;
    const hW = sub.program?.heartWidth ?? sub.heartWidth ?? 260;

    const textX = hX + hW / 2;
    const textY = Math.max(32, hY - 18);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Dark outline for contrast
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.font = 'bold 30px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
    ctx.strokeText(sub.inquiryId, textX, textY);

    // Gold text fill
    ctx.fillStyle = '#D4AF37';
    ctx.fillText(sub.inquiryId, textX, textY);
    ctx.restore();
  };

  // Draw Full Invitation Card Canvas
  const drawCard = useCallback((sub: SubmissionData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 576;
    canvas.height = 1024;

    const templateImg = new Image();
    const templatePath = sub.program?.cardTemplateUrl || sub.program?.cardTemplate || sub.cardTemplate || (sub as any)?.cardTemplateUrl || '/card_template.png';
    let templateImgSrc = templatePath.startsWith('data:') || templatePath.startsWith('http')
      ? templatePath
      : templatePath.startsWith('/')
        ? templatePath
        : `${API_BASE_URL}${templatePath}`;

    if (templateImgSrc.startsWith('http')) {
      templateImg.crossOrigin = 'anonymous';
      if (templateImgSrc.includes('cloudinary.com') && !templateImgSrc.includes('cors=')) {
        templateImgSrc += (templateImgSrc.includes('?') ? '&' : '?') + 'cors=1';
      }
    }

    let templateRetried = false;
    templateImg.onerror = () => {
      if (!templateRetried && templateImgSrc.startsWith('http')) {
        templateRetried = true;
        templateImg.removeAttribute('crossOrigin');
        templateImg.src = templateImgSrc + (templateImgSrc.includes('?') ? '&' : '?') + 'nocache=' + Date.now();
      } else if (templateImgSrc !== '/card_template.png') {
        templateImg.src = '/card_template.png';
      }
    };

    templateImg.onload = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      tempCtx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);

      const hX = sub.program?.heartX ?? sub.heartX ?? 157;
      const hY = sub.program?.heartY ?? sub.heartY ?? 91;
      const hW = sub.program?.heartWidth ?? sub.heartWidth ?? 260;
      const hH = sub.program?.heartHeight ?? sub.heartHeight ?? 312;

      // Transparent heart cutout
      try {
        const imgData = tempCtx.getImageData(hX, hY, hW, hH);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r > 220 && g > 220 && b > 220) {
            data[i + 3] = 0;
          }
        }
        tempCtx.putImageData(imgData, hX, hY);
      } catch (e) {
        console.warn('Transparency fallback:', e);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const coupleImg = new Image();
      const photoPath = sub.couplePhoto || '/sample_couple.png';
      const coupleImgSrc = photoPath.startsWith('data:') || photoPath.startsWith('http')
        ? photoPath
        : photoPath.startsWith('/')
          ? photoPath
          : `${API_BASE_URL}${photoPath}`;

      if (coupleImgSrc.startsWith('http')) {
        coupleImg.crossOrigin = 'anonymous';
      }

      const drawFinalCard = () => {
        const imgW = coupleImg.width || 1;
        const imgH = coupleImg.height || 1;
        const imgAspect = imgW / imgH;
        const heartAspect = hW / hH;
        let drawW = hW;
        let drawH = hH;
        let offsetX = 0;
        let offsetY = 0;

        if (imgAspect > heartAspect) {
          drawW = hH * imgAspect;
          offsetX = -(drawW - hW) / 2;
        } else {
          drawH = hW / imgAspect;
          offsetY = -(drawH - hH) / 2;
        }

        const zoom = userZoom;
        const finalW = drawW * zoom;
        const finalH = drawH * zoom;
        const finalOffsetX = offsetX - (finalW - drawW) / 2;
        const finalOffsetY = (offsetY - (finalH - drawH) / 2) + userOffsetY;

        ctx.save();
        ctx.beginPath();
        ctx.rect(hX, hY, hW, hH);
        ctx.clip();
        ctx.drawImage(coupleImg, hX + finalOffsetX, hY + finalOffsetY, finalW, finalH);
        ctx.restore();

        ctx.drawImage(tempCanvas, 0, 0);
        drawTextDetails(ctx, sub);

        try {
          setCanvasDataUrl(canvas.toDataURL('image/png'));
        } catch (e) {
          setUseCanvasDirectly(true);
        }
        setCardReady(true);
      };

      coupleImg.onload = () => drawFinalCard();

      let coupleRetried = false;
      coupleImg.onerror = () => {
        if (!coupleRetried && coupleImgSrc.startsWith('http')) {
          coupleRetried = true;
          coupleImg.removeAttribute('crossOrigin');
          coupleImg.src = coupleImgSrc + (coupleImgSrc.includes('?') ? '&' : '?') + 'nocache=' + Date.now();
        } else {
          ctx.drawImage(tempCanvas, 0, 0);
          drawTextDetails(ctx, sub);
          try {
            setCanvasDataUrl(canvas.toDataURL('image/png'));
          } catch (e) {
            setUseCanvasDirectly(true);
          }
          setCardReady(true);
        }
      };
      coupleImg.src = coupleImgSrc;
    };

    templateImg.src = templateImgSrc;
  }, [userZoom, userOffsetY]);

  useEffect(() => {
    if (submission && canvasElement) {
      drawCard(submission);
    }
  }, [submission, userZoom, userOffsetY, canvasElement, drawCard]);

  const handleSaveAdjustments = async () => {
    if (!inquiryId) return;
    setSavingAdjustments(true);
    setSaveSuccessMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/passes/${encodeURIComponent(inquiryId)}/adjust-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoZoom: userZoom, photoOffsetY: userOffsetY })
      });
      if (res.ok) {
        setSaveSuccessMessage('Photo framing position saved!');
        setTimeout(() => setSaveSuccessMessage(''), 4000);
      }
    } catch (e) {
      console.error('Failed to save adjustment:', e);
    } finally {
      setSavingAdjustments(false);
    }
  };

  const handleDownloadCard = () => {
    const coupleTitle = `${submission?.surname || 'Couple'}_${submission?.husbandName || 'Pass'}`.replace(/\s+/g, '_');
    const imageSrc = canvasDataUrl || (canvasRef.current ? canvasRef.current.toDataURL('image/png') : '');
    if (!imageSrc) return;

    try {
      const link = document.createElement('a');
      link.download = `${coupleTitle}_Invitation_Card.png`;
      link.href = imageSrc;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      // Fallback for iOS Safari
      window.open(imageSrc, '_blank');
    }
  };

  const handleShareWhatsApp = () => {
    if (!submission) return;
    const coupleName = `${submission.husbandName || ''} & ${submission.wifeName || ''} ${submission.surname || ''}`.trim();
    const shareText = encodeURIComponent(
      `તમારું એક દુજે કે લિયે પર્સનલાઇઝ્ડ ઇન્વિટેશન કાર્ડ તૈયાર છે!\n\n` +
      `Couple: ${coupleName}\n` +
      `Registration ID: ${submission.inquiryId}\n` +
      `Event: ${submission.program?.name || submission.programName || 'Ek Duje Ke Liye'}\n` +
      `Date: ${submission.program?.date || submission.programDate || '11 September 2026'}\n\n` +
      `કાર્ડ જોવા અને ડાઉનલોડ કરવા માટે આ લિંક ઓપન કરો:\n` +
      `https://www.ekdujekeliye.in/invitation/${submission.inquiryId}`
    );
    window.open(`https://api.whatsapp.com/send?text=${shareText}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-4 text-stone-900">
        <div className="w-10 h-10 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-stone-700">Loading your Personalized Invitation Card...</p>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-4 text-stone-900">
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangleIcon className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Invitation Card Not Found</h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            {error || 'The requested registration or invitation card could not be loaded.'}
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-block px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const coupleDisplayName = `${submission.husbandName || ''} & ${submission.wifeName || ''} ${submission.surname || ''}`.trim() || 'Respected Couple';

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex flex-col items-center justify-start p-3 sm:p-6 select-none print:bg-white print:text-black">

      {/* Top Breadcrumb & Actions Bar */}
      <div className="w-full max-w-sm mb-3 flex items-center justify-between print:hidden">
        <Link
          href="/"
          className="text-xs font-bold text-stone-600 hover:text-stone-900 flex items-center gap-1"
        >
          ← Home
        </Link>
        <Link
          href={`/pass/${inquiryId}`}
          className="text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all"
        >
          <QrCodeIcon className="w-3.5 h-3.5" />
          <span>View Gate Pass</span>
        </Link>
      </div>

      {/* Main Card Container */}
      <div className="w-full max-w-sm bg-white text-stone-900 rounded-3xl shadow-2xl overflow-hidden border border-stone-200/90 flex flex-col items-center p-4 sm:p-5 space-y-4">

        {/* Title Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-900 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest mb-1">
            <SparklesIcon className="w-3.5 h-3.5 text-amber-600" />
            <span>Personalized Souvenir Invitation</span>
          </div>
          <h1 className="text-lg font-black text-stone-900 tracking-tight">
            {coupleDisplayName}
          </h1>
          <p className="text-xs text-stone-500 font-medium">
            Registration ID: <span className="font-bold text-amber-700">{submission.inquiryId}</span>
          </p>
        </div>

        {/* Canvas Render Element */}
        <div
          className="overflow-hidden rounded-2xl border border-stone-300 shadow-xl max-w-full relative bg-stone-950"
          style={{ width: '300px', height: '533px' }}
        >
          <canvas
            ref={setCanvasRef}
            style={{ width: '300px', height: '533px' }}
            className={useCanvasDirectly ? 'mx-auto block bg-stone-950' : 'hidden'}
          />
          {!useCanvasDirectly && (
            canvasDataUrl ? (
              <img
                src={canvasDataUrl}
                alt="Personalized Invitation Card"
                style={{ width: '300px', height: '533px' }}
                className="mx-auto block bg-stone-950 object-contain"
              />
            ) : (
              <div style={{ width: '300px', height: '533px' }} className="animate-pulse bg-stone-950 flex items-center justify-center text-xs text-stone-400">
                Rendering invitation card...
              </div>
            )
          )}
        </div>

        {/* Photo Adjustment Controls */}
        <div className="w-full bg-stone-50 border border-stone-200/90 rounded-2xl p-4 space-y-3.5 print:hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-800 uppercase tracking-wider block">
              Adjust Your Photo / ફોટો સરખો કરો
            </span>
            <button
              type="button"
              onClick={handleSaveAdjustments}
              disabled={savingAdjustments}
              className="text-[10px] font-extrabold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition-all cursor-pointer"
            >
              {savingAdjustments ? 'Saving...' : 'Save Position'}
            </button>
          </div>

          {saveSuccessMessage && (
            <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold rounded-lg text-center">
              ✓ {saveSuccessMessage}
            </div>
          )}

          <div className="space-y-3 text-left">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-wider">Zoom (મોટો/નાનો કરો)</label>
                <span className="text-[10px] text-stone-500 font-semibold">{userZoom.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={userZoom}
                onChange={(e) => setUserZoom(Number(e.target.value))}
                className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-wider">Position (ઉપર/નીચે કરો)</label>
                <span className="text-[10px] text-stone-500 font-semibold">{userOffsetY}px</span>
              </div>
              <input
                type="range"
                min="-150"
                max="150"
                step="5"
                value={userOffsetY}
                onChange={(e) => setUserOffsetY(Number(e.target.value))}
                className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
              />
            </div>
          </div>
        </div>

        {/* Event Schedule Info */}
        <div className="w-full bg-stone-50/80 border border-stone-200/80 rounded-2xl p-3 text-left space-y-1.5 text-xs text-stone-700">
          <div className="font-bold text-stone-900 text-xs leading-snug">
            {submission.program?.name || submission.programName || ''}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-stone-600">
            <CalendarIcon className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
            <span>{submission.program?.date || submission.programDate || ''}</span>
            <span className="text-stone-300">&bull;</span>
            <ClockIcon className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
            <span>{submission.program?.time || submission.programTime || '8:30 PM'}</span>
          </div>
          <div className="flex items-start gap-1.5 text-[11px] text-stone-600">
            <MapPinIcon className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
            <span className="leading-tight">{submission.program?.venue || submission.venue || ''}</span>
          </div>
        </div>

        {/* Actions Grid */}
        <div className="w-full space-y-2 pt-1 print:hidden">
          <button
            type="button"
            onClick={handleDownloadCard}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-rose-600 via-rose-700 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 transition-all cursor-pointer"
          >
            <DownloadIcon className="w-4 h-4" />
            <span>Download Invitation Card (PNG)</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Share2Icon className="w-4 h-4" />
            <span>Share Invitation on WhatsApp</span>
          </button>

          <Link
            href={`/pass/${inquiryId}`}
            className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <QrCodeIcon className="w-4 h-4 text-stone-600" />
            <span>View Gate Entry QR Pass →</span>
          </Link>
        </div>

      </div>

      {/* Brand Footer */}
      <div className="mt-4 text-center text-xs text-stone-500 font-medium print:hidden">
        &copy; {new Date().getFullYear()} Ek Duje Ke Liye &bull; All Rights Reserved
      </div>
    </div>
  );
}
