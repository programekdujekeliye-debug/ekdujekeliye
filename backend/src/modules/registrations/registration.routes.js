import { Router } from 'express';
import multer from 'multer';
import {
  submitRegistration,
  getRegistrationStatus,
  approveRegistration,
  rejectRegistration,
  markAttendance,
  bulkUpdateAttendance,
  attendanceByAbsentees,
  bulkMoveSubmissions,
  manualInviteeRegistration,
  getSubmissionsList,
  getDuplicateSubmissions,
  getTrashSubmissions,
  restoreSubmission,
  permanentDeleteSubmission,
  softDeleteSubmission,
  updateSubmission,
  bulkDeleteSubmissions,
  getCouplePhotoRedirect,
  getPaymentScreenshotRedirect
} from './registration.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const upload = multer({ storage: multer.memoryStorage() });
export const registrationRouter = Router();

// Public registration & status routes
registrationRouter.post('/submit', upload.fields([{ name: 'couplePhoto', maxCount: 1 }]), submitRegistration);
registrationRouter.get('/status/:inquiryId', getRegistrationStatus);

// Direct Cloudinary CDN Redirects
registrationRouter.get('/:inquiryId/photo', getCouplePhotoRedirect);
registrationRouter.get('/:inquiryId/screenshot', getPaymentScreenshotRedirect);

// Admin Listing & Sub-resources
registrationRouter.get('/', requireAuth, getSubmissionsList);
registrationRouter.get('/list', requireAuth, getSubmissionsList);
registrationRouter.get('/duplicates', requireAuth, getDuplicateSubmissions);
registrationRouter.get('/trash', requireAuth, getTrashSubmissions);

// Admin Bulk Operations
registrationRouter.post('/manual', requireAuth, upload.fields([{ name: 'couplePhoto', maxCount: 1 }]), manualInviteeRegistration);
registrationRouter.post('/bulk-attendance', requireAuth, bulkUpdateAttendance);
registrationRouter.post('/attendance-by-absentees', requireAuth, attendanceByAbsentees);
registrationRouter.post('/bulk-move', requireAuth, bulkMoveSubmissions);
registrationRouter.post('/bulk-delete', requireAuth, bulkDeleteSubmissions);

// Admin Single Record Operations
registrationRouter.post('/:inquiryId/approve', requireAuth, approveRegistration);
registrationRouter.post('/:inquiryId/reject', requireAuth, rejectRegistration);
registrationRouter.post('/:inquiryId/attendance', requireAuth, markAttendance);
registrationRouter.post('/:inquiryId/restore', requireAuth, restoreSubmission);
registrationRouter.delete('/:inquiryId/permanent', requireAuth, permanentDeleteSubmission);
registrationRouter.delete('/:inquiryId', requireAuth, softDeleteSubmission);
registrationRouter.put('/:inquiryId', requireAuth, updateSubmission);
