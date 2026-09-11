'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { useAdmin } from '../context/AdminContext';
import { API_BASE_URL } from '../../../config';
import {
  getOrCreateDeviceId,
  savePreparedEvent,
  getPreparedEvent,
  isPassScannedOnThisDevice,
  saveOfflineScan,
  getPendingOfflineScans,
  markScansSynced,
  getLocalScanStats,
  OfflineScan,
  PreparedEventData
} from '../../../services/scannerDb';
import { canUseOfflineEd25519, verifyQrTokenOffline } from '../../../services/offlineCrypto';
import { playScanFeedback } from '../../../services/scannerFeedback';
import { LuxurySelect } from '../../../components/LuxurySelect';
import { resolveDisplayImageUrl } from '../../../utils/mediaPresets';
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  XIcon,
  RefreshCwIcon,
  CameraIcon,
  ShieldCheckIcon,
  ImageIcon,
  FlashlightIcon,
  CheckIcon,
  UsersIcon,
  RadioIcon,
  PhoneIcon
} from '../../../components/Icons';
import toast from 'react-hot-toast';

interface ScanDisplayResult {
  type: 'VALID' | 'VALID_OFFLINE' | 'ALREADY_SCANNED' | 'WRONG_EVENT' | 'INVALID_SIGNATURE' | 'REVOKED' | 'CONFLICT';
  title: string;
  message: string;
  passId?: string;
  inquiryId?: string;
  coupleName?: string;
  couplePhoto?: string | null;
  isVip?: boolean;
  phoneNumber?: string;
  slotName?: string;
  scannedByDevice?: string;
  scannedByOperator?: string;
  firstScannedAt?: string;
  timestamp: string;
  scanCount?: number;
}

interface ServerGateStats {
  totalConfirmed: number;
  presentCount: number;
  remaining: number;
  duplicateScans: number;
  activeDeviceCount?: number;
  refreshedAt?: string;
}

export const ScannerPage: React.FC = () => {
  const { programs, selectedProgramId, setSelectedProgramId } = useAdmin();

  // State
  const [deviceId, setDeviceId] = useState<string>('EDKL-GATE-INIT');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [isScanningCooldown, setIsScanningCooldown] = useState<boolean>(false);
  const [latestResult, setLatestResult] = useState<ScanDisplayResult | null>(null);
  const [photoError, setPhotoError] = useState<boolean>(false);
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);

  // Offline Prep & Sync Stats
  const [preparedEvent, setPreparedEvent] = useState<PreparedEventData | null>(null);
  const [isPrepping, setIsPrepping] = useState<boolean>(false);
  const [prepSuccessMessage, setPrepSuccessMessage] = useState<string | null>(null);
  const [offlineCryptoReady, setOfflineCryptoReady] = useState<boolean>(false);
  const [, setOfflineCryptoMessage] = useState<string>('Offline Cryptographic Verification: UNSUPPORTED');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [syncedCount, setSyncedCount] = useState<number>(0);
  const [conflictCount, setConflictCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Manual fallback input
  const [manualCode, setManualCode] = useState<string>('');
  const [manualLoading, setManualLoading] = useState<boolean>(false);

  // Live Multi-Device Gate Stats from Server
  const [serverStats, setServerStats] = useState<ServerGateStats | null>(null);

  // Refs for race-condition prevention & camera loop
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sequenceRef = useRef<number>(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const dismissTimerRef = useRef<any>(null);
  const loopTimerRef = useRef<any>(null);

  // High-Performance Scanner Engine (Zero Buffer Re-Allocation)
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isFrameBusyRef = useRef<boolean>(false);
  const frameTickCountRef = useRef<number>(0);

  // CRITICAL SYNCHRONOUS LOCKS TO ELIMINATE +2 DUPLICATE SCANS
  const isProcessingRef = useRef<boolean>(false);
  const lastScannedTokenRef = useRef<{ token: string; timestamp: number } | null>(null);
  const recentlyAdmittedPassesRef = useRef<Map<string, number>>(new Map());

  const activeEventId = selectedProgramId !== 'all' ? selectedProgramId : programs[0]?.id || '';
  const currentProgram = programs.find((p) => p.id === activeEventId) || programs[0];

  // 1. Initialize Device ID, Network Listeners & Dedicated Offscreen Canvas
  useEffect(() => {
    getOrCreateDeviceId().then(setDeviceId);

    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // Check for native browser BarcodeDetector API (ultra-fast hardware decoding)
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch (_) {
        barcodeDetectorRef.current = null;
      }
    }

    // Allocate fixed 380x380 offscreen canvas buffer ONCE (zero per-frame churn)
    if (typeof document !== 'undefined') {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = 380;
      offCanvas.height = 380;
      offscreenCanvasRef.current = offCanvas;
      offscreenCtxRef.current = offCanvas.getContext('2d', { willReadFrequently: true });
    }

    // Auto-start camera on mount with safety margin
    const startTimer = setTimeout(() => {
      startCamera();
    }, 250);

    return () => {
      clearTimeout(startTimer);
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      stopCamera();
    };
  }, []);

  // 2. Load Local Stats & Prepared Event Data
  const refreshLocalStats = useCallback(async () => {
    if (!activeEventId) return;
    const prep = await getPreparedEvent(activeEventId);
    setPreparedEvent(prep);
    if (prep?.publicKey?.publicKeySpkiBase64) {
      const ready = await canUseOfflineEd25519(prep.publicKey.publicKeySpkiBase64);
      setOfflineCryptoReady(ready);
      setOfflineCryptoMessage(`Offline Cryptographic Verification: ${ready ? 'READY' : 'UNSUPPORTED'}`);
    } else {
      setOfflineCryptoReady(false);
      setOfflineCryptoMessage('Offline Cryptographic Verification: UNSUPPORTED');
    }

    const stats = await getLocalScanStats(activeEventId);
    setPendingCount(stats.pending || 0);
    setSyncedCount(stats.synced || 0);
    setConflictCount(stats.conflicts || 0);
  }, [activeEventId]);

  useEffect(() => {
    refreshLocalStats();
  }, [refreshLocalStats]);

  // 3. Heartbeat for Multi-Device Gate Sync (10s intervals, throttled during scanning)
  const fetchServerStats = useCallback(async () => {
    if (!isOnline || !activeEventId) return;
    try {
      const savedPass = sessionStorage.getItem('adminPassword') || '';
      const res = await fetch(`${API_BASE_URL}/api/admin/scanner/stats?eventId=${encodeURIComponent(activeEventId)}`, {
        headers: { Authorization: `Bearer ${savedPass}` }
      });
      if (res.ok) {
        const data: ServerGateStats = await res.json();
        setServerStats(data);
      }
    } catch (_) {}
  }, [isOnline, activeEventId]);

  useEffect(() => {
    fetchServerStats();

    // 10-second heartbeat polling when window is visible and not actively processing
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !isProcessingRef.current) {
        fetchServerStats();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchServerStats]);

  // 4. Auto-dismiss timer for scan feedback (Smooth 3.6s via single timer, zero state re-renders)
  useEffect(() => {
    if (latestResult) {
      setPhotoError(false);
      setShowPhotoModal(false);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

      dismissTimerRef.current = setTimeout(() => {
        setLatestResult(null);
      }, 3600);
    } else {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    }

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [latestResult]);

  // 5. High-Reliability Camera Engine with Safe Hardware Delay & Fallbacks
  const stopCamera = useCallback(() => {
    if (loopTimerRef.current) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setTorchOn(false);
    isFrameBusyRef.current = false;
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    stopCamera();

    // Hardware release delay: Wait 180ms so mobile drivers fully release camera hardware
    await new Promise((resolve) => setTimeout(resolve, 180));

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API is not available. Please access via HTTPS or use Photo QR / Manual ID verification.');
      return;
    }

    let stream: MediaStream | null = null;
    const constraintList: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        },
        audio: false
      },
      {
        video: {
          facingMode: facingMode
        },
        audio: false
      },
      {
        video: true,
        audio: false
      }
    ];

    for (const constraints of constraintList) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (e: any) {
        console.warn('[Scanner] Trying fallback constraint...', e.name);
      }
    }

    if (!stream) {
      setCameraError('Camera access denied or device is busy. Please close other camera apps and tap "Resume Scanner".');
      setCameraActive(false);
      return;
    }

    try {
      streamRef.current = stream;

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('muted', 'true');
        video.setAttribute('autoplay', 'true');
        video.playsInline = true;
        video.muted = true;

        try {
          await video.play();
          setCameraActive(true);
        } catch (playErr) {
          video.onloadedmetadata = async () => {
            try {
              await video.play();
              setCameraActive(true);
            } catch (_) {}
          };
          setCameraActive(true);
        }

        // Inspect torch capabilities
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities ? (track.getCapabilities() as any) : {};
        if (capabilities.torch) {
          setTorchSupported(true);
        } else {
          setTorchSupported(false);
        }
      } else {
        setCameraActive(true);
      }
    } catch (err: any) {
      console.error('Camera startup error:', err);
      setCameraError(err.message || 'Failed to start video stream.');
      setCameraActive(false);
    }
  };

  const toggleTorch = async () => {
    if (!streamRef.current || !torchSupported) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      const newTorchState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: newTorchState }]
      });
      setTorchOn(newTorchState);
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  };

  // Switch facing camera lens smoothly
  const handleToggleFacingMode = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    stopCamera();
    setTimeout(() => {
      startCamera();
    }, 200);
  };

  // 6. Ultra-Fast Center-Reticle Auto-Capture Loop
  const scanCurrentFrame = useCallback(async () => {
    // SYNCHRONOUS LOCK: If another frame is processing, or cooldown, or latestResult card is showing
    if (
      !videoRef.current ||
      !cameraActive ||
      isProcessingRef.current ||
      isFrameBusyRef.current ||
      latestResult !== null
    ) {
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

    isFrameBusyRef.current = true;
    try {
      // 1. Hardware BarcodeDetector Check (Fastest hardware path)
      if (barcodeDetectorRef.current) {
        try {
          const barcodes = await barcodeDetectorRef.current.detect(video);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            const rawVal = barcodes[0].rawValue.trim();
            if (rawVal) {
              triggerScan(rawVal);
              return;
            }
          }
          // Native detector found 0 barcodes: exit cleanly without burning CPU on canvas
          return;
        } catch (_) {
          // Native detector failed: fallback to canvas below
        }
      }

      // 2. High-Speed Fixed Center-Reticle Canvas + jsQR
      const canvas = offscreenCanvasRef.current || canvasRef.current;
      const ctx = offscreenCtxRef.current || canvas?.getContext('2d', { willReadFrequently: true });
      if (!canvas || !ctx) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const tick = ++frameTickCountRef.current;

      // Center crop: sample central 74% square reticle where gate staff aligns pass
      // Sample full frame on every 8th tick as a wide-angle fallback
      if (tick % 8 === 0) {
        ctx.drawImage(video, 0, 0, vw, vh, 0, 0, 380, 380);
      } else {
        const minDim = Math.min(vw, vh);
        const cropSize = Math.floor(minDim * 0.74);
        const sx = Math.floor((vw - cropSize) / 2);
        const sy = Math.floor((vh - cropSize) / 2);
        ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, 380, 380);
      }

      const imageData = ctx.getImageData(0, 0, 380, 380);

      // Pass tickets are dark QR on white background -> dontInvert executes in ~6-8ms
      // Attempt both only once every 8 frames as an emergency fallback
      const code = jsQR(imageData.data, 380, 380, {
        inversionAttempts: tick % 8 === 0 ? 'attemptBoth' : 'dontInvert'
      });

      if (code && code.data && code.data.trim()) {
        triggerScan(code.data.trim());
      }
    } catch (_) {
      // frame error caught for resilience
    } finally {
      isFrameBusyRef.current = false;
    }
  }, [cameraActive, latestResult]);

  // Synchronously evaluate debounce before scheduling async execution
  const triggerScan = (rawToken: string) => {
    const now = Date.now();

    // Clean up admitted tickets older than 20 seconds
    recentlyAdmittedPassesRef.current.forEach((time, id) => {
      if (now - time > 20000) recentlyAdmittedPassesRef.current.delete(id);
    });

    // If this exact token or an admitted passId in this token was already approved recently on this device, skip
    for (const [admittedPassId, admitTime] of recentlyAdmittedPassesRef.current.entries()) {
      if (rawToken.includes(admittedPassId) && now - admitTime < 15000) {
        return;
      }
    }

    // 12s Debounce guard: drop if same token scanned back-to-back on this camera
    if (
      lastScannedTokenRef.current &&
      lastScannedTokenRef.current.token === rawToken &&
      now - lastScannedTokenRef.current.timestamp < 12000
    ) {
      return;
    }

    // Synchronously lock IMMEDIATELY so no other frame can trigger
    isProcessingRef.current = true;
    lastScannedTokenRef.current = { token: rawToken, timestamp: now };
    setIsScanningCooldown(true);

    handleQrDetected(rawToken);
  };

  // High-performance controlled frame loop (Paused while result card is visible)
  useEffect(() => {
    let isCancelled = false;

    const runLoop = async () => {
      if (isCancelled) return;
      if (cameraActive && !latestResult && !isScanningCooldown) {
        await scanCurrentFrame();
      }
      if (!isCancelled) {
        // Schedule next scan tick with 50ms delay (~18 fps scan rate)
        // Leaving 80%+ CPU/GPU bandwidth for silky-smooth 60fps video rendering
        loopTimerRef.current = setTimeout(runLoop, 50);
      }
    };

    if (cameraActive && !latestResult) {
      loopTimerRef.current = setTimeout(runLoop, 60);
    }

    return () => {
      isCancelled = true;
      if (loopTimerRef.current) {
        clearTimeout(loopTimerRef.current);
        loopTimerRef.current = null;
      }
    };
  }, [cameraActive, latestResult, isScanningCooldown, scanCurrentFrame]);

  // 7. QR Detected Dispatcher
  const handleQrDetected = async (rawQrToken: string) => {
    try {
      if (isOnline) {
        await processOnlineScan(rawQrToken);
      } else {
        await processOfflineScan(rawQrToken);
      }
    } catch (err: any) {
      console.error('Scan processing error:', err);
      playScanFeedback('INVALID');
      setLatestResult({
        type: 'INVALID_SIGNATURE',
        title: 'Scan Error',
        message: err.message || 'Error processing scan token.',
        scannedByDevice: deviceId,
        scannedByOperator: 'Gate Staff',
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      // Release scanning lock after 1.2s so next pass can be scanned smoothly
      setTimeout(() => {
        isProcessingRef.current = false;
        setIsScanningCooldown(false);
      }, 1200);
    }
  };

  // 8. Photo Upload QR Handler
  const handleImageFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imgData.data, imgData.width, imgData.height);

          if (code && code.data) {
            triggerScan(code.data.trim());
          } else {
            toast.error('No readable QR code found in the selected image.');
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error(`Error reading image: ${err.message}`);
    }
  };

  // 9. Process Online Gate Scan
  const processOnlineScan = async (qrToken: string) => {
    const savedPass = sessionStorage.getItem('adminPassword') || '';
    const currentSeq = sequenceRef.current++;

    const res = await fetch(`${API_BASE_URL}/api/admin/scanner/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${savedPass}`
      },
      body: JSON.stringify({
        qrToken,
        eventId: activeEventId,
        deviceId,
        deviceSequence: currentSeq,
        scannedAtDevice: new Date().toISOString()
      })
    });

    const data = await res.json().catch(() => ({ error: 'Invalid server response' }));

    // Handle HTTP non-200 responses cleanly
    if (!res.ok) {
      playScanFeedback('INVALID');
      setLatestResult({
        type: 'INVALID_SIGNATURE',
        title: res.status >= 500 ? 'SERVER ERROR' : 'SCAN FAILED',
        message: data.error || data.message || `Server responded with error ${res.status}. Please try again.`,
        scannedByDevice: deviceId,
        scannedByOperator: 'Gate Staff',
        timestamp: new Date().toLocaleTimeString()
      });
      return;
    }

    // Instantly update liveStats across UI from this scan response (0ms latency)
    if (data.liveStats) {
      setServerStats(data.liveStats);
    }

    if (data.result === 'VALID') {
      if (data.passId) {
        recentlyAdmittedPassesRef.current.set(data.passId, Date.now());
      }
      playScanFeedback('VALID');
      setLatestResult({
        type: 'VALID',
        title: 'ENTRY APPROVED',
        message: data.message || 'Pass verified and attendance marked.',
        passId: data.passId,
        inquiryId: data.inquiryId,
        coupleName: data.coupleName,
        couplePhoto: data.couplePhoto,
        isVip: data.isVip,
        phoneNumber: data.phoneNumber,
        slotName: currentProgram?.name,
        scannedByDevice: data.scannedByDevice || deviceId,
        scannedByOperator: data.scannedByOperator || 'Gate Staff',
        timestamp: new Date().toLocaleTimeString()
      });
      fetchServerStats();
    } else if (data.result === 'ALREADY_SCANNED') {
      playScanFeedback('ALREADY_SCANNED');
      setLatestResult({
        type: 'ALREADY_SCANNED',
        title: 'ALREADY SCANNED (DUPLICATE)',
        message: `This pass was already checked in at ${
          data.firstScannedAt ? new Date(data.firstScannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'an earlier time'
        }.`,
        passId: data.passId,
        inquiryId: data.inquiryId,
        coupleName: data.coupleName,
        couplePhoto: data.couplePhoto,
        isVip: data.isVip,
        phoneNumber: data.phoneNumber,
        scannedByDevice: data.scannedByDevice || 'Gate Scanner',
        scannedByOperator: data.scannedByOperator || 'Gate Staff',
        firstScannedAt: data.firstScannedAt,
        scanCount: data.scanCount || 2,
        timestamp: new Date().toLocaleTimeString()
      });
    } else if (data.result === 'WRONG_EVENT') {
      playScanFeedback('INVALID');
      setLatestResult({
        type: 'WRONG_EVENT',
        title: 'OLD SEMINAR PASS / WRONG BATCH',
        message: data.message || `Pass is registered for '${data.registeredForEvent || 'another session'}', not the current batch.`,
        passId: data.passId,
        inquiryId: data.inquiryId,
        coupleName: data.coupleName,
        couplePhoto: data.couplePhoto,
        isVip: data.isVip,
        phoneNumber: data.phoneNumber,
        scannedByDevice: deviceId,
        scannedByOperator: 'Gate Staff',
        timestamp: new Date().toLocaleTimeString()
      });
    } else if (data.result === 'REVOKED') {
      playScanFeedback('INVALID');
      setLatestResult({
        type: 'INVALID_SIGNATURE',
        title: 'PASS CANCELLED / REVOKED',
        message: data.message || 'This pass has been cancelled or revoked.',
        passId: data.passId,
        scannedByDevice: deviceId,
        scannedByOperator: 'Gate Staff',
        timestamp: new Date().toLocaleTimeString()
      });
    } else if (data.result === 'UNKNOWN_PASS') {
      playScanFeedback('INVALID');
      setLatestResult({
        type: 'INVALID_SIGNATURE',
        title: 'PASS NOT FOUND',
        message: data.message || 'Pass record not found in system.',
        scannedByDevice: deviceId,
        scannedByOperator: 'Gate Staff',
        timestamp: new Date().toLocaleTimeString()
      });
    } else if (data.result === 'INVALID_SIGNATURE') {
      playScanFeedback('INVALID');
      setLatestResult({
        type: 'INVALID_SIGNATURE',
        title: 'INVALID PASS SIGNATURE',
        message: data.message || 'Cryptographic signature is invalid or tampered.',
        scannedByDevice: deviceId,
        scannedByOperator: 'Gate Staff',
        timestamp: new Date().toLocaleTimeString()
      });
    } else {
      playScanFeedback('INVALID');
      setLatestResult({
        type: 'INVALID_SIGNATURE',
        title: data.result || 'SCAN REJECTED',
        message: data.message || data.error || 'Scan could not be processed.',
        scannedByDevice: deviceId,
        scannedByOperator: 'Gate Staff',
        timestamp: new Date().toLocaleTimeString()
      });
    }
  };

  // 10. Process Offline Cryptographic Scan
  const processOfflineScan = async (qrToken: string) => {
    if (!preparedEvent || !preparedEvent.publicKey?.publicKeySpkiBase64) {
      playScanFeedback('INVALID');
      setLatestResult({
        type: 'INVALID_SIGNATURE',
        title: 'OFFLINE ROSTER MISSING',
        message: 'This device has not downloaded offline event keys. Connect to network and click Prepare Offline.',
        scannedByDevice: deviceId,
        scannedByOperator: 'Gate Staff (Offline)',
        timestamp: new Date().toLocaleTimeString()
      });
      return;
    }

    const verifyResult = await verifyQrTokenOffline(qrToken, preparedEvent.publicKey.publicKeySpkiBase64);
    if (!verifyResult.valid || !verifyResult.payload) {
      playScanFeedback('INVALID');
      const isCryptoUnavailable = verifyResult.error === 'CRYPTO_UNAVAILABLE';
      setLatestResult({
        type: 'INVALID_SIGNATURE',
        title: isCryptoUnavailable ? 'OFFLINE CRYPTO NOT SUPPORTED' : 'SIGNATURE VERIFICATION FAILED',
        message: verifyResult.message || `Cryptographic check failed: ${verifyResult.error || 'Invalid token'}`,
        scannedByDevice: deviceId,
        scannedByOperator: 'Gate Staff (Offline)',
        timestamp: new Date().toLocaleTimeString()
      });
      return;
    }

    const payload = verifyResult.payload;

    if (payload.eventId !== activeEventId) {
      playScanFeedback('INVALID');
      setLatestResult({
        type: 'WRONG_EVENT',
        title: 'WRONG EVENT BATCH',
        message: 'Pass belongs to a different seminar date or batch.',
        passId: payload.passId,
        scannedByDevice: deviceId,
        scannedByOperator: 'Gate Staff (Offline)',
        timestamp: new Date().toLocaleTimeString()
      });
      return;
    }

    const isDup = await isPassScannedOnThisDevice(activeEventId, payload.passId);
    const rosterItem = preparedEvent?.roster?.[payload.passId];

    if (isDup) {
      playScanFeedback('ALREADY_SCANNED');
      setLatestResult({
        type: 'ALREADY_SCANNED',
        title: 'ALREADY SCANNED ON THIS DEVICE',
        message: 'Pass has already been admitted through this scanner device.',
        passId: payload.passId,
        inquiryId: rosterItem?.inquiryId,
        coupleName: rosterItem?.coupleName,
        couplePhoto: rosterItem?.couplePhoto,
        isVip: rosterItem?.isVip,
        phoneNumber: rosterItem?.phoneNumber,
        scannedByDevice: deviceId,
        scannedByOperator: 'Gate Staff (Offline)',
        timestamp: new Date().toLocaleTimeString()
      });
      return;
    }

    const currentSeq = sequenceRef.current++;
    const newScan: OfflineScan = {
      scanLocalId: `SCN-${deviceId}-${Date.now()}`,
      qrToken,
      passId: payload.passId,
      eventId: activeEventId,
      deviceId,
      deviceSequence: currentSeq,
      scannedAtDevice: new Date().toISOString(),
      syncStatus: 'PENDING',
      coupleName: rosterItem?.coupleName,
      inquiryId: rosterItem?.inquiryId
    };

    await saveOfflineScan(newScan);
    await refreshLocalStats();

    playScanFeedback('VALID');
    setLatestResult({
      type: 'VALID_OFFLINE',
      title: 'ENTRY APPROVED (OFFLINE)',
      message: 'Cryptographic Ed25519 signature verified. Saved to local device roster.',
      passId: payload.passId,
      inquiryId: rosterItem?.inquiryId,
      coupleName: rosterItem?.coupleName || 'Verified Attendee',
      couplePhoto: rosterItem?.couplePhoto || null,
      isVip: rosterItem?.isVip || false,
      phoneNumber: rosterItem?.phoneNumber || '',
      slotName: currentProgram?.name,
      scannedByDevice: deviceId,
      scannedByOperator: 'Gate Staff (Offline)',
      timestamp: new Date().toLocaleTimeString()
    });
  };

  // 11. Prepare Event Offline
  const handlePrepareOffline = async () => {
    if (!activeEventId) return;
    setIsPrepping(true);
    setPrepSuccessMessage(null);

    try {
      const savedPass = sessionStorage.getItem('adminPassword') || '';
      const res = await fetch(`${API_BASE_URL}/api/admin/scanner/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${savedPass}`
        },
        body: JSON.stringify({ eventId: activeEventId })
      });

      if (!res.ok) throw new Error('Failed to download offline cryptographic keys.');

      const data: PreparedEventData = await res.json();
      const cryptoReady = await canUseOfflineEd25519(data.publicKey?.publicKeySpkiBase64 || '');
      setOfflineCryptoReady(cryptoReady);
      setOfflineCryptoMessage(`Offline Cryptographic Verification: ${cryptoReady ? 'READY' : 'UNSUPPORTED'}`);

      if (!cryptoReady) {
        setPreparedEvent(null);
        throw new Error('Offline secure QR verification is not supported on this browser/device.');
      }

      await savePreparedEvent(data);
      setPreparedEvent(data);
      setPrepSuccessMessage(`Offline ready for ${data.eventName} (${data.eventDate})`);
      toast.success(`Offline database ready for ${data.eventName}!`);
      setTimeout(() => setPrepSuccessMessage(null), 4000);
    } catch (err: any) {
      toast.error(`Offline preparation error: ${err.message}`);
    } finally {
      setIsPrepping(false);
    }
  };

  // 12. Synchronize Offline Batches to MongoDB
  const handleSyncScans = async () => {
    if (!isOnline || !activeEventId || isSyncing) return;
    setIsSyncing(true);

    try {
      const pendingScans = await getPendingOfflineScans(activeEventId);
      if (pendingScans.length === 0) {
        toast('No pending offline scans to sync.', { icon: 'ℹ️' });
        setIsSyncing(false);
        return;
      }

      const savedPass = sessionStorage.getItem('adminPassword') || '';
      const res = await fetch(`${API_BASE_URL}/api/admin/scanner/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${savedPass}`
        },
        body: JSON.stringify({
          deviceId,
          eventId: activeEventId,
          scans: pendingScans
        })
      });

      if (!res.ok) throw new Error('Server error syncing offline batch.');

      const data = await res.json();
      if (data.results && Array.isArray(data.results)) {
        await markScansSynced(data.results);
      }

      await refreshLocalStats();
      await fetchServerStats();
      toast.success(`Sync complete: ${data.processedCount || pendingScans.length} scan(s) synced.`);
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // 13. Manual Fallback Attendance Lookup
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim() || !activeEventId) return;

    setManualLoading(true);
    try {
      const savedPass = sessionStorage.getItem('adminPassword') || '';
      const res = await fetch(`${API_BASE_URL}/api/admin/scanner/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${savedPass}`
        },
        body: JSON.stringify({
          identifier: manualCode.trim(),
          eventId: activeEventId,
          deviceId
        })
      });

      const data = await res.json();

      if (data.liveStats) {
        setServerStats(data.liveStats);
      }

      if (data.result === 'VALID') {
        playScanFeedback('VALID');
        setLatestResult({
          type: 'VALID',
          title: 'MANUAL ENTRY APPROVED',
          message: data.message || 'Pass verified and attendance marked in database.',
          passId: data.passId,
          inquiryId: data.inquiryId,
          coupleName: data.coupleName,
          couplePhoto: data.couplePhoto,
          isVip: data.isVip,
          phoneNumber: data.phoneNumber,
          slotName: currentProgram?.name,
          scannedByDevice: data.scannedByDevice || deviceId,
          scannedByOperator: data.scannedByOperator || 'Admin',
          timestamp: new Date().toLocaleTimeString()
        });
        setManualCode('');
        fetchServerStats();
      } else if (data.result === 'ALREADY_SCANNED') {
        playScanFeedback('ALREADY_SCANNED');
        setLatestResult({
          type: 'ALREADY_SCANNED',
          title: 'ALREADY SCANNED (DUPLICATE)',
          message: data.message || 'Pass was previously checked in.',
          passId: data.passId,
          inquiryId: data.inquiryId,
          coupleName: data.coupleName,
          couplePhoto: data.couplePhoto,
          isVip: data.isVip,
          phoneNumber: data.phoneNumber,
          scannedByDevice: data.scannedByDevice || 'Gate Scanner',
          scannedByOperator: data.scannedByOperator || 'Gate Staff',
          firstScannedAt: data.firstScannedAt,
          timestamp: new Date().toLocaleTimeString()
        });
      } else {
        playScanFeedback('INVALID');
        setLatestResult({
          type: 'INVALID_SIGNATURE',
          title: 'REGISTRATION NOT FOUND',
          message: data.message || 'No matching Registration No or Pass ID found.',
          scannedByDevice: deviceId,
          scannedByOperator: 'Admin',
          timestamp: new Date().toLocaleTimeString()
        });
      }
    } catch (err: any) {
      toast.error(`Manual entry error: ${err.message}`);
    } finally {
      setManualLoading(false);
    }
  };

  // Turnout percentage calculations
  const totalConfirmed = serverStats?.totalConfirmed || 0;
  const presentCount = serverStats?.presentCount || 0;
  const turnoutPercent = totalConfirmed > 0 ? ((presentCount / totalConfirmed) * 100).toFixed(1) : '0';
  const activeGateDevices = serverStats?.activeDeviceCount || 1;

  return (
    <div className="space-y-4 max-w-xl mx-auto w-full pb-16 font-sans">
      
      {/* 1. Header & Multi-Device Live Gate Mesh Network Bar */}
      <div className="bg-white border border-stone-200/90 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full shadow-xs ${
                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <div className="flex items-center gap-1.5">
              <span className="font-black text-[11px] tracking-wider uppercase text-stone-800">
                {isOnline ? 'Live Gate Online' : 'Offline Mode (Local PWA)'}
              </span>
              {isOnline && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <RadioIcon className="w-3 h-3 text-emerald-700 animate-pulse" />
                  <span>{activeGateDevices} {activeGateDevices === 1 ? 'Device' : 'Devices'} Connected</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-stone-500 font-bold uppercase">Scanner ID:</span>
            <span className="font-mono text-[10px] text-rose-700 font-bold bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200/60">
              {deviceId}
            </span>
          </div>
        </div>

        {/* Selected Event Display & LuxurySelect Dropdown */}
        <div className="space-y-1">
          <LuxurySelect
            label="Active Seminar Batch"
            value={activeEventId}
            onChange={(val) => setSelectedProgramId(val)}
            options={programs.map((p) => ({
              value: p.id,
              label: p.name,
              sublabel: p.date
            }))}
          />
        </div>

        {/* Live Attendance Turnout Progress Bar */}
        {totalConfirmed > 0 && (
          <div className="pt-2 border-t border-stone-100 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-stone-700">
                Live Attendance Turnout: <span className="text-emerald-700">{turnoutPercent}%</span>
              </span>
              <span className="text-stone-500 font-mono text-[11px]">
                {presentCount} / {totalConfirmed} Couples Checked In
              </span>
            </div>
            <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden border border-stone-200/80">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, Number(turnoutPercent)))}%` }}
              />
            </div>
          </div>
        )}

        {/* Live Attendance Stats Ribbon (4 Metric Cards) */}
        <div className="grid grid-cols-4 gap-2 pt-1 text-center">
          <div className="bg-emerald-50/80 rounded-xl p-2 border border-emerald-200/70">
            <span className="text-[9px] font-extrabold text-emerald-800 uppercase tracking-wider block">Present</span>
            <span className="text-sm sm:text-base font-black text-emerald-700 font-mono">
              {serverStats?.presentCount ?? '--'}
            </span>
            <span className="text-[8px] text-emerald-600 block font-semibold leading-tight mt-0.5">
              {serverStats?.presentCount ? `${serverStats.presentCount * 2} inside` : 'Couples'}
            </span>
          </div>

          <div className="bg-stone-50 rounded-xl p-2 border border-stone-200">
            <span className="text-[9px] font-extrabold text-stone-600 uppercase tracking-wider block">Remaining</span>
            <span className="text-sm sm:text-base font-black text-stone-700 font-mono">
              {serverStats?.remaining ?? '--'}
            </span>
            <span className="text-[8px] text-stone-500 block font-semibold leading-tight mt-0.5">
              Couples
            </span>
          </div>

          <div className="bg-amber-50/80 rounded-xl p-2 border border-amber-200/70">
            <span className="text-[9px] font-extrabold text-amber-800 uppercase tracking-wider block">Duplicates</span>
            <span className="text-sm sm:text-base font-black text-amber-700 font-mono">
              {serverStats?.duplicateScans ?? '--'}
            </span>
            <span className="text-[8px] text-amber-600 block font-semibold leading-tight mt-0.5">
              Stopped
            </span>
          </div>

          <div className="bg-rose-50/70 rounded-xl p-2 border border-rose-200/60">
            <span className="text-[9px] font-extrabold text-rose-800 uppercase tracking-wider block">Active Gates</span>
            <span className="text-sm sm:text-base font-black text-rose-700 font-mono">
              {activeGateDevices}
            </span>
            <span className="text-[8px] text-rose-600 block font-semibold leading-tight mt-0.5">
              Phones
            </span>
          </div>
        </div>
      </div>

      {/* 2. Light Theme Precision Auto-Capture Camera Viewport */}
      <div className="bg-white border-2 border-stone-200/90 rounded-3xl overflow-hidden shadow-lg relative min-h-[380px] sm:min-h-[420px] flex flex-col justify-between items-center p-4 sm:p-5">
        {/* Hidden Canvas for QR decoding */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Hidden File Input for Image/Screenshot Scanner */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageFileSelected}
        />

        {/* Top Camera Controls Ribbon (Light Theme) */}
        <div className="w-full flex items-center justify-between z-20">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleToggleFacingMode}
              className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-800 rounded-xl transition-all cursor-pointer text-xs font-bold flex items-center gap-1.5 border border-stone-200 shadow-xs"
              title="Switch Camera Lens"
            >
              <CameraIcon className="w-3.5 h-3.5 text-rose-600" />
              <span>{facingMode === 'environment' ? 'Rear' : 'Front'}</span>
            </button>

            {torchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`px-2.5 py-1.5 rounded-xl transition-all cursor-pointer text-xs font-bold flex items-center gap-1.5 border shadow-xs ${
                  torchOn
                    ? 'bg-amber-400 border-amber-500 text-stone-950 font-black'
                    : 'bg-stone-100 border-stone-200 text-stone-800 hover:bg-stone-200'
                }`}
                title="Toggle Torch"
              >
                <FlashlightIcon className="w-3.5 h-3.5 text-amber-600" />
                <span>{torchOn ? 'Torch On' : 'Torch'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl transition-all cursor-pointer text-xs font-bold flex items-center gap-1.5 border border-stone-200 shadow-xs"
              title="Upload QR Image"
            >
              <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
              <span>Photo</span>
            </button>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
              cameraActive
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 animate-pulse'
                : 'bg-stone-100 text-stone-500 border border-stone-200'
            }`}
          >
            {cameraActive ? (isScanningCooldown ? 'Scanning...' : 'Auto-Capture Active') : 'Paused'}
          </span>
        </div>

        {/* Center Viewport Frame */}
        <div className="relative w-full aspect-square max-w-[300px] sm:max-w-[320px] my-auto flex items-center justify-center bg-stone-100 rounded-2xl overflow-hidden border-2 border-stone-200 shadow-inner">
          <video
            ref={videoRef}
            className={`w-full h-full object-cover rounded-2xl ${cameraActive ? 'block' : 'hidden'}`}
            playsInline
            muted
            autoPlay
          />

          {cameraActive && (
            /* Precision Laser Target Overlay */
            <div className="absolute inset-3.5 pointer-events-none rounded-2xl flex flex-col justify-between p-2">
              {/* Corner Targets */}
              <div className="flex justify-between">
                <span className="w-6 h-6 border-t-[3.5px] border-l-[3.5px] border-rose-600 rounded-tl-lg shadow-sm" />
                <span className="w-6 h-6 border-t-[3.5px] border-r-[3.5px] border-rose-600 rounded-tr-lg shadow-sm" />
              </div>

              {/* Animated Laser Scanning Line */}
              <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-rose-600 to-transparent shadow-[0_0_10px_rgba(225,29,72,0.8)] animate-scan-laser pointer-events-none" />

              {/* Center Guidance Badge */}
              <div className="text-center z-10">
                <span className="bg-white/95 text-rose-800 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border border-rose-200 shadow-md">
                  Align QR Code in Frame
                </span>
              </div>

              <div className="flex justify-between">
                <span className="w-6 h-6 border-b-[3.5px] border-l-[3.5px] border-rose-600 rounded-bl-lg shadow-sm" />
                <span className="w-6 h-6 border-b-[3.5px] border-r-[3.5px] border-rose-600 rounded-br-lg shadow-sm" />
              </div>
            </div>
          )}

          {!cameraActive && (
            <div className="flex flex-col items-center justify-center text-center p-6 text-stone-600 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-white border border-stone-200 flex items-center justify-center text-rose-600 shadow-sm">
                <CameraIcon className="w-7 h-7" />
              </div>
              <p className="text-xs font-bold text-stone-700 max-w-[220px]">
                Camera is paused or initializing. Tap below to resume auto-capture scanning.
              </p>
              {cameraError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-2.5 rounded-xl leading-relaxed text-left max-w-[260px]">
                  <strong>Notice:</strong> {cameraError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Camera Action Button */}
        <div className="w-full z-20 pt-2">
          {cameraActive ? (
            <button
              type="button"
              onClick={stopCamera}
              className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 border border-stone-200 text-stone-700 font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            >
              Pause Camera
            </button>
          ) : (
            <button
              type="button"
              onClick={startCamera}
              className="w-full py-3.5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-600/25 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <CameraIcon className="w-4 h-4" />
              <span>Resume Auto-Capture Scanner</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Real-Time Attendee Verification Card with Couple Photo & Auto-Dismiss */}
      {latestResult && (
        <div
          onClick={() => setLatestResult(null)}
          className={`rounded-3xl p-5 border shadow-2xl transition-all animate-in fade-in-50 duration-200 relative overflow-hidden bg-white cursor-pointer ${
            latestResult.type === 'VALID' || latestResult.type === 'VALID_OFFLINE'
              ? 'border-emerald-400 text-emerald-950 ring-4 ring-emerald-500/10'
              : latestResult.type === 'ALREADY_SCANNED'
              ? 'border-amber-400 text-amber-950 ring-4 ring-amber-500/15'
              : 'border-rose-400 text-rose-950 ring-4 ring-rose-500/15'
          }`}
          title="Tap anywhere to dismiss and scan next attendee"
        >
          {/* Top Status Banner */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {latestResult.type === 'VALID' || latestResult.type === 'VALID_OFFLINE' ? (
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                  <CheckCircleIcon className="w-7 h-7" />
                </div>
              ) : latestResult.type === 'ALREADY_SCANNED' ? (
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                  <AlertTriangleIcon className="w-7 h-7" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                  <AlertTriangleIcon className="w-7 h-7" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black tracking-tight">{latestResult.title}</h3>
                  <span
                    className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      latestResult.type === 'VALID' || latestResult.type === 'VALID_OFFLINE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : latestResult.type === 'ALREADY_SCANNED'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {latestResult.type === 'VALID' || latestResult.type === 'VALID_OFFLINE'
                      ? '2 Adults Admitted'
                      : latestResult.type === 'WRONG_EVENT'
                      ? 'Old Seminar / Wrong Batch'
                      : latestResult.type === 'ALREADY_SCANNED'
                      ? 'Duplicate Entry'
                      : latestResult.type}
                  </span>
                </div>
                <p className="text-xs text-stone-600 mt-0.5 font-medium">{latestResult.message}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLatestResult(null);
              }}
              className="text-stone-400 hover:text-stone-700 p-1.5 rounded-full hover:bg-stone-100 transition-colors"
              aria-label="Dismiss Card"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Attendee Details & Couple Photo Thumbnail */}
          {(latestResult.coupleName || latestResult.inquiryId || latestResult.passId) && (
            <div className="mt-4 pt-3.5 border-t border-stone-100">
              <div className="flex items-start gap-3.5">
                {/* Couple Photo Thumbnail with fallback & click to expand */}
                <div
                  className="relative flex-shrink-0 cursor-pointer group"
                  onClick={(e) => {
                    if (latestResult.couplePhoto && !photoError) {
                      e.stopPropagation();
                      setShowPhotoModal(true);
                    }
                  }}
                  title={latestResult.couplePhoto ? "Tap to inspect enlarged photo" : undefined}
                >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-stone-200 shadow-md bg-stone-100 flex items-center justify-center relative">
                    <img
                      key={latestResult.passId || latestResult.inquiryId || latestResult.couplePhoto || 'photo'}
                      src={photoError || !latestResult.couplePhoto ? '/sample_couple.png' : resolveDisplayImageUrl(latestResult.couplePhoto, 'normal')}
                      alt={latestResult.coupleName || 'Couple Photo'}
                      onError={() => setPhotoError(true)}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                    {latestResult.couplePhoto && !photoError && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center pointer-events-none">
                        <ImageIcon className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 drop-shadow-md transition-opacity" />
                      </div>
                    )}
                  </div>
                  {latestResult.isVip && (
                    <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-stone-950 font-black text-[9px] px-2 py-0.5 rounded-full shadow-xs border border-amber-300">
                      VIP
                    </span>
                  )}
                </div>

                {/* Names & VIP Ribbon */}
                <div className="flex-1 min-w-0 space-y-1">
                  {latestResult.isVip && (
                    <div className="inline-flex items-center gap-1 bg-amber-50 border border-amber-300 text-amber-900 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase">
                      <span>VIP PASS &bull; PRIORITY SEATING</span>
                    </div>
                  )}

                  {latestResult.coupleName && (
                    <div className="truncate">
                      <span className="text-[10px] uppercase font-extrabold text-stone-500 block tracking-wider">
                        Couple Names
                      </span>
                      <span className="font-black text-stone-900 text-base sm:text-lg block leading-tight truncate">
                        {latestResult.coupleName}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs flex-wrap pt-0.5">
                    {latestResult.inquiryId && (
                      <span className="font-mono font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60 text-[11px]">
                        {latestResult.inquiryId}
                      </span>
                    )}
                    {latestResult.phoneNumber && (
                      <span className="text-[11px] text-stone-600 font-bold flex items-center gap-1">
                        <PhoneIcon className="w-3 h-3 text-stone-400" />
                        <span>{latestResult.phoneNumber}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Gate Device & Operator Audit Strip */}
              <div className="mt-3 bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-[11px] text-stone-700 space-y-1">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-bold text-stone-900">
                    Gate Staff: {latestResult.scannedByOperator || 'Gate Staff'} ({latestResult.scannedByDevice || deviceId})
                  </span>
                  <span className="text-stone-500 font-mono text-[10px]">
                    {latestResult.timestamp}
                  </span>
                </div>

                {latestResult.firstScannedAt && (
                  <div className="text-amber-900 font-bold pt-1 border-t border-amber-200/70 text-[11px] flex items-center justify-between">
                    <span>
                      First Check-in: {new Date(latestResult.firstScannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className="text-[10px] text-amber-700 font-mono">
                      Scan #{latestResult.scanCount || 2}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action & Smooth Countdown Bar */}
          <div className="mt-4 pt-3 border-t border-stone-100 space-y-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLatestResult(null);
              }}
              className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-extrabold rounded-xl text-xs transition-all shadow-sm cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <span>Admit Next Couple</span>
              <span className="text-stone-400 text-[10px] font-medium">(Tap anywhere to scan next)</span>
            </button>

            {/* Hardware-accelerated CSS countdown line indicator (Zero React state churn) */}
            <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                key={latestResult.timestamp}
                className="h-full bg-rose-600 rounded-full"
                style={{
                  animation: 'shrinkProgress 3600ms linear forwards'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Expanded Couple Photo Modal */}
      {showPhotoModal && latestResult?.couplePhoto && !photoError && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in-50 duration-150"
          onClick={() => setShowPhotoModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-4 max-w-sm w-full shadow-2xl border border-stone-200 relative space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-stone-100">
              <div>
                <h4 className="font-black text-sm text-stone-900 truncate">
                  {latestResult.coupleName || 'Attendee Photo'}
                </h4>
                <p className="text-[10px] text-stone-500 font-mono">
                  {latestResult.inquiryId || latestResult.passId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-full hover:bg-stone-100"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-square w-full rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shadow-inner">
              <img
                src={resolveDisplayImageUrl(latestResult.couplePhoto, 'large')}
                alt={latestResult.coupleName || 'Attendee Photo'}
                className="w-full h-full object-cover"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowPhotoModal(false)}
              className="w-full py-2.5 bg-stone-900 text-white font-bold text-xs rounded-xl hover:bg-stone-800 transition-colors"
            >
              Close Inspection
            </button>
          </div>
        </div>
      )}

      {/* 4. Manual Fallback Input Form */}
      <div className="bg-white border border-stone-200/90 rounded-3xl p-4 sm:p-5 shadow-xs space-y-2.5">
        <label className="text-[11px] font-extrabold text-stone-700 uppercase tracking-wider block">
          Fast Gate Entry: Mobile No / Pass ID / Inquiry Lookup
        </label>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Mobile No (e.g. 9876543210), Inquiry ID, or Pass ID"
            className="flex-1 bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 focus:outline-none font-mono"
          />
          <button
            type="submit"
            disabled={manualLoading || !manualCode.trim()}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm flex-shrink-0"
          >
            {manualLoading ? 'Checking...' : 'Verify'}
          </button>
        </form>
      </div>

      {/* 5. Offline Gate Readiness & Batch Synchronization */}
      <div className="bg-white border border-stone-200/90 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 className="text-xs font-extrabold text-stone-800 uppercase tracking-wider">
              Offline Gate Readiness
            </h4>
            <p className="text-[11px] text-stone-500 mt-0.5 font-medium">
              {preparedEvent ? `Cached: ${preparedEvent.eventName}` : 'No offline roster cached'}
            </p>
          </div>
          <button
            type="button"
            onClick={handlePrepareOffline}
            disabled={isPrepping || !isOnline}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-300 disabled:opacity-40 text-stone-800 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
          >
            <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isPrepping ? 'Preparing...' : 'Prepare Offline'}</span>
          </button>
        </div>

        {prepSuccessMessage && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs p-2.5 rounded-xl font-bold flex items-center gap-1.5">
            <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>{prepSuccessMessage}</span>
          </div>
        )}

        {/* Sync Status Bar */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-100 text-xs flex-wrap gap-2">
          <div className="space-y-0.5">
            <span className="font-bold text-stone-700 block">
              Pending Scans: <strong className="text-amber-700 font-mono">{pendingCount}</strong>
            </span>
            <span className="text-[10px] text-stone-400">
              Synced: {syncedCount} &bull; Conflicts: {conflictCount}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSyncScans}
            disabled={isSyncing || pendingCount === 0 || !isOnline}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCwIcon className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : `Sync Batch (${pendingCount})`}</span>
          </button>
        </div>
      </div>

      {/* Hardware-accelerated CSS Keyframe Animations */}
      <style jsx global>{`
        @keyframes shrinkProgress {
          0% {
            width: 100%;
          }
          100% {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
};
