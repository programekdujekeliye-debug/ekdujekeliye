'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import { useAdmin } from '../context/AdminContext';
import { registrationsApi } from '../../../services/admin/registrationsApi';
import { Submission, Program } from '../../../types';
import { API_BASE_URL } from '../../../config';
import {
  XIcon,
  SearchIcon,
  DownloadIcon,
  SparklesIcon,
  CheckCircleIcon,
  CameraIcon,
  AlertTriangleIcon,
  CheckIcon
} from '../../../components/Icons';
import { LuxurySelect } from '../../../components/LuxurySelect';
import toast from 'react-hot-toast';

interface FrameReviewExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProgramId?: string;
}

// Token matching algorithm matching legacy system: allows comma/space separated CPL, IP, or numeric IDs
export const matchCplToken = (inquiryId: string, searchToken: string, isBulk: boolean) => {
  const id = inquiryId.trim().toUpperCase();
  const token = searchToken.trim().toUpperCase();

  if (id === token) return true;

  // Exact prefix match
  if (token.startsWith('CPL-') || token.startsWith('IP-') || /^EK\d+-\d+$/.test(token)) {
    return id === token;
  }

  // Pure numeric suffix match (e.g. "8" or "0101")
  if (/^\d+$/.test(token)) {
    return id.endsWith(`-${token}`) || id.endsWith(token);
  }

  if (isBulk) return false;

  return id.includes(token);
};

const resolvePhotoUrl = (photoPath: string): string => {
  if (
    photoPath.startsWith('data:') ||
    photoPath.startsWith('http://') ||
    photoPath.startsWith('https://')
  ) {
    return photoPath;
  }
  return `${API_BASE_URL}${photoPath.startsWith('/') ? photoPath : `/${photoPath}`}`;
};

// Safe image loader
const loadImage = (src: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    let safeSrc = src;
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      safeSrc.startsWith('http://')
    ) {
      safeSrc = safeSrc.replace('http://', 'https://');
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn('Failed to load image in FrameReview:', safeSrc);
      resolve(null);
    };
    img.src = safeSrc;
  });
};

/**
 * LivePreviewCanvas: Real-time rendered canvas showing couple photo inside frame with live zoom & offset
 */
const LivePreviewCanvas: React.FC<{
  sub: Submission;
  frameImg: HTMLImageElement | null;
}> = ({ sub, frameImg }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [coupleImg, setCoupleImg] = useState<HTMLImageElement | null>(null);
  const [loadingImg, setLoadingImg] = useState(true);

  useEffect(() => {
    if (!sub.couplePhoto) {
      setCoupleImg(null);
      setLoadingImg(false);
      return;
    }
    setLoadingImg(true);
    const fullUrl = resolvePhotoUrl(sub.couplePhoto);
    loadImage(fullUrl).then((img) => {
      setCoupleImg(img);
      setLoadingImg(false);
    });
  }, [sub.couplePhoto]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 384;
    canvas.height = 512;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Frame bounding box (8% padding on left/right/top, 84% width/height)
    const startX = canvas.width * 0.08;
    const startY = canvas.height * 0.08;
    const drawWidth = canvas.width * 0.84;
    const drawHeight = canvas.height * 0.84;

    if (coupleImg) {
      const imgAspect = coupleImg.width / coupleImg.height;
      const targetAspect = drawWidth / drawHeight;
      let tempW = drawWidth;
      let tempH = drawHeight;
      let offsetX = 0;
      let offsetY = 0;

      if (imgAspect > targetAspect) {
        tempW = drawHeight * imgAspect;
        offsetX = -(tempW - drawWidth) / 2;
      } else {
        tempH = drawWidth / imgAspect;
        offsetY = -(tempH - drawHeight) / 2;
      }

      const zoom = sub.photoZoom ?? 1.0;
      const w = tempW * zoom;
      const h = tempH * zoom;
      const ox = offsetX - (w - tempW) / 2;
      const oy = (offsetY - (h - tempH) / 2) + ((sub.photoOffsetY ?? 0) / 2);

      ctx.save();
      ctx.beginPath();
      ctx.rect(startX, startY, drawWidth, drawHeight);
      ctx.clip();
      ctx.drawImage(coupleImg, startX + ox, startY + oy, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(startX, startY, drawWidth, drawHeight);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(loadingImg ? 'Loading photo...' : 'No photo uploaded', canvas.width / 2, canvas.height / 2);
    }

    // Draw frame overlay if loaded
    if (frameImg) {
      ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
    }

    // Draw inquiryId / Token ID cleanly at bottom below calligraphy logo
    ctx.save();
    ctx.fillStyle = '#7a0c0c';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sub.inquiryId, canvas.width / 2, canvas.height * 0.95);
    ctx.restore();
  }, [coupleImg, frameImg, sub.photoZoom, sub.photoOffsetY, sub.inquiryId, loadingImg]);

  return (
    <div className="w-[120px] h-[160px] relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 flex-shrink-0 shadow-inner">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain block"
      />
    </div>
  );
};

export const FrameReviewExportModal: React.FC<FrameReviewExportModalProps> = ({
  isOpen,
  onClose,
  defaultProgramId = ''
}) => {
  const { programs } = useAdmin();

  // Selection & Filtering state
  const [selectedProgramId, setSelectedProgramId] = useState<string>(defaultProgramId || '');
  const [cplSearchQuery, setCplSearchQuery] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedInquiryIds, setSelectedInquiryIds] = useState<string[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Global Frame Image
  const [globalFrameImg, setGlobalFrameImg] = useState<HTMLImageElement | null>(null);

  // Export & Progress state
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedSuccessIds, setSavedSuccessIds] = useState<Record<string, boolean>>({});

  // Sync defaultProgramId on open
  useEffect(() => {
    if (isOpen) {
      if (defaultProgramId && defaultProgramId !== 'all') {
        setSelectedProgramId(defaultProgramId);
      } else if (!selectedProgramId && programs.length > 0) {
        setSelectedProgramId(programs[0].id);
      }
    }
  }, [isOpen, defaultProgramId, programs]);

  // Pre-load frame template PNG
  useEffect(() => {
    if (!isOpen) return;
    loadImage('/frame_template.png').then((img) => {
      setGlobalFrameImg(img);
    });
  }, [isOpen]);

  // Fetch approved submissions with couple photos for the selected program
  const fetchSubmissionsForFrames = useCallback(async () => {
    if (!selectedProgramId) {
      setSubmissions([]);
      setSelectedInquiryIds([]);
      return;
    }

    try {
      setLoadingSubmissions(true);
      const res = await registrationsApi.getSubmissions({
        programId: selectedProgramId !== 'all' ? selectedProgramId : undefined,
        status: 'approved',
        limit: 1000
      });

      const list = (res.submissions || []).filter((s) => Boolean(s.couplePhoto));
      setSubmissions(list);
      setSelectedInquiryIds(list.map((s) => s.inquiryId));
    } catch (err) {
      console.error('Failed to fetch submissions for frames:', err);
      toast.error('Failed to load registrations with photos.');
    } finally {
      setLoadingSubmissions(false);
    }
  }, [selectedProgramId]);

  useEffect(() => {
    if (isOpen) {
      fetchSubmissionsForFrames();
    }
  }, [isOpen, fetchSubmissionsForFrames]);

  // Filtered submissions based on CPL search query
  const searchedTokens = cplSearchQuery
    .split(/[\s,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const isBulkSearch = searchedTokens.length > 1;

  const filteredSubmissions = submissions.filter((sub) => {
    if (!cplSearchQuery.trim()) return true;
    return searchedTokens.some((token) => matchCplToken(sub.inquiryId, token, isBulkSearch));
  });

  const selectedCount = submissions.filter((s) => selectedInquiryIds.includes(s.inquiryId)).length;

  // Real-time alignment state update
  const updateCoord = (inquiryId: string, field: 'photoZoom' | 'photoOffsetY', value: number) => {
    setSubmissions((prev) =>
      prev.map((sub) => {
        if (sub.inquiryId === inquiryId) {
          return { ...sub, [field]: value };
        }
        return sub;
      })
    );
  };

  // Save single submission alignment to backend
  const handleSaveSingleAlignment = async (sub: Submission) => {
    try {
      setSavingId(sub.inquiryId);
      await registrationsApi.updateSubmission(sub.inquiryId, {
        photoZoom: sub.photoZoom ?? 1.0,
        photoOffsetY: sub.photoOffsetY ?? 0
      });
      setSavedSuccessIds((prev) => ({ ...prev, [sub.inquiryId]: true }));
      toast.success(`Alignment saved for ${sub.inquiryId}`);
      setTimeout(() => {
        setSavedSuccessIds((prev) => ({ ...prev, [sub.inquiryId]: false }));
      }, 3000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save alignment.');
    } finally {
      setSavingId(null);
    }
  };

  // Download single framed photo PNG
  const handleDownloadSingleFrame = async (sub: Submission) => {
    if (!sub.couplePhoto) {
      toast.error('No photo available for this registration.');
      return;
    }

    try {
      const fullPhotoUrl = resolvePhotoUrl(sub.couplePhoto);
      const coupleImg = await loadImage(fullPhotoUrl);
      const frameImg = globalFrameImg || (await loadImage('/frame_template.png'));

      if (!frameImg) {
        toast.error('Failed to load frame template.');
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = frameImg.naturalWidth || 768;
      canvas.height = frameImg.naturalHeight || 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const startX = canvas.width * 0.08;
      const startY = canvas.height * 0.08;
      const drawWidth = canvas.width * 0.84;
      const drawHeight = canvas.height * 0.84;

      if (coupleImg) {
        const imgAspect = coupleImg.width / coupleImg.height;
        const targetAspect = drawWidth / drawHeight;
        let tempW = drawWidth;
        let tempH = drawHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (imgAspect > targetAspect) {
          tempW = drawHeight * imgAspect;
          offsetX = -(tempW - drawWidth) / 2;
        } else {
          tempH = drawWidth / imgAspect;
          offsetY = -(tempH - drawHeight) / 2;
        }

        const zoom = sub.photoZoom ?? 1.0;
        const w = tempW * zoom;
        const h = tempH * zoom;
        const ox = offsetX - (w - tempW) / 2;
        const oy = (offsetY - (h - tempH) / 2) + ((sub.photoOffsetY ?? 0) * (canvas.height / 1024));

        ctx.save();
        ctx.beginPath();
        ctx.rect(startX, startY, drawWidth, drawHeight);
        ctx.clip();
        ctx.drawImage(coupleImg, startX + ox, startY + oy, w, h);
        ctx.restore();
      }

      // Overlay frame
      ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);

      // Token text
      ctx.save();
      ctx.fillStyle = '#7a0c0c';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sub.inquiryId, canvas.width / 2, canvas.height * 0.95);
      ctx.restore();

      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${sub.inquiryId}_framed.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Downloaded frame for ${sub.inquiryId}`);
    } catch (err: any) {
      toast.error('Failed to download framed photo.');
    }
  };

  // Batch Framed Photos ZIP Generation
  const handleDownloadFramedZip = async () => {
    const listToExport = submissions.filter((s) => selectedInquiryIds.includes(s.inquiryId));
    if (listToExport.length === 0) {
      toast.error('No selected registrations to download.');
      return;
    }

    try {
      setZipping(true);
      setZipProgress('Starting...');
      const zip = new JSZip();

      setZipProgress('Loading frame template...');
      const frameImg = globalFrameImg || (await loadImage('/frame_template.png'));
      if (!frameImg) throw new Error('Could not load frame template');

      const canvas = document.createElement('canvas');
      canvas.width = frameImg.naturalWidth || 768;
      canvas.height = frameImg.naturalHeight || 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2D canvas context');

      const startX = canvas.width * 0.08;
      const startY = canvas.height * 0.08;
      const drawWidth = canvas.width * 0.84;
      const drawHeight = canvas.height * 0.84;

      // Save modified alignments in background
      for (const sub of listToExport) {
        registrationsApi
          .updateSubmission(sub.inquiryId, {
            photoZoom: sub.photoZoom ?? 1.0,
            photoOffsetY: sub.photoOffsetY ?? 0
          })
          .catch(() => {});
      }

      for (let i = 0; i < listToExport.length; i++) {
        const sub = listToExport[i];
        setZipProgress(`Processing ${i + 1} of ${listToExport.length} (${sub.inquiryId})...`);

        try {
          const photoPath = sub.couplePhoto!;
          const fullPhotoUrl = resolvePhotoUrl(photoPath);
          const coupleImg = await loadImage(fullPhotoUrl);

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (coupleImg) {
            const imgAspect = coupleImg.width / coupleImg.height;
            const targetAspect = drawWidth / drawHeight;
            let tempW = drawWidth;
            let tempH = drawHeight;
            let offsetX = 0;
            let offsetY = 0;

            if (imgAspect > targetAspect) {
              tempW = drawHeight * imgAspect;
              offsetX = -(tempW - drawWidth) / 2;
            } else {
              tempH = drawWidth / imgAspect;
              offsetY = -(tempH - drawHeight) / 2;
            }

            const zoom = sub.photoZoom ?? 1.0;
            const w = tempW * zoom;
            const h = tempH * zoom;
            const ox = offsetX - (w - tempW) / 2;
            const oy = (offsetY - (h - tempH) / 2) + ((sub.photoOffsetY ?? 0) * (canvas.height / 1024));

            ctx.save();
            ctx.beginPath();
            ctx.rect(startX, startY, drawWidth, drawHeight);
            ctx.clip();
            ctx.drawImage(coupleImg, startX + ox, startY + oy, w, h);
            ctx.restore();
          }

          ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);

          ctx.save();
          ctx.fillStyle = '#7a0c0c';
          ctx.font = 'bold 22px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(sub.inquiryId, canvas.width / 2, canvas.height * 0.95);
          ctx.restore();

          const dataUrl = canvas.toDataURL('image/png');
          const base64Data = dataUrl.split(',')[1];
          const filename = `${sub.inquiryId}_${sub.surname || 'Couple'}_${sub.husbandName || 'H'}.png`.replace(
            /[^a-zA-Z0-9_.-]/g,
            '_'
          );
          zip.file(filename, base64Data, { base64: true });
        } catch (subErr) {
          console.error('Error framing photo for submission:', sub.inquiryId, subErr);
        }
      }

      setZipProgress('Compressing ZIP archive...');
      const content = await zip.generateAsync({ type: 'blob' });

      setZipProgress('Downloading...');
      const curProg = programs.find((p) => p.id === selectedProgramId);
      const progName = curProg ? curProg.name : 'Event';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = `${progName}_framed_photos.zip`.replace(/\s+/g, '_');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success(`Successfully downloaded ${listToExport.length} framed photos!`);
    } catch (err: any) {
      toast.error('Error creating ZIP: ' + err.message);
    } finally {
      setZipping(false);
      setZipProgress('');
    }
  };

  // Raw Photos ZIP Download
  const handleDownloadRawZip = async () => {
    const listToExport = submissions.filter((s) => selectedInquiryIds.includes(s.inquiryId));
    if (listToExport.length === 0) {
      toast.error('No selected registrations to download.');
      return;
    }

    try {
      setZipping(true);
      setZipProgress('Starting...');
      const zip = new JSZip();

      for (let i = 0; i < listToExport.length; i++) {
        const sub = listToExport[i];
        setZipProgress(`Fetching raw photo ${i + 1} of ${listToExport.length} (${sub.inquiryId})...`);

        try {
          const photoUrl = resolvePhotoUrl(sub.couplePhoto!);
          const res = await fetch(photoUrl);
          if (!res.ok) throw new Error('Fetch failed');
          const blob = await res.blob();

          let ext = 'png';
          const contentType = res.headers.get('content-type');
          if (contentType?.includes('jpeg') || contentType?.includes('jpg')) ext = 'jpg';
          else if (contentType?.includes('webp')) ext = 'webp';

          zip.file(`${sub.inquiryId}.${ext}`, blob);
        } catch (err) {
          console.error('Error fetching raw photo:', sub.inquiryId, err);
        }
      }

      setZipProgress('Compressing ZIP archive...');
      const content = await zip.generateAsync({ type: 'blob' });

      const curProg = programs.find((p) => p.id === selectedProgramId);
      const progName = curProg ? curProg.name : 'Event';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = `${progName}_raw_photos.zip`.replace(/\s+/g, '_');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success(`Downloaded ${listToExport.length} raw photos.`);
    } catch (err: any) {
      toast.error('Failed to download raw photos ZIP.');
    } finally {
      setZipping(false);
      setZipProgress('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50/50 via-white to-rose-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100/80 border border-amber-200 text-amber-700 flex items-center justify-center shadow-xs shrink-0">
              <CameraIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  Photo Frame Review &amp; Export
                </h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                  Live Canvas
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Inspect, align with zoom &amp; shift, and download high-resolution framed photos individually or in bulk ZIP.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close Modal"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Top Controls Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 space-y-3 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Program Session Selector */}
            <div className="sm:col-span-4">
              <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                Event Session Slot
              </label>
              <LuxurySelect
                value={selectedProgramId}
                onChange={(val) => setSelectedProgramId(val)}
                options={programs.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.date || 'TBA'})`
                }))}
                variant="outline"
              />
            </div>

            {/* Multiple CPL Search Filter */}
            <div className="sm:col-span-8">
              <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                Search / Filter Tokens (Comma or Space Separated, e.g. EK01-01, EK01-02, 105)
              </label>
              <div className="relative flex items-center bg-white border border-slate-300 rounded-xl px-3 py-1.5 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/10 transition-all">
                <SearchIcon className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={cplSearchQuery}
                  onChange={(e) => setCplSearchQuery(e.target.value)}
                  placeholder="Paste tokens, couple name, or phone..."
                  className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none font-medium"
                />
                {cplSearchQuery && (
                  <button
                    onClick={() => setCplSearchQuery('')}
                    className="text-xs text-slate-400 hover:text-slate-600 p-0.5 font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Selection & Action Buttons Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  const filteredIds = filteredSubmissions.map((s) => s.inquiryId);
                  setSelectedInquiryIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
                }}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-2xs"
              >
                Select All Filtered
              </button>
              <button
                type="button"
                onClick={() => {
                  const filteredIds = new Set(filteredSubmissions.map((s) => s.inquiryId));
                  setSelectedInquiryIds((prev) => prev.filter((id) => !filteredIds.has(id)));
                }}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-2xs"
              >
                Deselect Filtered
              </button>
              <button
                type="button"
                onClick={() => setSelectedInquiryIds(submissions.map((s) => s.inquiryId))}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl font-bold transition-all text-xs cursor-pointer"
              >
                Select All ({submissions.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedInquiryIds([])}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl font-bold transition-all text-xs cursor-pointer"
              >
                Clear Selection
              </button>
            </div>

            <div className="text-xs font-bold text-slate-600 flex items-center gap-2">
              <span>
                Selected: <strong className="text-rose-700">{selectedCount}</strong> / {submissions.length}
              </span>
              {filteredSubmissions.length !== submissions.length && (
                <span className="text-[11px] text-slate-400">
                  (Showing {filteredSubmissions.length} filtered)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Main List Area with Real-Time Frame Canvases */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-100/50">
          {loadingSubmissions ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-600">Loading registrations with photos...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="py-20 text-center space-y-3 bg-white rounded-2xl border border-slate-200 p-8">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <CameraIcon className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900">No Registrations with Photos Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {cplSearchQuery.trim()
                  ? 'No registrations match your search criteria. Try modifying your search or clearing the query.'
                  : 'There are no approved registrations with couple photos for the selected session.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredSubmissions.map((sub) => {
                const isSelected = selectedInquiryIds.includes(sub.inquiryId);
                const zoomVal = sub.photoZoom ?? 1.0;
                const offsetVal = sub.photoOffsetY ?? 0;
                const isSaving = savingId === sub.inquiryId;
                const isSaved = savedSuccessIds[sub.inquiryId];

                return (
                  <div
                    key={sub.inquiryId}
                    className={`bg-white border rounded-2xl p-4 transition-all shadow-xs flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
                      isSelected
                        ? 'border-amber-300 ring-1 ring-amber-500/10'
                        : 'border-slate-200/90 opacity-70 hover:opacity-100'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="flex items-center pt-1 sm:pt-0 shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedInquiryIds((prev) =>
                            isSelected ? prev.filter((id) => id !== sub.inquiryId) : [...prev, sub.inquiryId]
                          );
                        }}
                        className="w-4 h-4 rounded text-amber-600 accent-amber-600 cursor-pointer"
                        aria-label={`Select ${sub.inquiryId}`}
                      />
                    </div>

                    {/* Live Preview Canvas */}
                    <LivePreviewCanvas sub={sub} frameImg={globalFrameImg} />

                    {/* Couple Information & Tactile Live Sliders */}
                    <div className="flex-1 min-w-0 w-full space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-slate-900 text-sm leading-tight">
                              {sub.husbandName} &amp; {sub.wifeName} {sub.surname}
                            </h4>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md">
                              {sub.inquiryId}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            Phone: {sub.phoneNumber} &bull; Program: {sub.programName}
                          </p>
                        </div>

                        {/* Direct Action Buttons per Couple */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSaveSingleAlignment(sub)}
                            disabled={isSaving}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border cursor-pointer ${
                              isSaved
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                            title="Save Zoom and Position to Database"
                          >
                            {isSaving ? (
                              <div className="w-3 h-3 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                            ) : isSaved ? (
                              <>
                                <CheckIcon className="w-3 h-3 text-emerald-600" />
                                <span>Saved</span>
                              </>
                            ) : (
                              <span>Save Align</span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadSingleFrame(sub)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Download single high-res framed PNG"
                          >
                            <DownloadIcon className="w-3 h-3" />
                            <span>Download PNG</span>
                          </button>
                        </div>
                      </div>

                      {/* Tactile Sliders & Steppers */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 bg-slate-50/80 p-3 rounded-xl border border-slate-200/70">
                        {/* Zoom Slider */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                              Zoom ({zoomVal.toFixed(2)}x)
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateCoord(sub.inquiryId, 'photoZoom', Math.max(0.5, Number((zoomVal - 0.05).toFixed(2))))}
                                className="w-5 h-5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center cursor-pointer"
                              >
                                −
                              </button>
                              <button
                                type="button"
                                onClick={() => updateCoord(sub.inquiryId, 'photoZoom', Math.min(2.5, Number((zoomVal + 0.05).toFixed(2))))}
                                className="w-5 h-5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="2.5"
                            step="0.05"
                            value={zoomVal}
                            onChange={(e) => updateCoord(sub.inquiryId, 'photoZoom', Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                          />
                        </div>

                        {/* Vertical Shift Slider */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                              Vertical Shift ({offsetVal}px)
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateCoord(sub.inquiryId, 'photoOffsetY', offsetVal - 10)}
                                className="w-5 h-5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center cursor-pointer"
                                title="Move Up"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => updateCoord(sub.inquiryId, 'photoOffsetY', offsetVal + 10)}
                                className="w-5 h-5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center cursor-pointer"
                                title="Move Down"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateCoord(sub.inquiryId, 'photoZoom', 1.0);
                                  updateCoord(sub.inquiryId, 'photoOffsetY', 0);
                                }}
                                className="px-1.5 h-5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-500 font-bold text-[10px] flex items-center justify-center cursor-pointer"
                                title="Reset"
                              >
                                ↺
                              </button>
                            </div>
                          </div>
                          <input
                            type="range"
                            min="-300"
                            max="300"
                            step="5"
                            value={offsetVal}
                            onChange={(e) => updateCoord(sub.inquiryId, 'photoOffsetY', Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer with Batch Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 font-medium">
            Ready to export: <strong className="text-slate-900">{selectedCount}</strong> framed couple photos
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleDownloadRawZip}
              disabled={zipping || selectedCount === 0}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              <span>Raw Photos ZIP</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadFramedZip}
              disabled={zipping || selectedCount === 0}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs transition-all shadow-md cursor-pointer flex items-center gap-2 active:scale-95"
            >
              {zipping ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{zipProgress || 'Processing...'}</span>
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4" />
                  <span>Save All &amp; Download Framed ZIP ({selectedCount})</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
