'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import JSZip from 'jszip';
import { useAdmin } from '../context/AdminContext';
import { registrationsApi } from '../../../services/admin/registrationsApi';
import { Submission } from '../../../types';
import { API_BASE_URL } from '../../../config';
import {
  XIcon,
  SearchIcon,
  DownloadIcon,
  SparklesIcon,
  CheckCircleIcon,
  CameraIcon,
  CheckIcon
} from '../../../components/Icons';
import { LuxurySelect } from '../../../components/LuxurySelect';
import toast from 'react-hot-toast';

interface FrameReviewExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProgramId?: string;
}

// Token matching algorithm matching legacy system
export const matchCplToken = (inquiryId: string, searchToken: string, isBulk: boolean) => {
  const id = inquiryId.trim().toUpperCase();
  const token = searchToken.trim().toUpperCase();

  if (id === token) return true;

  if (token.startsWith('CPL-') || token.startsWith('IP-') || token.includes('-IP-') || /^EK\d+-(IP-)?\d+$/i.test(token)) {
    return id === token;
  }

  if (/^\d+$/.test(token)) {
    return id.endsWith(`-${token}`) || id.endsWith(token);
  }

  if (isBulk) return false;

  return id.includes(token);
};

export const resolvePhotoUrl = (photoPath: string): string => {
  if (!photoPath) return '';
  if (
    photoPath.startsWith('data:') ||
    photoPath.startsWith('http://') ||
    photoPath.startsWith('https://')
  ) {
    return photoPath;
  }
  return `${API_BASE_URL}${photoPath.startsWith('/') ? photoPath : `/${photoPath}`}`;
};

/**
 * Cloudinary fast thumbnail / preview optimizer:
 * Converts raw 5-15MB camera uploads into super-fast ~25KB WebP/JPEGs
 */
export const getOptimizedPhotoUrl = (url: string, width = 384, height = 512): string => {
  if (!url) return '';
  const full = resolvePhotoUrl(url);
  if (full.includes('res.cloudinary.com') && full.includes('/image/upload/')) {
    if (!full.includes('/image/upload/w_') && !full.includes('/image/upload/c_')) {
      return full.replace(
        '/image/upload/',
        `/image/upload/w_${width},h_${height},c_limit,q_auto:good,f_auto/`
      );
    }
  }
  return full;
};

// Global memory cache for loaded images to eliminate redundant network fetches
const imageMemoryCache = new Map<string, HTMLImageElement>();

/**
 * High-performance, CORS-safe image loader with Blob URL creation to guarantee
 * that HTML5 Canvas is NEVER tainted during preview or export.
 */
export const loadSafeCanvasImage = async (
  src: string,
  timeoutMs: number = 15000
): Promise<HTMLImageElement | null> => {
  if (!src) return null;
  if (imageMemoryCache.has(src)) {
    return imageMemoryCache.get(src)!;
  }

  let safeSrc = src;
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    safeSrc.startsWith('http://')
  ) {
    safeSrc = safeSrc.replace('http://', 'https://');
  }

  // Method 1: Fetch as Blob to create same-origin blob: URL (100% immune to canvas tainting)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(safeSrc, { mode: 'cors', signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const img = new Image();
      const loadedImg = await new Promise<HTMLImageElement | null>((resolve) => {
        img.onload = () => resolve(img);
        img.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          resolve(null);
        };
        img.src = blobUrl;
      });

      if (loadedImg) {
        imageMemoryCache.set(src, loadedImg);
        return loadedImg;
      }
    }
  } catch {
    // Fall back to Image with crossOrigin
  }

  // Method 2: Standard crossOrigin with cache-buster
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const cacheBusted = safeSrc.includes('?')
      ? `${safeSrc}&cb=${Date.now()}`
      : `${safeSrc}?cb=${Date.now()}`;

    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      resolve(null);
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      imageMemoryCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = cacheBusted;
  });
};

/**
 * Concurrency helper for batch tasks to prevent Cloudinary rate limits and browser memory overload
 */
async function asyncPool<T, R>(
  poolLimit: number,
  items: T[],
  iteratorFn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const ret: Promise<R>[] = [];
  const executing: Promise<any>[] = [];
  for (let i = 0; i < items.length; i++) {
    const p = Promise.resolve().then(() => iteratorFn(items[i], i));
    ret.push(p);
    if (poolLimit <= items.length) {
      const e: Promise<any> = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

/**
 * Optimized LivePreviewCanvas:
 * Uses IntersectionObserver so offscreen cards NEVER make network calls or run 2D canvas context renders.
 * Only visible cards render live frame composites.
 */
const LivePreviewCanvas: React.FC<{
  sub: Submission;
  frameImg: HTMLImageElement | null;
}> = ({ sub, frameImg }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [coupleImg, setCoupleImg] = useState<HTMLImageElement | null>(null);
  const [loadingImg, setLoadingImg] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Lazy visibility observer: only load when scrolled into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '250px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fetch photo when visible
  useEffect(() => {
    if (!isVisible) return;
    let isMounted = true;
    if (!sub.couplePhoto) {
      setCoupleImg(null);
      setLoadingImg(false);
      setLoadError(false);
      return;
    }

    setLoadingImg(true);
    setLoadError(false);
    const optimizedUrl = getOptimizedPhotoUrl(sub.couplePhoto, 384, 512);

    loadSafeCanvasImage(optimizedUrl, 12000).then((img) => {
      if (!isMounted) return;
      if (img) {
        setCoupleImg(img);
        setLoadError(false);
      } else {
        setCoupleImg(null);
        setLoadError(true);
      }
      setLoadingImg(false);
    });

    return () => {
      isMounted = false;
    };
  }, [isVisible, sub.couplePhoto, reloadTrigger]);

  // Render on canvas
  useEffect(() => {
    if (!isVisible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 384;
    canvas.height = 512;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
      const ox = offsetX - (w - tempW) / 2 + (sub.photoOffsetX ?? 0) / 2;
      const oy = offsetY - (h - tempH) / 2 + (sub.photoOffsetY ?? 0) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.rect(startX, startY, drawWidth, drawHeight);
      ctx.clip();
      ctx.drawImage(coupleImg, startX + ox, startY + oy, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(startX, startY, drawWidth, drawHeight);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      if (loadingImg) {
        ctx.fillText('Loading...', canvas.width / 2, canvas.height / 2);
      } else if (loadError) {
        ctx.fillStyle = '#f43f5e';
        ctx.fillText('Load failed', canvas.width / 2, canvas.height / 2 - 8);
        ctx.font = '9px sans-serif';
        ctx.fillText('Tap to retry', canvas.width / 2, canvas.height / 2 + 10);
      } else {
        ctx.fillText('No photo', canvas.width / 2, canvas.height / 2);
      }
    }

    // Draw frame overlay
    if (frameImg) {
      ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
    }

    // Draw Token ID text at bottom
    ctx.save();
    ctx.fillStyle = '#7a0c0c';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sub.inquiryId, canvas.width / 2, canvas.height * 0.95);
    ctx.restore();
  }, [isVisible, coupleImg, frameImg, sub.photoZoom, sub.photoOffsetX, sub.photoOffsetY, sub.inquiryId, loadingImg, loadError]);

  return (
    <div
      ref={containerRef}
      onClick={() => {
        if (loadError) {
          if (sub.couplePhoto) {
            imageMemoryCache.delete(getOptimizedPhotoUrl(sub.couplePhoto, 384, 512));
          }
          setReloadTrigger((v) => v + 1);
        }
      }}
      className={`w-[110px] h-[146px] sm:w-[124px] sm:h-[165px] relative rounded-2xl overflow-hidden border bg-slate-900 shrink-0 shadow-inner ${
        loadError ? 'border-rose-300 cursor-pointer' : 'border-slate-200'
      }`}
      title={loadError ? 'Click to retry loading photo' : 'Live Frame Preview'}
    >
      {isVisible ? (
        <canvas ref={canvasRef} className="w-full h-full object-contain block" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-100">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {loadingImg && isVisible && (
        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export const FrameReviewExportModal: React.FC<FrameReviewExportModalProps> = ({
  isOpen,
  onClose,
  defaultProgramId = ''
}) => {
  const { programs } = useAdmin();
  const [mounted, setMounted] = useState(false);

  // Portal mount check
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll completely while modal is open to eliminate outer blank area scrollbars
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Selection & Filtering state
  const [selectedProgramId, setSelectedProgramId] = useState<string>(defaultProgramId || '');
  const [cplSearchQuery, setCplSearchQuery] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedInquiryIds, setSelectedInquiryIds] = useState<string[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Expanded sliders state for mobile responsiveness
  const [expandedAlignIds, setExpandedAlignIds] = useState<Record<string, boolean>>({});

  // Global Frame Image
  const [globalFrameImg, setGlobalFrameImg] = useState<HTMLImageElement | null>(null);

  // Export & Progress state
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState('');
  const [zipPercent, setZipPercent] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedSuccessIds, setSavedSuccessIds] = useState<Record<string, boolean>>({});
  const [printStatusFilter, setPrintStatusFilter] = useState<'ALL' | 'UNPRINTED' | 'MODIFIED' | 'EXPORTED'>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('PAID');

  // Auto-save debounce ref & map
  const autoSaveTimerRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [autoSavingMap, setAutoSavingMap] = useState<Record<string, 'saving' | 'saved'>>({});

  // Sync defaultProgramId on open
  useEffect(() => {
    if (isOpen) {
      if (defaultProgramId && defaultProgramId !== 'all') {
        setSelectedProgramId(defaultProgramId);
      } else if (!selectedProgramId && programs.length > 0) {
        setSelectedProgramId(programs[0].id);
      }
    }
  }, [isOpen, defaultProgramId, programs, selectedProgramId]);

  // Pre-load frame template PNG
  useEffect(() => {
    if (!isOpen) return;
    loadSafeCanvasImage('/frame_template.png').then((img) => {
      setGlobalFrameImg(img);
    });
  }, [isOpen]);

  // Fetch submissions with couple photos
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
        limit: 5000
      });

      const selectedProg = programs.find((p) => p.id === selectedProgramId);
      const rawList = res.submissions || [];
      const list = rawList.filter((s) => {
        if (!s.couplePhoto) return false;
        if (selectedProgramId === 'all') return true;
        return (
          s.programId === selectedProgramId ||
          (selectedProg?.slug && s.programId === selectedProg.slug) ||
          (selectedProg?.date && s.programDate === selectedProg.date)
        );
      });

      setSubmissions(list);
    } catch (err) {
      console.error('Failed to fetch submissions for frames:', err);
      toast.error('Failed to load registrations with photos.');
    } finally {
      setLoadingSubmissions(false);
    }
  }, [selectedProgramId, programs]);

  useEffect(() => {
    if (isOpen) {
      fetchSubmissionsForFrames();
    }
  }, [isOpen, fetchSubmissionsForFrames]);

  // Cohort filtered by Payment Status
  const currentCohort = useMemo(() => {
    return submissions.filter((sub) => {
      const isPaid = sub.status === 'approved' || sub.payment?.status === 'captured';
      if (paymentFilter === 'PAID') return isPaid;
      if (paymentFilter === 'PENDING') return !isPaid;
      return true;
    });
  }, [submissions, paymentFilter]);

  const totalAllCount = submissions.length;
  const paidCount = submissions.filter((s) => s.status === 'approved' || s.payment?.status === 'captured').length;
  const pendingCount = submissions.filter((s) => s.status !== 'approved' && s.payment?.status !== 'captured').length;

  const totalCount = currentCohort.length;
  const unprintedCount = currentCohort.filter((s) => !s.frameExportStatus || s.frameExportStatus === 'NOT_EXPORTED').length;
  const modifiedCount = currentCohort.filter((s) => s.frameExportStatus === 'MODIFIED').length;
  const exportedCount = currentCohort.filter((s) => s.frameExportStatus === 'EXPORTED').length;

  // Filtered submissions based on search tokens
  const searchedTokens = useMemo(() => {
    return cplSearchQuery
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }, [cplSearchQuery]);

  const isBulkSearch = searchedTokens.length > 1;

  const filteredSubmissions = useMemo(() => {
    return currentCohort.filter((sub) => {
      if (printStatusFilter === 'UNPRINTED') {
        if (sub.frameExportStatus && sub.frameExportStatus !== 'NOT_EXPORTED') return false;
      } else if (printStatusFilter === 'MODIFIED') {
        if (sub.frameExportStatus !== 'MODIFIED') return false;
      } else if (printStatusFilter === 'EXPORTED') {
        if (sub.frameExportStatus !== 'EXPORTED') return false;
      }

      if (!cplSearchQuery.trim()) return true;
      return searchedTokens.some((token) => matchCplToken(sub.inquiryId, token, isBulkSearch));
    });
  }, [currentCohort, printStatusFilter, cplSearchQuery, searchedTokens, isBulkSearch]);

  // Selected items in current filter
  const selectedFilteredSubmissions = useMemo(() => {
    const idSet = new Set(selectedInquiryIds);
    return filteredSubmissions.filter((s) => idSet.has(s.inquiryId));
  }, [filteredSubmissions, selectedInquiryIds]);

  const selectedCount = selectedFilteredSubmissions.length;

  // Auto-sync selection when cohort changes
  const prevCohortKeyRef = useRef<string>('');
  useEffect(() => {
    const cohortKey = `${selectedProgramId}_${paymentFilter}`;
    if (prevCohortKeyRef.current !== cohortKey) {
      prevCohortKeyRef.current = cohortKey;
      setSelectedInquiryIds(filteredSubmissions.map((s) => s.inquiryId));
    }
  }, [selectedProgramId, paymentFilter, filteredSubmissions]);

  // Debounced Auto-Save trigger
  const triggerAutoSave = (sub: Submission) => {
    if (autoSaveTimerRef.current[sub.inquiryId]) {
      clearTimeout(autoSaveTimerRef.current[sub.inquiryId]);
    }
    setAutoSavingMap((prev) => ({ ...prev, [sub.inquiryId]: 'saving' }));
    autoSaveTimerRef.current[sub.inquiryId] = setTimeout(async () => {
      try {
        await registrationsApi.updateSubmission(sub.inquiryId, {
          photoZoom: sub.photoZoom ?? 1.0,
          photoOffsetX: sub.photoOffsetX ?? 0,
          photoOffsetY: sub.photoOffsetY ?? 0
        });
        setAutoSavingMap((prev) => ({ ...prev, [sub.inquiryId]: 'saved' }));
        setSubmissions((prev) =>
          prev.map((s) =>
            s.inquiryId === sub.inquiryId
              ? {
                  ...s,
                  frameExportStatus: s.frameExportStatus === 'EXPORTED' ? 'MODIFIED' : s.frameExportStatus
                }
              : s
          )
        );
        setTimeout(() => {
          setAutoSavingMap((prev) => {
            const next = { ...prev };
            delete next[sub.inquiryId];
            return next;
          });
        }, 2000);
      } catch (err) {
        console.error('Auto-save error for', sub.inquiryId, err);
      }
    }, 600);
  };

  // Real-time alignment state update
  const updateCoord = (
    inquiryId: string,
    field: 'photoZoom' | 'photoOffsetX' | 'photoOffsetY',
    value: number
  ) => {
    setSubmissions((prev) =>
      prev.map((sub) => {
        if (sub.inquiryId === inquiryId) {
          const updated = { ...sub, [field]: value };
          triggerAutoSave(updated);
          return updated;
        }
        return sub;
      })
    );
  };

  // Save single submission alignment immediately
  const handleSaveSingleAlignment = async (sub: Submission) => {
    try {
      setSavingId(sub.inquiryId);
      await registrationsApi.updateSubmission(sub.inquiryId, {
        photoZoom: sub.photoZoom ?? 1.0,
        photoOffsetX: sub.photoOffsetX ?? 0,
        photoOffsetY: sub.photoOffsetY ?? 0
      });
      setSavedSuccessIds((prev) => ({ ...prev, [sub.inquiryId]: true }));
      setSubmissions((prev) =>
        prev.map((s) =>
          s.inquiryId === sub.inquiryId
            ? {
                ...s,
                photoZoom: sub.photoZoom ?? 1.0,
                photoOffsetX: sub.photoOffsetX ?? 0,
                photoOffsetY: sub.photoOffsetY ?? 0,
                frameExportStatus: s.frameExportStatus === 'EXPORTED' ? 'MODIFIED' : s.frameExportStatus
              }
            : s
        )
      );
      toast.success(`Alignment saved for ${sub.inquiryId}`);
      setTimeout(() => {
        setSavedSuccessIds((prev) => ({ ...prev, [sub.inquiryId]: false }));
      }, 2500);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save alignment.');
    } finally {
      setSavingId(null);
    }
  };

  // Batch Mark Selected as Exported / Unprinted
  const handleMarkSelectedExported = async (status: 'EXPORTED' | 'NOT_EXPORTED') => {
    const targetIds = selectedFilteredSubmissions.map((s) => s.inquiryId);
    if (targetIds.length === 0) {
      toast.error('No registrations selected in the current filter');
      return;
    }
    try {
      await registrationsApi.markFramesExported(targetIds, undefined, status);
      setSubmissions((prev) =>
        prev.map((s) =>
          targetIds.includes(s.inquiryId)
            ? {
                ...s,
                frameExportStatus: status,
                frameExportedAt: status === 'EXPORTED' ? new Date().toISOString() : undefined
              }
            : s
        )
      );
      toast.success(
        status === 'EXPORTED'
          ? `Marked ${targetIds.length} as printed/exported.`
          : `Reset ${targetIds.length} to unprinted.`
      );
    } catch (err: any) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  // Download single framed photo PNG
  const handleDownloadSingleFrame = async (sub: Submission) => {
    if (!sub.couplePhoto) {
      toast.error('No photo available for this registration.');
      return;
    }

    try {
      const toastId = toast.loading(`Preparing frame for ${sub.inquiryId}...`);
      const highResUrl = getOptimizedPhotoUrl(sub.couplePhoto, 1200, 1600);
      const coupleImg = await loadSafeCanvasImage(highResUrl);
      const frameImg = globalFrameImg || (await loadSafeCanvasImage('/frame_template.png'));

      if (!frameImg) {
        toast.dismiss(toastId);
        toast.error('Failed to load frame template.');
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = frameImg.naturalWidth || 768;
      canvas.height = frameImg.naturalHeight || 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        toast.dismiss(toastId);
        return;
      }

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
        const ox = offsetX - (w - tempW) / 2 + (sub.photoOffsetX ?? 0) * (canvas.width / 768);
        const oy = offsetY - (h - tempH) / 2 + (sub.photoOffsetY ?? 0) * (canvas.height / 1024);

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

      const cleanHusband = (sub.husbandName || '').trim().replace(/\s+/g, '_');
      const cleanWife = (sub.wifeName || '').trim().replace(/\s+/g, '_');
      const cleanSurname = (sub.surname || '').trim().replace(/\s+/g, '_');
      const filename = `${sub.inquiryId}_${cleanHusband}_${cleanWife}_${cleanSurname}.png`.replace(
        /[^a-zA-Z0-9_.-]/g,
        '_'
      );

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      toast.dismiss(toastId);

      if (!blob) {
        toast.error('Failed to create frame.');
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Mark single frame exported
      registrationsApi.markFramesExported([sub.inquiryId]).catch(console.error);
      setSubmissions((prev) =>
        prev.map((s) =>
          s.inquiryId === sub.inquiryId
            ? { ...s, frameExportStatus: 'EXPORTED', frameExportedAt: new Date().toISOString() }
            : s
        )
      );

      toast.success(`Downloaded frame for ${sub.inquiryId}`);
    } catch (err: any) {
      toast.error('Failed to download framed photo.');
    }
  };

  // High-Speed, Memory-Safe Batch Framed Photos ZIP Generation
  const handleDownloadFramedZip = async () => {
    const listToExport = filteredSubmissions.filter((s) => selectedInquiryIds.includes(s.inquiryId));
    if (listToExport.length === 0) {
      toast.error('No selected registrations to download in current filter.');
      return;
    }

    try {
      setZipping(true);
      setZipProgress('Starting...');
      setZipPercent(0);
      const zip = new JSZip();

      const frameImg = globalFrameImg || (await loadSafeCanvasImage('/frame_template.png'));
      if (!frameImg) throw new Error('Could not load frame template');

      const successfullyExportedIds: string[] = [];
      let completedCount = 0;

      // 3 concurrent workers to eliminate Cloudinary rate limits and prevent memory spikes
      await asyncPool(3, listToExport, async (sub) => {
        try {
          let coupleImg: HTMLImageElement | null = null;
          if (sub.couplePhoto) {
            const highResPhotoUrl = getOptimizedPhotoUrl(sub.couplePhoto, 1200, 1600);
            coupleImg = await loadSafeCanvasImage(highResPhotoUrl, 15000);
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
            const ox = offsetX - (w - tempW) / 2 + (sub.photoOffsetX ?? 0) * (canvas.width / 768);
            const oy = offsetY - (h - tempH) / 2 + (sub.photoOffsetY ?? 0) * (canvas.height / 1024);

            ctx.save();
            ctx.beginPath();
            ctx.rect(startX, startY, drawWidth, drawHeight);
            ctx.clip();
            ctx.drawImage(coupleImg, startX + ox, startY + oy, w, h);
            ctx.restore();
          } else {
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(startX, startY, drawWidth, drawHeight);
            ctx.fillStyle = '#64748b';
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Photo Pending', canvas.width / 2, canvas.height / 2);
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

          // Direct Blob streaming - zero base64 memory overhead!
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
          if (blob) {
            const cleanHusband = (sub.husbandName || '').trim().replace(/\s+/g, '_');
            const cleanWife = (sub.wifeName || '').trim().replace(/\s+/g, '_');
            const cleanSurname = (sub.surname || '').trim().replace(/\s+/g, '_');
            const filename = `${sub.inquiryId}_${cleanHusband}_${cleanWife}_${cleanSurname}.png`.replace(
              /[^a-zA-Z0-9_.-]/g,
              '_'
            );
            zip.file(filename, blob);
            successfullyExportedIds.push(sub.inquiryId);
          }
        } catch (subErr) {
          console.error('Error framing photo for submission:', sub.inquiryId, subErr);
        } finally {
          completedCount++;
          const pct = Math.round((completedCount / listToExport.length) * 80);
          setZipPercent(pct);
          setZipProgress(`Processing ${completedCount} of ${listToExport.length} (${sub.inquiryId})...`);
        }
      });

      // Generate Printing Manifest CSV
      const curProg = programs.find((p) => p.id === selectedProgramId);
      const progName = curProg ? curProg.name : 'Event';

      let manifestCsv =
        'Token ID,Husband Name,Wife Name,Surname,Mobile Number,Print Status,Payment Status,Zoom,Offset Y,Printed Checkbox,Desk Handover Checkbox\n';
      listToExport.forEach((sub) => {
        const pStatus =
          sub.frameExportStatus === 'EXPORTED'
            ? 'Already Exported'
            : sub.frameExportStatus === 'MODIFIED'
            ? 'Adjusted'
            : 'New';
        const payStatus = sub.status === 'approved' || sub.payment?.status === 'captured' ? 'PAID' : 'PENDING';
        manifestCsv += `"${sub.inquiryId}","${sub.husbandName}","${sub.wifeName}","${sub.surname || ''}","${
          sub.phoneNumber || ''
        }","${pStatus}","${payStatus}","${sub.photoZoom ?? 1.0}","${sub.photoOffsetY ?? 0}","[  ] Printed","[  ] Handed Over"\n`;
      });
      zip.file(`Printing_Manifest_${progName.replace(/\s+/g, '_')}.csv`, manifestCsv);

      setZipProgress('Compressing ZIP archive...');
      // Fast compression level 2 (4x faster, minimal memory)
      const content = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 2 } },
        (metadata) => {
          setZipPercent(80 + Math.round((metadata.percent / 100) * 20));
          setZipProgress(`Compressing ZIP: ${Math.round(metadata.percent)}%`);
        }
      );

      const payTag = paymentFilter === 'PAID' ? 'PAID' : paymentFilter === 'PENDING' ? 'PENDING' : 'ALL';
      const a = document.createElement('a');
      const blobUrl = URL.createObjectURL(content);
      a.href = blobUrl;
      a.download = `${progName}_${payTag}_framed_photos.zip`.replace(/\s+/g, '_');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      if (successfullyExportedIds.length > 0) {
        registrationsApi.markFramesExported(successfullyExportedIds, undefined, 'EXPORTED').catch(console.error);
        setSubmissions((prev) =>
          prev.map((s) =>
            successfullyExportedIds.includes(s.inquiryId)
              ? { ...s, frameExportStatus: 'EXPORTED', frameExportedAt: new Date().toISOString() }
              : s
          )
        );
      }

      toast.success(`Successfully downloaded ${successfullyExportedIds.length} framed photos!`);
    } catch (err: any) {
      toast.error('Error creating ZIP: ' + err.message);
    } finally {
      setZipping(false);
      setZipProgress('');
      setZipPercent(null);
    }
  };

  // Raw Photos ZIP Download
  const handleDownloadRawZip = async () => {
    const listToExport = filteredSubmissions.filter((s) => selectedInquiryIds.includes(s.inquiryId));
    if (listToExport.length === 0) {
      toast.error('No selected registrations to download in current filter.');
      return;
    }

    try {
      setZipping(true);
      setZipProgress('Starting...');
      setZipPercent(0);
      const zip = new JSZip();
      let completedCount = 0;

      await asyncPool(3, listToExport, async (sub) => {
        if (!sub.couplePhoto) {
          completedCount++;
          return;
        }
        try {
          const photoUrl = resolvePhotoUrl(sub.couplePhoto);
          const res = await fetch(photoUrl, { mode: 'cors' });
          if (res.ok) {
            const blob = await res.blob();
            let ext = 'jpg';
            const contentType = res.headers.get('content-type');
            if (contentType?.includes('png')) ext = 'png';
            else if (contentType?.includes('webp')) ext = 'webp';
            zip.file(`${sub.inquiryId}.${ext}`, blob);
          }
        } catch (err) {
          console.error('Error fetching raw photo:', sub.inquiryId, err);
        } finally {
          completedCount++;
          const pct = Math.round((completedCount / listToExport.length) * 80);
          setZipPercent(pct);
          setZipProgress(`Fetching photo ${completedCount} of ${listToExport.length}...`);
        }
      });

      setZipProgress('Compressing ZIP archive...');
      const content = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 2 } },
        (metadata) => {
          setZipPercent(80 + Math.round((metadata.percent / 100) * 20));
          setZipProgress(`Compressing raw photos: ${Math.round(metadata.percent)}%`);
        }
      );

      const curProg = programs.find((p) => p.id === selectedProgramId);
      const progName = curProg ? curProg.name : 'Event';
      const a = document.createElement('a');
      const blobUrl = URL.createObjectURL(content);
      a.href = blobUrl;
      const payTag = paymentFilter === 'PAID' ? 'PAID' : paymentFilter === 'PENDING' ? 'PENDING' : 'ALL';
      a.download = `${progName}_${payTag}_raw_photos.zip`.replace(/\s+/g, '_');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      toast.success(`Downloaded ${listToExport.length} raw photos.`);
    } catch (err: any) {
      toast.error('Failed to download raw photos ZIP: ' + err.message);
    } finally {
      setZipping(false);
      setZipProgress('');
      setZipPercent(null);
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 w-full max-w-5xl h-full sm:max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* Modal Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50/60 via-white to-rose-50/60 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-100/80 border border-amber-200 text-amber-700 flex items-center justify-center shadow-xs shrink-0">
              <CameraIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className="text-sm sm:text-lg font-extrabold text-slate-900 tracking-tight truncate">
                  Photo Frame Review &amp; Export
                </h2>
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                  Live Canvas
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate hidden sm:block">
                Inspect, align with zoom &amp; shift, and download high-resolution framed photos individually or in bulk ZIP.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            aria-label="Close Modal"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Top Controls Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/80 space-y-2.5 shrink-0">
          {/* Responsive Selector Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
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

            {/* Payment Filter using LuxurySelect with live counts */}
            <div className="sm:col-span-3">
              <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                Payment Type
              </label>
              <LuxurySelect
                value={paymentFilter}
                onChange={(val) => setPaymentFilter(val as any)}
                options={[
                  { value: 'PAID', label: 'Paid / Approved', badge: String(paidCount) },
                  { value: 'PENDING', label: 'Payment Pending', badge: String(pendingCount) },
                  { value: 'ALL', label: 'All Cohort', badge: String(totalAllCount) }
                ]}
                variant="outline"
              />
            </div>

            {/* Token / Name Search */}
            <div className="sm:col-span-5">
              <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                Search / Filter Tokens
              </label>
              <div className="relative flex items-center bg-white border border-slate-300 rounded-xl px-2.5 sm:px-3 py-1.5 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/10 transition-all">
                <SearchIcon className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={cplSearchQuery}
                  onChange={(e) => setCplSearchQuery(e.target.value)}
                  placeholder="Paste tokens, couple name, phone..."
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

          {/* Print Status Filter Pills - Horizontally scrollable on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1.5 border-t border-slate-200/70">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider shrink-0 mr-0.5">
                Print Status:
              </span>

              <button
                type="button"
                onClick={() => {
                  setPrintStatusFilter('ALL');
                  setSelectedInquiryIds(currentCohort.map((s) => s.inquiryId));
                }}
                className={`px-2.5 py-1 rounded-xl font-bold transition-all text-xs cursor-pointer shrink-0 ${
                  printStatusFilter === 'ALL'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                }`}
              >
                All ({totalCount})
              </button>

              <button
                type="button"
                onClick={() => {
                  setPrintStatusFilter('UNPRINTED');
                  const unprinted = currentCohort.filter((s) => !s.frameExportStatus || s.frameExportStatus === 'NOT_EXPORTED');
                  setSelectedInquiryIds(unprinted.map((s) => s.inquiryId));
                }}
                className={`px-2.5 py-1 rounded-xl font-bold transition-all text-xs cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  printStatusFilter === 'UNPRINTED'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                }`}
              >
                <span>New / Unprinted</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  printStatusFilter === 'UNPRINTED' ? 'bg-rose-700 text-white' : 'bg-rose-200 text-rose-800'
                }`}>
                  {unprintedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPrintStatusFilter('MODIFIED');
                  const modified = currentCohort.filter((s) => s.frameExportStatus === 'MODIFIED');
                  setSelectedInquiryIds(modified.map((s) => s.inquiryId));
                }}
                className={`px-2.5 py-1 rounded-xl font-bold transition-all text-xs cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  printStatusFilter === 'MODIFIED'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                <span>Adjusted</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  printStatusFilter === 'MODIFIED' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-800'
                }`}>
                  {modifiedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPrintStatusFilter('EXPORTED');
                  const exp = currentCohort.filter((s) => s.frameExportStatus === 'EXPORTED');
                  setSelectedInquiryIds(exp.map((s) => s.inquiryId));
                }}
                className={`px-2.5 py-1 rounded-xl font-bold transition-all text-xs cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  printStatusFilter === 'EXPORTED'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                <span>Already Printed</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  printStatusFilter === 'EXPORTED' ? 'bg-emerald-700 text-white' : 'bg-emerald-200 text-emerald-800'
                }`}>
                  {exportedCount}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleMarkSelectedExported('EXPORTED')}
                disabled={selectedCount === 0}
                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-xs cursor-pointer flex items-center gap-1"
                title="Manually mark selected as printed"
              >
                <CheckCircleIcon className="w-3 h-3" />
                <span>Mark Printed</span>
              </button>
              <button
                type="button"
                onClick={() => handleMarkSelectedExported('NOT_EXPORTED')}
                disabled={selectedCount === 0}
                className="px-2 py-1 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 border border-slate-300 rounded-lg font-bold text-xs cursor-pointer flex items-center gap-1"
                title="Reset selected to unprinted status"
              >
                <span>Reset Status</span>
              </button>
            </div>
          </div>

          {/* Selection Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedInquiryIds(filteredSubmissions.map((s) => s.inquiryId))}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-2xs"
              >
                Select All ({filteredSubmissions.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  const filteredIds = new Set(filteredSubmissions.map((s) => s.inquiryId));
                  setSelectedInquiryIds((prev) => prev.filter((id) => !filteredIds.has(id)));
                }}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-2xs"
              >
                Deselect
              </button>
              <button
                type="button"
                onClick={() => setSelectedInquiryIds([])}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl font-bold transition-all text-xs cursor-pointer"
              >
                Clear
              </button>
            </div>

            <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <span>
                Selected: <strong className="text-rose-700">{selectedCount}</strong> / {filteredSubmissions.length}
              </span>
              {filteredSubmissions.length !== submissions.length && (
                <span className="text-[10px] text-slate-400">
                  ({submissions.length} total)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Main List Area with Lazy-Loaded Real-Time Frame Canvases */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 bg-slate-100/60 min-h-0">
          {loadingSubmissions ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-600">Loading registrations with photos...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="py-16 sm:py-20 text-center space-y-3 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <CameraIcon className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900">No Registrations with Photos Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {cplSearchQuery.trim()
                  ? 'No registrations match your search criteria. Try modifying your search or clearing the query.'
                  : `There are no ${paymentFilter === 'PAID' ? 'paid' : paymentFilter === 'PENDING' ? 'pending' : ''} registrations with couple photos for the selected session.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredSubmissions.map((sub) => {
                const isSelected = selectedInquiryIds.includes(sub.inquiryId);
                const zoomVal = sub.photoZoom ?? 1.0;
                const offsetValX = sub.photoOffsetX ?? 0;
                const offsetValY = sub.photoOffsetY ?? 0;
                const isSaving = savingId === sub.inquiryId;
                const isSaved = savedSuccessIds[sub.inquiryId];
                const autoSaveState = autoSavingMap[sub.inquiryId];
                const isPaid = sub.status === 'approved' || sub.payment?.status === 'captured';
                const isAlignOpen = Boolean(expandedAlignIds[sub.inquiryId]);

                return (
                  <div
                    key={sub.inquiryId}
                    className={`bg-white border rounded-2xl p-3 sm:p-4 transition-all shadow-xs flex flex-col gap-3 ${
                      isSelected
                        ? 'border-amber-400 ring-1 ring-amber-500/20 bg-gradient-to-r from-amber-50/20 to-white'
                        : 'border-slate-200/90 opacity-85 hover:opacity-100'
                    }`}
                  >
                    {/* Top Row: Checkbox + Names + Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedInquiryIds((prev) =>
                              isSelected
                                ? prev.filter((id) => id !== sub.inquiryId)
                                : [...prev, sub.inquiryId]
                            );
                          }}
                          className="w-4 h-4 rounded text-amber-600 accent-amber-600 cursor-pointer mt-0.5 shrink-0"
                          aria-label={`Select ${sub.inquiryId}`}
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm leading-tight truncate">
                              {sub.husbandName} &amp; {sub.wifeName} {sub.surname}
                            </h4>
                            <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-rose-50 text-rose-700 border border-rose-200 rounded-md shrink-0">
                              {sub.inquiryId}
                            </span>

                            {/* Payment Status Badge */}
                            {sub.isVip ? (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800 border border-purple-300">
                                ★ VIP
                              </span>
                            ) : isPaid ? (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5">
                                <CheckIcon className="w-2.5 h-2.5" />
                                <span>PAID</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                                ⏳ PENDING
                              </span>
                            )}

                            {/* Print Status Badge */}
                            {sub.frameExportStatus === 'EXPORTED' ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                                <CheckIcon className="w-2.5 h-2.5" />
                                <span>Printed</span>
                              </span>
                            ) : sub.frameExportStatus === 'MODIFIED' ? (
                              <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                ⚠ Adjusted
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                New
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                            Phone: {sub.phoneNumber} &bull; {sub.programName}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons on Top Right */}
                      <div className="flex items-center gap-1 shrink-0">
                        {autoSaveState === 'saving' ? (
                          <span className="text-[9px] font-bold text-amber-600 flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            <div className="w-2 h-2 border border-amber-600 border-t-transparent rounded-full animate-spin" />
                            <span>Saving...</span>
                          </span>
                        ) : autoSaveState === 'saved' ? (
                          <span className="text-[9px] font-bold text-emerald-700 flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <CheckIcon className="w-2.5 h-2.5" />
                            <span>Saved</span>
                          </span>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handleSaveSingleAlignment(sub)}
                          disabled={isSaving}
                          className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border cursor-pointer ${
                            isSaved
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                          title="Instant Save Zoom and Position"
                        >
                          {isSaving ? (
                            <div className="w-3 h-3 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                          ) : isSaved ? (
                            <>
                              <CheckIcon className="w-3 h-3 text-emerald-600" />
                              <span className="hidden sm:inline">Saved</span>
                            </>
                          ) : (
                            <span>Save</span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadSingleFrame(sub)}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title="Download single high-res framed PNG"
                        >
                          <DownloadIcon className="w-3 h-3" />
                          <span className="hidden sm:inline">PNG</span>
                        </button>

                        {/* Mobile Toggle Alignment Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedAlignIds((prev) => ({
                              ...prev,
                              [sub.inquiryId]: !prev[sub.inquiryId]
                            }));
                          }}
                          className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 sm:hidden ${
                            isAlignOpen
                              ? 'bg-amber-600 text-white border-amber-700'
                              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                          }`}
                          title="Toggle Alignment Sliders"
                        >
                          <span>{isAlignOpen ? 'Hide' : 'Align ⚙️'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Middle: Canvas + Sliders */}
                    <div className="flex flex-col sm:flex-row items-start gap-3 w-full">
                      {/* Live Canvas */}
                      <LivePreviewCanvas sub={sub} frameImg={globalFrameImg} />

                      {/* Sliders Container: Always visible on desktop, toggleable on mobile */}
                      <div className={`flex-1 w-full ${isAlignOpen ? 'block' : 'hidden sm:block'}`}>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50/90 p-2.5 sm:p-3 rounded-xl border border-slate-200/80">
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
                                <button
                                  type="button"
                                  onClick={() => updateCoord(sub.inquiryId, 'photoZoom', 1.0)}
                                  className="px-1.5 h-5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-500 font-bold text-[10px] flex items-center justify-center cursor-pointer"
                                  title="Reset Zoom"
                                >
                                  1x
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
                              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                            />
                          </div>

                          {/* Left / Right Slider */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                                ◄ Left / Right ► ({offsetValX > 0 ? `+${offsetValX}` : offsetValX}px)
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateCoord(sub.inquiryId, 'photoOffsetX', offsetValX - 10)}
                                  className="w-5 h-5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center cursor-pointer"
                                  title="Shift Left"
                                >
                                  ◄
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateCoord(sub.inquiryId, 'photoOffsetX', offsetValX + 10)}
                                  className="w-5 h-5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center cursor-pointer"
                                  title="Shift Right"
                                >
                                  ►
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateCoord(sub.inquiryId, 'photoOffsetX', 0)}
                                  className="px-1.5 h-5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-500 font-bold text-[10px] flex items-center justify-center cursor-pointer"
                                  title="Center Horizontally"
                                >
                                  0
                                </button>
                              </div>
                            </div>
                            <input
                              type="range"
                              min="-300"
                              max="300"
                              step="5"
                              value={offsetValX}
                              onChange={(e) => updateCoord(sub.inquiryId, 'photoOffsetX', Number(e.target.value))}
                              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                          </div>

                          {/* Up / Down Slider */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                                ▲ Up / Down ▼ ({offsetValY > 0 ? `+${offsetValY}` : offsetValY}px)
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateCoord(sub.inquiryId, 'photoOffsetY', offsetValY - 10)}
                                  className="w-5 h-5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center cursor-pointer"
                                  title="Move Up"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateCoord(sub.inquiryId, 'photoOffsetY', offsetValY + 10)}
                                  className="w-5 h-5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center cursor-pointer"
                                  title="Move Down"
                                >
                                  ▼
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateCoord(sub.inquiryId, 'photoZoom', 1.0);
                                    updateCoord(sub.inquiryId, 'photoOffsetX', 0);
                                    updateCoord(sub.inquiryId, 'photoOffsetY', 0);
                                  }}
                                  className="px-1.5 h-5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-500 font-bold text-[10px] flex items-center justify-center cursor-pointer"
                                  title="Reset Alignment"
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
                              value={offsetValY}
                              onChange={(e) => updateCoord(sub.inquiryId, 'photoOffsetY', Number(e.target.value))}
                              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer with High-Speed Batch Actions */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 font-medium text-center sm:text-left w-full sm:w-auto">
            Ready to export: <strong className="text-slate-900 font-extrabold">{selectedCount}</strong> framed photos
            {paymentFilter !== 'ALL' && (
              <span className="text-slate-400 ml-1">({paymentFilter})</span>
            )}
            {zipping && (
              <span className="ml-2 text-rose-600 font-bold animate-pulse">
                {zipProgress}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer flex-1 sm:flex-initial"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleDownloadRawZip}
              disabled={zipping || selectedCount === 0}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              <span>Raw ZIP ({selectedCount})</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadFramedZip}
              disabled={zipping || selectedCount === 0}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              {zipping ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{zipProgress || (zipPercent !== null ? `Zipping (${zipPercent}%)...` : 'Processing...')}</span>
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4" />
                  <span>Download Framed ZIP ({selectedCount})</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
