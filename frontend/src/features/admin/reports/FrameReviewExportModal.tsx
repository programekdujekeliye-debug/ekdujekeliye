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
  CheckIcon,
  UsersIcon
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
export const getOptimizedPhotoUrl = (url: string, width = 360, height = 480): string => {
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

// Global memory cache for loaded images to eliminate network re-fetching
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
 * Concurrency helper for batch tasks
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

  // Body scroll lock to prevent outer blank area scrollbars
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // View state
  const [viewMode, setViewMode] = useState<'studio' | 'gallery'>('studio');
  const [mobileTab, setMobileTab] = useState<'queue' | 'studio'>('studio');

  // Filter state
  const [selectedProgramId, setSelectedProgramId] = useState<string>(defaultProgramId || '');
  const [cplSearchQuery, setCplSearchQuery] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedInquiryIds, setSelectedInquiryIds] = useState<string[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Focused couple in Studio
  const [activeInquiryId, setActiveInquiryId] = useState<string>('');

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

  // Fetch submissions for selected program
  const fetchSubmissionsForFrames = useCallback(async () => {
    if (!selectedProgramId) {
      setSubmissions([]);
      setSelectedInquiryIds([]);
      setActiveInquiryId('');
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
      if (list.length > 0) {
        setActiveInquiryId((prev) => {
          const exists = list.some((item) => item.inquiryId === prev);
          return exists ? prev : list[0].inquiryId;
        });
      }
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

  // Cohort strictly filtered by Payment Status
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

  // Filtered submissions based on payment status, print status, and search tokens
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

  // Active focused submission in Studio
  const activeSubmission = useMemo(() => {
    if (!activeInquiryId) return filteredSubmissions[0] || null;
    return filteredSubmissions.find((s) => s.inquiryId === activeInquiryId) || filteredSubmissions[0] || null;
  }, [filteredSubmissions, activeInquiryId]);

  // Selection Scoping
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
      if (filteredSubmissions.length > 0) {
        setActiveInquiryId(filteredSubmissions[0].inquiryId);
      }
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

  // Instant manual save
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
      toast.success(`Saved alignment for ${sub.inquiryId}`);
      setTimeout(() => {
        setSavedSuccessIds((prev) => ({ ...prev, [sub.inquiryId]: false }));
      }, 2500);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save alignment.');
    } finally {
      setSavingId(null);
    }
  };

  // Toggle Print status
  const handleToggleSinglePrintStatus = async (sub: Submission) => {
    const newStatus = sub.frameExportStatus === 'EXPORTED' ? 'NOT_EXPORTED' : 'EXPORTED';
    try {
      await registrationsApi.markFramesExported([sub.inquiryId], undefined, newStatus);
      setSubmissions((prev) =>
        prev.map((s) =>
          s.inquiryId === sub.inquiryId
            ? {
                ...s,
                frameExportStatus: newStatus,
                frameExportedAt: newStatus === 'EXPORTED' ? new Date().toISOString() : undefined
              }
            : s
        )
      );
      toast.success(newStatus === 'EXPORTED' ? `Marked ${sub.inquiryId} as Printed` : `Reset ${sub.inquiryId} to Unprinted`);
    } catch (err: any) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  // Batch Mark Selected as Exported / Unprinted
  const handleMarkSelectedExported = async (status: 'EXPORTED' | 'NOT_EXPORTED') => {
    const targetIds = selectedFilteredSubmissions.map((s) => s.inquiryId);
    if (targetIds.length === 0) {
      toast.error('No registrations selected');
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
          ? `Marked ${targetIds.length} as printed.`
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
      const toastId = toast.loading(`Rendering high-res frame for ${sub.inquiryId}...`);
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
        const ox = offsetX - (w - tempW) / 2 + ((sub.photoOffsetX ?? 0) * (canvas.width / 768));
        const oy = offsetY - (h - tempH) / 2 + ((sub.photoOffsetY ?? 0) * (canvas.height / 1024));

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
        toast.error('Failed to create framed image.');
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

  // High-Speed, Memory-Safe Batch ZIP Exporter
  const handleDownloadFramedZip = async () => {
    const listToExport = filteredSubmissions.filter((s) => selectedInquiryIds.includes(s.inquiryId));
    if (listToExport.length === 0) {
      toast.error('No selected registrations to download in current filter.');
      return;
    }

    try {
      setZipping(true);
      setZipProgress('Initializing archive...');
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
            const ox = offsetX - (w - tempW) / 2 + ((sub.photoOffsetX ?? 0) * (canvas.width / 768));
            const oy = offsetY - (h - tempH) / 2 + ((sub.photoOffsetY ?? 0) * (canvas.height / 1024));

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

          // Direct Blob conversion - zero base64 memory overhead!
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
        } catch (err) {
          console.error('Batch framing error for:', sub.inquiryId, err);
        } finally {
          completedCount++;
          const pct = Math.round((completedCount / listToExport.length) * 80);
          setZipPercent(pct);
          setZipProgress(`Framed ${completedCount} of ${listToExport.length} (${sub.inquiryId})`);
        }
      });

      // Generate Printing Manifest CSV
      const curProg = programs.find((p) => p.id === selectedProgramId);
      const progName = curProg ? curProg.name : 'Event';

      let manifestCsv =
        'Token ID,Husband Name,Wife Name,Surname,Mobile Number,Print Status,Payment Status,Zoom,Offset X,Offset Y,Printed Checkbox,Desk Handover Checkbox\n';
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
        }","${pStatus}","${payStatus}","${sub.photoZoom ?? 1.0}","${sub.photoOffsetX ?? 0}","${
          sub.photoOffsetY ?? 0
        }","[  ] Printed","[  ] Handed Over"\n`;
      });
      zip.file(`Printing_Manifest_${progName.replace(/\s+/g, '_')}.csv`, manifestCsv);

      setZipProgress('Compressing ZIP archive...');
      // Fast compression level 2 (4x faster, identical size for images)
      const content = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 2 } },
        (metadata) => {
          setZipPercent(80 + Math.round((metadata.percent / 100) * 20));
          setZipProgress(`Compressing: ${Math.round(metadata.percent)}%`);
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
      setZipProgress('Starting raw photo download...');
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
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('png')) ext = 'png';
            else if (ct.includes('webp')) ext = 'webp';
            zip.file(`${sub.inquiryId}.${ext}`, blob);
          }
        } catch (err) {
          console.error('Error fetching raw photo for:', sub.inquiryId, err);
        } finally {
          completedCount++;
          const pct = Math.round((completedCount / listToExport.length) * 80);
          setZipPercent(pct);
          setZipProgress(`Downloaded raw photo ${completedCount} of ${listToExport.length}`);
        }
      });

      setZipProgress('Compressing raw photos archive...');
      const content = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 2 } },
        (metadata) => {
          setZipPercent(80 + Math.round((metadata.percent / 100) * 20));
          setZipProgress(`Compressing: ${Math.round(metadata.percent)}%`);
        }
      );

      const curProg = programs.find((p) => p.id === selectedProgramId);
      const progName = curProg ? curProg.name : 'Event';
      const payTag = paymentFilter === 'PAID' ? 'PAID' : paymentFilter === 'PENDING' ? 'PENDING' : 'ALL';
      const a = document.createElement('a');
      const blobUrl = URL.createObjectURL(content);
      a.href = blobUrl;
      a.download = `${progName}_${payTag}_raw_photos.zip`.replace(/\s+/g, '_');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      toast.success(`Downloaded raw photos ZIP`);
    } catch (err: any) {
      toast.error('Failed to download raw photos: ' + err.message);
    } finally {
      setZipping(false);
      setZipProgress('');
      setZipPercent(null);
    }
  };

  // Keyboard navigation for Studio (Arrow Left/Right)
  useEffect(() => {
    if (!isOpen || viewMode !== 'studio' || filteredSubmissions.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea', 'select'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) {
        return;
      }
      const currentIndex = filteredSubmissions.findIndex((s) => s.inquiryId === activeInquiryId);
      if (e.key === 'ArrowLeft' || e.key === 'k') {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredSubmissions.length - 1;
        setActiveInquiryId(filteredSubmissions[prevIndex].inquiryId);
      } else if (e.key === 'ArrowRight' || e.key === 'j') {
        e.preventDefault();
        const nextIndex = currentIndex < filteredSubmissions.length - 1 ? currentIndex + 1 : 0;
        setActiveInquiryId(filteredSubmissions[nextIndex].inquiryId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, viewMode, filteredSubmissions, activeInquiryId]);

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex flex-col h-[100dvh] w-full bg-slate-950/80 backdrop-blur-md overflow-hidden text-slate-100 animate-in fade-in duration-200">
      
      {/* 1. Ultra-Clean Top Bar */}
      <header className="h-14 sm:h-16 px-3 sm:px-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0 gap-2">
        {/* Left: Branding & Event Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 text-white flex items-center justify-center shadow-md shrink-0">
            <CameraIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs sm:text-base font-extrabold text-white tracking-tight truncate">
                Frame Review Studio
              </h2>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium truncate hidden sm:block">
              Inspect alignment, drag &amp; zoom photo, and export crisp framed prints.
            </p>
          </div>
        </div>

        {/* Center: Program Selector */}
        <div className="hidden md:flex items-center gap-2 max-w-xs w-full">
          <select
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-amber-500 font-bold"
          >
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.date || 'TBA'})
              </option>
            ))}
          </select>
        </div>

        {/* Right: View Switcher & Close */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* View Mode Switcher (Desktop) */}
          <div className="hidden sm:flex bg-slate-800 p-0.5 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('studio')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'studio' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Studio
            </button>
            <button
              type="button"
              onClick={() => setViewMode('gallery')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'gallery' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Gallery ({filteredSubmissions.length})
            </button>
          </div>

          {/* Mobile Tab Switcher */}
          <div className="flex sm:hidden bg-slate-800 p-0.5 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setMobileTab('studio')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                mobileTab === 'studio' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              Studio
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('queue')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                mobileTab === 'queue' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              Queue ({filteredSubmissions.length})
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            aria-label="Close"
          >
            <XIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

      {/* 2. Secondary Filter & Cohort Bar */}
      <div className="px-3 sm:px-5 py-2 sm:py-2.5 border-b border-slate-800/80 bg-slate-900/60 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Payment Cohort Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setPaymentFilter('PAID')}
            className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              paymentFilter === 'PAID'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
            }`}
          >
            <span>Paid</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-700 text-white font-black">
              {paidCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setPaymentFilter('PENDING')}
            className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              paymentFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
            }`}
          >
            <span>Pending</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-700 text-white font-black">
              {pendingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setPaymentFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
              paymentFilter === 'ALL'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
            }`}
          >
            All ({totalAllCount})
          </button>
        </div>

        {/* Print Status Chips */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setPrintStatusFilter('ALL')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer shrink-0 ${
              printStatusFilter === 'ALL' ? 'bg-slate-200 text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setPrintStatusFilter('UNPRINTED')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer shrink-0 flex items-center gap-1 ${
              printStatusFilter === 'UNPRINTED'
                ? 'bg-rose-500 text-white'
                : 'text-rose-400 hover:bg-rose-500/10'
            }`}
          >
            <span>New</span>
            <span className="text-[9px] px-1 rounded-full bg-rose-900/60 text-white">{unprintedCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setPrintStatusFilter('MODIFIED')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer shrink-0 flex items-center gap-1 ${
              printStatusFilter === 'MODIFIED'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <span>Adjusted</span>
            <span className="text-[9px] px-1 rounded-full bg-amber-900/60 text-white">{modifiedCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setPrintStatusFilter('EXPORTED')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer shrink-0 flex items-center gap-1 ${
              printStatusFilter === 'EXPORTED'
                ? 'bg-emerald-500 text-slate-950 font-black'
                : 'text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            <span>Printed</span>
            <span className="text-[9px] px-1 rounded-full bg-emerald-900/60 text-white">{exportedCount}</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative flex items-center bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 w-full sm:w-56">
          <SearchIcon className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
          <input
            type="text"
            value={cplSearchQuery}
            onChange={(e) => setCplSearchQuery(e.target.value)}
            placeholder="Search token, name..."
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 outline-none font-medium"
          />
          {cplSearchQuery && (
            <button
              onClick={() => setCplSearchQuery('')}
              className="text-xs text-slate-400 hover:text-white p-0.5"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Body Container (Pure Flex Child with Zero Outer Overflow) */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row bg-slate-950 overflow-hidden">
        
        {loadingSubmissions ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-400">Loading registrations with photos...</p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center">
              <CameraIcon className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">No Matching Registrations</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              No photos found matching the selected filter criteria or search query.
            </p>
          </div>
        ) : viewMode === 'gallery' ? (
          /* =================== GALLERY GRID VIEW =================== */
          <div className="flex-1 overflow-y-auto p-3 sm:p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredSubmissions.map((sub) => {
                const isSelected = selectedInquiryIds.includes(sub.inquiryId);
                const isActive = activeSubmission?.inquiryId === sub.inquiryId;
                const isPrinted = sub.frameExportStatus === 'EXPORTED';
                const isModified = sub.frameExportStatus === 'MODIFIED';
                const thumbUrl = getOptimizedPhotoUrl(sub.couplePhoto, 300, 400);

                return (
                  <div
                    key={sub.inquiryId}
                    className={`bg-slate-900 border rounded-2xl p-2.5 flex flex-col justify-between gap-2 transition-all group ${
                      isActive
                        ? 'border-amber-500 ring-2 ring-amber-500/30'
                        : isSelected
                        ? 'border-slate-700 bg-slate-900/90'
                        : 'border-slate-800/80 opacity-85 hover:opacity-100'
                    }`}
                  >
                    {/* Top: Selection + Badge */}
                    <div className="flex items-center justify-between gap-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedInquiryIds((prev) =>
                            isSelected ? prev.filter((id) => id !== sub.inquiryId) : [...prev, sub.inquiryId]
                          );
                        }}
                        className="w-3.5 h-3.5 rounded text-amber-500 accent-amber-500 cursor-pointer"
                      />
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${
                          isPrinted
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : isModified
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {isPrinted ? 'Printed' : isModified ? 'Adjusted' : 'New'}
                      </span>
                    </div>

                    {/* Image Preview with Frame Border */}
                    <div
                      onClick={() => {
                        setActiveInquiryId(sub.inquiryId);
                        setViewMode('studio');
                      }}
                      className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 cursor-pointer group-hover:border-amber-500/60 transition-colors"
                    >
                      <img
                        src={thumbUrl}
                        alt={sub.inquiryId}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent p-1.5 text-center">
                        <span className="text-[10px] font-black text-white">{sub.inquiryId}</span>
                      </div>
                    </div>

                    {/* Name */}
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-white truncate">
                        {sub.husbandName} &amp; {sub.wifeName}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 pt-1 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveInquiryId(sub.inquiryId);
                          setViewMode('studio');
                        }}
                        className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg text-[10px] font-bold cursor-pointer text-center"
                      >
                        Adjust
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadSingleFrame(sub)}
                        className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                        title="Download PNG"
                      >
                        <DownloadIcon className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* =================== STUDIO SPLIT VIEW =================== */
          <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
            
            {/* Left Column: Attendee Queue (Hidden on mobile if studio tab is active) */}
            <div
              className={`w-full md:w-80 lg:w-96 border-r border-slate-800 flex flex-col bg-slate-900/70 shrink-0 ${
                mobileTab === 'queue' ? 'flex flex-1' : 'hidden md:flex'
              }`}
            >
              {/* Queue Header & Select All Controls */}
              <div className="p-2.5 sm:p-3 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0 bg-slate-900">
                <span className="text-xs font-extrabold text-slate-300">
                  Queue ({filteredSubmissions.length})
                </span>
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedInquiryIds(filteredSubmissions.map((s) => s.inquiryId))}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedInquiryIds([])}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Queue Scroll List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-1.5 space-y-1">
                {filteredSubmissions.map((sub) => {
                  const isSelected = selectedInquiryIds.includes(sub.inquiryId);
                  const isActive = activeSubmission?.inquiryId === sub.inquiryId;
                  const isPrinted = sub.frameExportStatus === 'EXPORTED';
                  const isModified = sub.frameExportStatus === 'MODIFIED';
                  const thumbUrl = getOptimizedPhotoUrl(sub.couplePhoto, 160, 200);

                  return (
                    <div
                      key={sub.inquiryId}
                      onClick={() => {
                        setActiveInquiryId(sub.inquiryId);
                        setMobileTab('studio');
                      }}
                      className={`p-2 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-amber-500/15 border border-amber-500/50 shadow-sm'
                          : 'hover:bg-slate-800/70 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSelectedInquiryIds((prev) =>
                            isSelected ? prev.filter((id) => id !== sub.inquiryId) : [...prev, sub.inquiryId]
                          );
                        }}
                        className="w-3.5 h-3.5 rounded text-amber-500 accent-amber-500 cursor-pointer shrink-0"
                      />

                      {/* Mini Thumbnail */}
                      <div className="w-10 h-13 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
                        <img
                          src={thumbUrl}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-white truncate">
                            {sub.inquiryId}
                          </span>
                          {isPrinted ? (
                            <span className="text-[8px] font-black px-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                              PRINTED
                            </span>
                          ) : isModified ? (
                            <span className="text-[8px] font-black px-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                              ADJUSTED
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] font-bold text-slate-300 truncate">
                          {sub.husbandName} &amp; {sub.wifeName} {sub.surname}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {sub.phoneNumber || 'No phone'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Interactive Framing Studio (Hidden on mobile if queue tab is active) */}
            <div
              className={`flex-1 flex flex-col bg-slate-950 overflow-y-auto ${
                mobileTab === 'studio' ? 'flex' : 'hidden md:flex'
              }`}
            >
              {activeSubmission ? (
                <InteractiveFramingStudio
                  sub={activeSubmission}
                  frameImg={globalFrameImg}
                  onUpdateCoord={updateCoord}
                  onSaveAlignment={() => handleSaveSingleAlignment(activeSubmission)}
                  onTogglePrintStatus={() => handleToggleSinglePrintStatus(activeSubmission)}
                  onDownloadFrame={() => handleDownloadSingleFrame(activeSubmission)}
                  isSaving={savingId === activeSubmission.inquiryId}
                  isSaved={Boolean(savedSuccessIds[activeSubmission.inquiryId])}
                  autoSaveState={autoSavingMap[activeSubmission.inquiryId]}
                  onPrev={() => {
                    const idx = filteredSubmissions.findIndex((s) => s.inquiryId === activeSubmission.inquiryId);
                    const prevIdx = idx > 0 ? idx - 1 : filteredSubmissions.length - 1;
                    setActiveInquiryId(filteredSubmissions[prevIdx].inquiryId);
                  }}
                  onNext={() => {
                    const idx = filteredSubmissions.findIndex((s) => s.inquiryId === activeSubmission.inquiryId);
                    const nextIdx = idx < filteredSubmissions.length - 1 ? idx + 1 : 0;
                    setActiveInquiryId(filteredSubmissions[nextIdx].inquiryId);
                  }}
                  currentIndex={filteredSubmissions.findIndex((s) => s.inquiryId === activeSubmission.inquiryId) + 1}
                  totalCount={filteredSubmissions.length}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 text-slate-500 text-xs font-bold">
                  Select a couple from the queue to start framing.
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* 4. Bottom Sticky Action Bar (Batch Export Operations) */}
      <footer className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium w-full sm:w-auto justify-between sm:justify-start">
          <span>
            Selected: <strong className="text-amber-400 font-extrabold">{selectedCount}</strong> / {filteredSubmissions.length}
          </span>
          {zipping && (
            <span className="text-[11px] font-bold text-amber-300 animate-pulse">
              {zipProgress}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
          {/* Quick Mark Batch Status */}
          <button
            type="button"
            onClick={() => handleMarkSelectedExported('EXPORTED')}
            disabled={selectedCount === 0 || zipping}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Mark Printed ({selectedCount})
          </button>

          {/* Raw Photos ZIP */}
          <button
            type="button"
            onClick={handleDownloadRawZip}
            disabled={zipping || selectedCount === 0}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            <span>Raw ZIP ({selectedCount})</span>
          </button>

          {/* Main Framed ZIP Button */}
          <button
            type="button"
            onClick={handleDownloadFramedZip}
            disabled={zipping || selectedCount === 0}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 via-rose-600 to-amber-600 hover:from-amber-600 hover:to-rose-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 active:scale-95"
          >
            {zipping ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{zipProgress || (zipPercent !== null ? `Zipping (${zipPercent}%)...` : 'Processing...')}</span>
              </>
            ) : (
              <>
                <SparklesIcon className="w-4 h-4" />
                <span>Export Framed ZIP ({selectedCount})</span>
              </>
            )}
          </button>
        </div>
      </footer>

    </div>
  );

  return createPortal(modalContent, document.body);
};

/**
 * High-Precision Interactive Framing Studio Component
 * Supports direct touch & mouse dragging to pan photo, real-time zoom slider, and presets
 */
interface InteractiveFramingStudioProps {
  sub: Submission;
  frameImg: HTMLImageElement | null;
  onUpdateCoord: (inquiryId: string, field: 'photoZoom' | 'photoOffsetX' | 'photoOffsetY', value: number) => void;
  onSaveAlignment: () => void;
  onTogglePrintStatus: () => void;
  onDownloadFrame: () => void;
  isSaving: boolean;
  isSaved: boolean;
  autoSaveState?: 'saving' | 'saved';
  onPrev: () => void;
  onNext: () => void;
  currentIndex: number;
  totalCount: number;
}

const InteractiveFramingStudio: React.FC<InteractiveFramingStudioProps> = ({
  sub,
  frameImg,
  onUpdateCoord,
  onSaveAlignment,
  onTogglePrintStatus,
  onDownloadFrame,
  isSaving,
  isSaved,
  autoSaveState,
  onPrev,
  onNext,
  currentIndex,
  totalCount
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [coupleImg, setCoupleImg] = useState<HTMLImageElement | null>(null);
  const [loadingImg, setLoadingImg] = useState(true);

  // Dragging interaction state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; startOx: number; startOy: number }>({
    x: 0,
    y: 0,
    startOx: 0,
    startOy: 0
  });

  const zoomVal = sub.photoZoom ?? 1.0;
  const offsetValX = sub.photoOffsetX ?? 0;
  const offsetValY = sub.photoOffsetY ?? 0;
  const isPrinted = sub.frameExportStatus === 'EXPORTED';
  const isModified = sub.frameExportStatus === 'MODIFIED';

  // Load high-speed 600x800 preview photo
  useEffect(() => {
    let isMounted = true;
    if (!sub.couplePhoto) {
      setCoupleImg(null);
      setLoadingImg(false);
      return;
    }

    setLoadingImg(true);
    const optimizedUrl = getOptimizedPhotoUrl(sub.couplePhoto, 600, 800);
    loadSafeCanvasImage(optimizedUrl, 12000).then((img) => {
      if (!isMounted) return;
      setCoupleImg(img);
      setLoadingImg(false);
    });

    return () => {
      isMounted = false;
    };
  }, [sub.couplePhoto]);

  // Render Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 768;
    canvas.height = 1024;

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

      const w = tempW * zoomVal;
      const h = tempH * zoomVal;
      const ox = offsetX - (w - tempW) / 2 + (offsetValX * (canvas.width / 768));
      const oy = offsetY - (h - tempH) / 2 + (offsetValY * (canvas.height / 1024));

      ctx.save();
      ctx.beginPath();
      ctx.rect(startX, startY, drawWidth, drawHeight);
      ctx.clip();
      ctx.drawImage(coupleImg, startX + ox, startY + oy, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(startX, startY, drawWidth, drawHeight);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(loadingImg ? 'Loading photo...' : 'No Photo Available', canvas.width / 2, canvas.height / 2);
    }

    // Overlay frame
    if (frameImg) {
      ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
    }

    // Token text
    ctx.save();
    ctx.fillStyle = '#7a0c0c';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sub.inquiryId, canvas.width / 2, canvas.height * 0.95);
    ctx.restore();
  }, [coupleImg, frameImg, zoomVal, offsetValX, offsetValY, sub.inquiryId, loadingImg]);

  // Touch & Mouse Handlers for Drag-to-Pan
  const handlePointerDown = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      startOx: offsetValX,
      startOy: offsetValY
    };
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    // Scale delta relative to canvas size (~2x sensitivity)
    const newOx = Math.round(dragStartRef.current.startOx + deltaX * 1.6);
    const newOy = Math.round(dragStartRef.current.startOy + deltaY * 1.6);
    onUpdateCoord(sub.inquiryId, 'photoOffsetX', Math.max(-300, Math.min(300, newOx)));
    onUpdateCoord(sub.inquiryId, 'photoOffsetY', Math.max(-300, Math.min(300, newOy)));
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-3 sm:p-5 space-y-4">
      
      {/* Studio Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40">
              {sub.inquiryId}
            </span>
            <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
              {sub.husbandName} &amp; {sub.wifeName} {sub.surname}
            </h3>
            {isPrinted ? (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Printed
              </span>
            ) : isModified ? (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Adjusted
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                New
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Phone: <span className="text-white font-bold">{sub.phoneNumber || 'N/A'}</span> &bull; Program: {sub.programName || 'Standard'}
          </p>
        </div>

        {/* Quick Save & Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {autoSaveState === 'saving' && (
            <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
              <div className="w-2 h-2 border border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </span>
          )}

          <button
            type="button"
            onClick={onSaveAlignment}
            disabled={isSaving}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
              isSaved
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
            }`}
          >
            {isSaving ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isSaved ? (
              <>
                <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>Saved</span>
              </>
            ) : (
              <span>Save</span>
            )}
          </button>

          <button
            type="button"
            onClick={onTogglePrintStatus}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              isPrinted
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
            }`}
          >
            {isPrinted ? 'Reset Status' : 'Mark Printed'}
          </button>

          <button
            type="button"
            onClick={onDownloadFrame}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            <span>Download PNG</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Studio Canvas */}
      <div className="flex-1 min-h-[360px] sm:min-h-[460px] flex items-center justify-center relative bg-slate-900/50 rounded-2xl border border-slate-800/80 p-4">
        
        {/* Floating Instruction */}
        <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl px-2.5 py-1 text-[11px] text-slate-400 font-medium z-10 hidden sm:block">
          💡 Drag photo to position &bull; Use slider below to zoom
        </div>

        {/* Previous / Next Floating Arrows */}
        <button
          type="button"
          onClick={onPrev}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-slate-900/90 border border-slate-700 hover:border-amber-500 text-white flex items-center justify-center cursor-pointer z-10 shadow-lg hover:scale-105 active:scale-95 transition-all"
          title="Previous Couple (Left Arrow)"
        >
          ◀
        </button>

        <button
          type="button"
          onClick={onNext}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-slate-900/90 border border-slate-700 hover:border-amber-500 text-white flex items-center justify-center cursor-pointer z-10 shadow-lg hover:scale-105 active:scale-95 transition-all"
          title="Next Couple (Right Arrow)"
        >
          ▶
        </button>

        {/* The Live Interactive Canvas */}
        <div
          onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
          onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={(e) => {
            if (e.touches.length > 0) {
              handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
            }
          }}
          onTouchMove={(e) => {
            if (e.touches.length > 0) {
              handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
            }
          }}
          onTouchEnd={handlePointerUp}
          className={`relative max-w-[320px] sm:max-w-[380px] w-full aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border-2 transition-all ${
            isDragging
              ? 'border-amber-500 cursor-grabbing ring-4 ring-amber-500/20'
              : 'border-slate-700 hover:border-slate-500 cursor-grab'
          }`}
        >
          <canvas ref={canvasRef} className="w-full h-full object-contain block select-none pointer-events-none" />
          {loadingImg && (
            <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Control Sliders & Presets Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3 shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Zoom Slider */}
          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                Zoom ({zoomVal.toFixed(2)}x)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onUpdateCoord(sub.inquiryId, 'photoZoom', Math.max(0.5, Number((zoomVal - 0.05).toFixed(2))))}
                  className="w-5 h-5 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center cursor-pointer"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateCoord(sub.inquiryId, 'photoZoom', Math.min(2.5, Number((zoomVal + 0.05).toFixed(2))))}
                  className="w-5 h-5 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateCoord(sub.inquiryId, 'photoZoom', 1.0)}
                  className="px-1.5 h-5 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 font-bold text-[10px] flex items-center justify-center cursor-pointer"
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
              step="0.02"
              value={zoomVal}
              onChange={(e) => onUpdateCoord(sub.inquiryId, 'photoZoom', Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Horizontal Position Slider */}
          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                ◄ Left / Right ► ({offsetValX > 0 ? `+${offsetValX}` : offsetValX}px)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onUpdateCoord(sub.inquiryId, 'photoOffsetX', offsetValX - 10)}
                  className="w-5 h-5 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center cursor-pointer"
                >
                  ◄
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateCoord(sub.inquiryId, 'photoOffsetX', offsetValX + 10)}
                  className="w-5 h-5 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center cursor-pointer"
                >
                  ►
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateCoord(sub.inquiryId, 'photoOffsetX', 0)}
                  className="px-1.5 h-5 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 font-bold text-[10px] flex items-center justify-center cursor-pointer"
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
              onChange={(e) => onUpdateCoord(sub.inquiryId, 'photoOffsetX', Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Vertical Position Slider */}
          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                ▲ Up / Down ▼ ({offsetValY > 0 ? `+${offsetValY}` : offsetValY}px)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onUpdateCoord(sub.inquiryId, 'photoOffsetY', offsetValY - 10)}
                  className="w-5 h-5 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center cursor-pointer"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateCoord(sub.inquiryId, 'photoOffsetY', offsetValY + 10)}
                  className="w-5 h-5 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center cursor-pointer"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateCoord(sub.inquiryId, 'photoZoom', 1.0);
                    onUpdateCoord(sub.inquiryId, 'photoOffsetX', 0);
                    onUpdateCoord(sub.inquiryId, 'photoOffsetY', 0);
                  }}
                  className="px-1.5 h-5 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 font-bold text-[10px] flex items-center justify-center cursor-pointer"
                  title="Reset All Alignment"
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
              onChange={(e) => onUpdateCoord(sub.inquiryId, 'photoOffsetY', Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
          </div>

        </div>

        {/* Quick Position Presets */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mr-1">
              Presets:
            </span>
            <button
              type="button"
              onClick={() => {
                onUpdateCoord(sub.inquiryId, 'photoZoom', 1.0);
                onUpdateCoord(sub.inquiryId, 'photoOffsetX', 0);
                onUpdateCoord(sub.inquiryId, 'photoOffsetY', 0);
              }}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold cursor-pointer"
            >
              Center (0,0)
            </button>
            <button
              type="button"
              onClick={() => onUpdateCoord(sub.inquiryId, 'photoOffsetY', offsetValY - 25)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold cursor-pointer"
            >
              Nudge Up (-25px)
            </button>
            <button
              type="button"
              onClick={() => onUpdateCoord(sub.inquiryId, 'photoOffsetY', offsetValY + 25)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold cursor-pointer"
            >
              Nudge Down (+25px)
            </button>
            <button
              type="button"
              onClick={() => onUpdateCoord(sub.inquiryId, 'photoZoom', 1.25)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold cursor-pointer"
            >
              Portrait Face Zoom (1.25x)
            </button>
          </div>

          <div className="text-[11px] font-bold text-slate-400">
            Card {currentIndex} of {totalCount}
          </div>
        </div>

      </div>

    </div>
  );
};
