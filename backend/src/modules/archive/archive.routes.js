import { Router } from 'express';
import {
  archiveHealth,
  claimSingleArchiveJob,
  claimEventArchiveBatch,
  claimArchiveBatch,
  verifyArchivedItem,
  failArchivedItem,
  getArchiveCandidates,
  queueSingleAsset,
  queueEventArchive,
  getArchiveJobs,
  retryFailedJobs
} from './archive.controller.js';
import { requireSuperAuth, requireArchiveWorkerAuth } from '../../middleware/auth.js';

export const archiveRouter = Router();

// =========================================================
// 1. Google-side Worker Endpoints (Protected by ARCHIVE_WORKER_SECRET)
// =========================================================
archiveRouter.get('/health', requireArchiveWorkerAuth, archiveHealth);
archiveRouter.post('/health', requireArchiveWorkerAuth, archiveHealth);
archiveRouter.post('/claim-one', requireArchiveWorkerAuth, claimSingleArchiveJob);
archiveRouter.post('/claim-event-batch', requireArchiveWorkerAuth, claimEventArchiveBatch);
archiveRouter.get('/claim-event-batch', requireArchiveWorkerAuth, claimEventArchiveBatch);
archiveRouter.post('/claim-batch', requireArchiveWorkerAuth, claimArchiveBatch);
archiveRouter.get('/claim-batch', requireArchiveWorkerAuth, claimArchiveBatch);
archiveRouter.post('/verify-item', requireArchiveWorkerAuth, verifyArchivedItem);
archiveRouter.post('/fail-item', requireArchiveWorkerAuth, failArchivedItem);

// =========================================================
// 2. Super Admin Endpoints (Protected by requireSuperAuth)
// =========================================================
archiveRouter.get('/candidates', requireSuperAuth, getArchiveCandidates);
archiveRouter.post('/queue-single', requireSuperAuth, queueSingleAsset);
archiveRouter.post('/queue-event', requireSuperAuth, queueEventArchive);
archiveRouter.get('/jobs', requireSuperAuth, getArchiveJobs);
archiveRouter.post('/retry-failed', requireSuperAuth, retryFailedJobs);
