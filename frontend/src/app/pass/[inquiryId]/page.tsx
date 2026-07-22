'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { API_BASE_URL } from '../../../config';

interface Submission {
  inquiryId: string;
  husbandName: string;
  wifeName: string;
  surname: string;
  phoneNumber: string;
  programId: string;
  programName: string;
  programDate: string;
  couplePhoto: string;
  status: string;
  rejectionReason?: string;
}

export default function PassDownloadPage() {
  const params = useParams();
  const inquiryId = params.inquiryId as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!inquiryId) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/submissions/status/${inquiryId}`);
        if (res.ok) {
          const data = await res.json();
          setSubmission(data);
        } else {
          setError('Inquiry ID not found or invalid.');
        }
      } catch (err) {
        setError('Connection failed. Make sure backend server is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [inquiryId]);

  // Canvas drawing functions
  const drawHeartMask = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + h * 0.24);
    ctx.bezierCurveTo(x + w * 0.28, y - h * 0.06, x - w * 0.06, y + h * 0.22, x + w * 0.01, y + h * 0.56);
    ctx.bezierCurveTo(x + w * 0.06, y + h * 0.78, x + w * 0.32, y + h * 0.94, x + w / 2, y + h * 1.02);
    ctx.bezierCurveTo(x + w * 0.68, y + h * 0.94, x + w * 0.94, y + h * 0.78, x + w * 0.99, y + h * 0.56);
    ctx.bezierCurveTo(x + w * 1.06, y + h * 0.22, x + w * 0.72, y - h * 0.06, x + w / 2, y + h * 0.24);
    ctx.closePath();
  };

  const drawTextDetails = (ctx: CanvasRenderingContext2D, sub: Submission) => {
    const sideX = 385;
    const sideY = 230;
    const sideW = 176;
    const sideH = 135;

    ctx.save();
    ctx.fillStyle = 'rgba(26, 6, 6, 0.95)';
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(sideX, sideY, sideW, sideH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('COUPLE ENTRY', sideX + sideW / 2, sideY + 20);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    const nameLine1 = `${sub.husbandName}`.toUpperCase();
    const nameLine2 = `& ${sub.wifeName}`.toUpperCase();
    const nameLine3 = `${sub.surname}`.toUpperCase();
    ctx.fillText(nameLine1, sideX + sideW / 2, sideY + 45);
    ctx.fillText(nameLine2, sideX + sideW / 2, sideY + 65);
    ctx.fillText(nameLine3, sideX + sideW / 2, sideY + 85);

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sideX + 15, sideY + 98);
    ctx.lineTo(sideX + sideW - 15, sideY + 98);
    ctx.stroke();

    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`${sub.inquiryId}`, sideX + sideW / 2, sideY + 118);
    ctx.restore();
  };

  const drawCard = (sub: Submission) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 576;
    canvas.height = 1024;

    const templateImg = new Image();
    templateImg.crossOrigin = 'anonymous';
    templateImg.onload = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      tempCtx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);

      const scanX = 140;
      const scanY = 100;
      const scanW = 300;
      const scanH = 280;
      const imgData = tempCtx.getImageData(scanX, scanY, scanW, scanH);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > 230 && g > 230 && b > 230) {
          data[i + 3] = 0;
        }
      }
      tempCtx.putImageData(imgData, scanX, scanY);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const coupleImg = new Image();
      coupleImg.crossOrigin = 'anonymous';
      coupleImg.onload = () => {
        const hX = 144;
        const hY = 112;
        const hW = 288;
        const hH = 260;

        const imgAspect = coupleImg.width / coupleImg.height;
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

        const zoom = 1.1;
        const finalW = drawW * zoom;
        const finalH = drawH * zoom;
        const finalOffsetX = offsetX - (finalW - drawW) / 2;
        const finalOffsetY = offsetY - (finalH - drawH) / 2;

        ctx.drawImage(coupleImg, hX + finalOffsetX, hY + finalOffsetY, finalW, finalH);
        ctx.drawImage(tempCanvas, 0, 0);
        drawTextDetails(ctx, sub);
      };
      coupleImg.src = `${API_BASE_URL}${sub.couplePhoto}`;
    };
    templateImg.src = '/card_template.png';
  };

  useEffect(() => {
    if (submission && submission.status === 'approved') {
      // Draw card after short delay to make sure canvas ref is bound
      setTimeout(() => drawCard(submission), 100);
    }
  }, [submission]);

  const downloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${submission?.surname}_${submission?.husbandName}_Invitation_Pass.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center font-sans">
        <p className="text-lg text-slate-400">Loading your invitation pass details...</p>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center font-sans p-6">
        <div className="max-w-md w-full bg-slate-950/70 border border-slate-800/80 rounded-3xl p-8 text-center backdrop-blur-xl shadow-2xl">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-slate-200">Error</h2>
          <p className="text-slate-400 text-sm mt-2">{error || 'Inquiry not found.'}</p>
          <a href="/" className="mt-6 inline-block w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all">
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans">
      <header className="py-6 px-8 border-b border-slate-800 bg-slate-950/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-10 w-auto object-contain" />
            <span className="text-xl font-bold tracking-wider text-slate-100 uppercase">Ek Duje Ke Liye</span>
          </div>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-xl bg-slate-950/70 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden text-center">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          {submission.status === 'pending' && (
            <div className="space-y-6 py-6">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto text-3xl animate-bounce">
                ⏳
              </div>
              <h2 className="text-2xl font-bold text-slate-100">Verification Pending</h2>
              <p className="text-slate-300 text-sm max-w-sm mx-auto leading-relaxed">
                Hello <strong>{submission.husbandName} & {submission.wifeName}</strong>, your payment verification is currently in progress.
              </p>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl max-w-xs mx-auto">
                <span className="text-xs text-slate-500 uppercase tracking-wider block">Inquiry ID</span>
                <span className="text-xl font-extrabold text-amber-500 tracking-wider font-mono">{submission.inquiryId}</span>
              </div>
              <p className="text-xs text-slate-500">
                Please wait for the administrator to approve your details. Once approved, refresh this page to download your pass.
              </p>
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-3 border border-slate-800 hover:bg-slate-900 active:scale-[0.99] text-slate-300 font-bold rounded-xl transition-all"
              >
                Refresh Status
              </button>
            </div>
          )}

          {submission.status === 'rejected' && (
            <div className="space-y-6 py-6">
              <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto text-3xl">
                ❌
              </div>
              <h2 className="text-2xl font-bold text-slate-100">Verification Rejected</h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                Your card request was rejected by the administrator.
              </p>
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl max-w-md mx-auto text-red-400 text-sm">
                <strong>Reason:</strong> {submission.rejectionReason || 'No reason provided.'}
              </div>
              <p className="text-xs text-slate-500">
                Please register again or contact support to resolve the issue.
              </p>
              <a href="/" className="inline-block w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all">
                Try Again / Register New
              </a>
            </div>
          )}

          {submission.status === 'approved' && (
            <div className="space-y-6 flex flex-col items-center">
              <div className="text-center w-full">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto mb-2 text-xl">
                  ✓
                </div>
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Your Invitation Card is Approved!</h2>
                <p className="text-slate-400 text-sm mt-1">Your payment was verified. Use the button below to download the invitation pass.</p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-800 shadow-xl max-w-full my-4">
                <canvas
                  ref={canvasRef}
                  style={{ width: '300px', height: '533px' }}
                  className="mx-auto block bg-slate-950"
                />
              </div>

              <button
                onClick={downloadCard}
                className="w-full py-4 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-bold rounded-2xl transition-all shadow-lg shadow-amber-500/20"
              >
                Download Pass
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="py-6 px-8 border-t border-slate-800/80 bg-slate-950/20 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Couple Card Generation System.
      </footer>
    </div>
  );
}
