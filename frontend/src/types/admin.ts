export type AdminRole = 'superadmin' | 'admin' | 'guest';

export type AdminSection = 
  | 'dashboard'
  | 'scanner'
  | 'programs'
  | 'registrations'
  | 'vip_passes'
  | 'finance'
  | 'whatsapp'
  | 'whatsapp_inbox'
  | 'settings'
  | 'resources'
  | 'integrations'
  | 'storage';

export interface DatabaseStats {
  dataSizeMB: number;
  storageSizeMB: number;
  totalLimitMB: number;
}

export interface AdminNotification {
  _id: string;
  type: 'info' | 'warning' | 'error';
  title?: string;
  message: string;
  createdAt?: string;
}

export interface SiteSettings {
  upiId: string;
  payeeName: string;
  amount: number | string;
  upiIds?: string | string[];
  upiLimit?: number;
  brandName?: string;
  businessCategory?: string;
  businessDescription?: string;
  supportPhone?: string;
  supportWhatsapp?: string;
  supportEmail?: string;
  websiteEmail?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  linktreeUrl?: string;
  manishYoutubeUrl?: string;
  manishInstagramUrl?: string;
  manishFacebookUrl?: string;
  manishLinkedinUrl?: string;
  manishTwitterUrl?: string;
  defaultCity?: string;
  defaultCountry?: string;
  defaultCurrency?: string;
  defaultPrice?: number;
  defaultSpeakerName?: string;
  defaultSpeakerTitle?: string;
  defaultRegistrationInstructions?: string;
  defaultPassInstructions?: string;
  defaultFooterCopy?: string;
}

export interface ArchiveCandidate {
  id: string;
  name: string;
  date: string;
  city: string;
  status: string;
  isCompleted: boolean;
  archiveStatus: string;
  isCurrentlyActive?: boolean;
  totalRegistrations: number;
  eligibleCouplePhotos: number;
  archivedAssets: number;
  queuedAssets: number;
  copyingAssets?: number;
  failedAssets?: number;
  progressPercent?: number;
  estimatedSizeMB: number;
}

export interface MediaArchiveJob {
  _id: string;
  eventId: string;
  registrationId?: string;
  mediaType: string;
  sourceProvider: string;
  sourcePublicId: string;
  sourceUrl: string;
  destinationProvider: string;
  driveFileId?: string;
  filename: string;
  mimeType: string;
  originalSize: number;
  status: 'ACTIVE' | 'QUEUED' | 'COPYING' | 'COPIED' | 'VERIFIED' | 'DELETE_PENDING' | 'ARCHIVED' | 'FAILED';
  operationalThumbnailUrl?: string;
  operationalThumbnailPublicId?: string;
  thumbnailSizeBytes?: number;
  cloudinaryOriginalStatus?: 'ACTIVE' | 'DELETE_READY' | 'DELETED' | 'DELETE_FAILED';
  cloudinaryOriginalDeletedAt?: string;
  attempts: number;
  lastError?: string;
  queuedAt?: string;
  verifiedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BackupRecordItem {
  _id: string;
  backupId: string;
  type: 'daily' | 'weekly' | 'monthly' | 'manual' | 'event_final';
  scheduled?: boolean;
  periodKey?: string;
  eventId?: string;
  status: 'pending' | 'creating' | 'created' | 'syncing' | 'verified' | 'sync_failed' | 'failed';
  size: number;
  checksum: string;
  driveFileId?: string;
  driveManifestFileId?: string;
  driveFolderId?: string;
  driveVerifiedAt?: string;
  manifest?: any;
  startedAt: string;
  completedAt?: string;
  lastError?: string;
}
