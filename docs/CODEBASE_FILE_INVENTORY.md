# Codebase File Inventory

Generated from the repository on 2026-09-11T13:53:53.263Z. This is a mechanical audit index of every code file, excluding dependencies, build output, backups, CSV data, and binary media.

## Coverage summary

| Area | Files | Lines |
|---|---:|---:|
| Backend integrations | 7 | 2407 |
| Backend jobs | 2 | 480 |
| Backend models | 19 | 1061 |
| Backend modules | 35 | 13979 |
| Backend operations scripts | 239 | 18996 |
| Backend platform | 13 | 1081 |
| Backend services | 5 | 1750 |
| Backend tests | 18 | 3838 |
| Backend tooling | 4 | 59 |
| Backend workers | 3 | 470 |
| Frontend components | 11 | 2418 |
| Frontend features | 40 | 20748 |
| Frontend routes | 27 | 8200 |
| Frontend services | 15 | 1974 |
| Frontend shared | 13 | 1011 |
| Frontend tooling | 6 | 371 |
| Repository scripts | 3 | 1592 |
| **Total** | **460** | **80435** |

> This inventory proves coverage and helps locate change surfaces. It does not replace reading a target file and all of its callers before editing.

## Backend integrations

| File | LOC | Detected responsibility |
|---|---:|---|
| `backend/src/integrations/cloudinary/cloudinary.provider.js` | 56 | Exports: CloudinaryStorageProvider, cloudinaryProvider |
| `backend/src/integrations/google-drive/google-drive.provider.js` | 24 | Exports: GoogleDriveStorageProvider, googleDriveProvider |
| `backend/src/integrations/r2/r2.provider.js` | 325 | Exports: R2StorageProvider, r2Provider |
| `backend/src/integrations/razorpay/razorpay.service.js` | 119 | Exports: getRazorpayKeyId, createRazorpayOrder, verifyCheckoutSignature, verifyWebhookSignature, fetchPayment, fetchOrder (+1) |
| `backend/src/integrations/whatsapp/templateRegistry.js` | 562 | Exports: CORE_TEMPLATES, TEMPLATE_REGISTRY, validateTemplateVariables, renderTemplatePreview |
| `backend/src/integrations/whatsapp/whatsapp.service.js` | 1130 | Exports: getCachedMetaTemplateStatus, hashPhoneNumber, maskPhoneNumber, formatMetaErrorMessage, normalizeWhatsAppRecipient, getWhatsAppConfigStatus (+8) |
| `backend/src/integrations/whatsapp/whatsappTemplate.service.js` | 191 | Exports: whatsappTemplateService |

## Backend jobs

| File | LOC | Detected responsibility |
|---|---:|---|
| `backend/src/jobs/backup.job.js` | 312 | Exports: getPeriodKey, and, runDatabaseBackup, ensureScheduledBackup, runNightlyBackupRoutine, initializeBackupCron |
| `backend/src/jobs/paymentReminders.job.js` | 168 | Exports: runPaymentReminders |

## Backend models

| File | LOC | Detected responsibility |
|---|---:|---|
| `backend/src/models/AuditLog.js` | 22 | MongoDB model: AuditLog |
| `backend/src/models/BackupRecord.js` | 51 | MongoDB model: BackupRecord |
| `backend/src/models/Counter.js` | 47 | MongoDB model: Counter |
| `backend/src/models/Event.js` | 98 | MongoDB model: Program |
| `backend/src/models/Feedback.js` | 29 | MongoDB model: Feedback |
| `backend/src/models/Job.js` | 31 | MongoDB model: Job |
| `backend/src/models/MediaArchive.js` | 79 | MongoDB model: MediaArchive |
| `backend/src/models/Notification.js` | 15 | MongoDB model: Notification |
| `backend/src/models/Pass.js` | 82 | MongoDB model: Pass |
| `backend/src/models/Payment.js` | 28 | MongoDB model: Payment |
| `backend/src/models/Registration.js` | 148 | MongoDB model: Submission |
| `backend/src/models/ScanRecord.js` | 38 | MongoDB model: ScanRecord |
| `backend/src/models/Setting.js` | 53 | MongoDB model: Setting |
| `backend/src/models/UploadSession.js` | 42 | MongoDB model: UploadSession |
| `backend/src/models/VipLink.js` | 81 | MongoDB model: VipLink |
| `backend/src/models/WebhookEvent.js` | 18 | MongoDB model: WebhookEvent |
| `backend/src/models/WhatsappConversation.js` | 54 | MongoDB model: WhatsappConversation |
| `backend/src/models/WhatsappMessage.js` | 114 | MongoDB model: WhatsappMessage |
| `backend/src/models/WhatsappTemplate.js` | 31 | MongoDB model: WhatsappTemplate |

## Backend modules

| File | LOC | Detected responsibility |
|---|---:|---|
| `backend/src/modules/admin/admin.controller.js` | 660 | Exports: getSystemResources, triggerDatabaseBackup, getIntegrationsStatus, getDbStatus, getSettings, updateSettings (+7) |
| `backend/src/modules/admin/admin.routes.js` | 35 | Routes: GET /dashboard, GET /super-dashboard, GET /system/resources, POST /system/backup, GET /system/integrations, GET /db-status, POST /clear-all-data, GET /settings (+3) |
| `backend/src/modules/archive/archive.controller.js` | 1530 | Exports: updateEventArchiveProgress, archiveHealth, claimActiveEventBatch, claimSingleArchiveJob, claimEventArchiveBatch, claimArchiveBatch (+14) |
| `backend/src/modules/archive/archive.routes.js` | 67 | Routes: GET /health, POST /health, POST /claim-one, POST /claim-active-event-batch, GET /claim-active-event-batch, POST /claim-event-batch, GET /claim-event-batch, POST /claim-batch (+23) |
| `backend/src/modules/backup/backup.controller.js` | 231 | Exports: ensureBackup, getBackupsList, runBackupNow, getBackupFile, getBackupManifest, recordBackupDriveSync |
| `backend/src/modules/backup/backup.routes.js` | 24 | Routes: GET /, POST /run, POST /ensure, GET /:backupId/file, GET /:backupId/manifest, POST /sync-drive, POST /verify-sync |
| `backend/src/modules/events/event.controller.js` | 520 | Exports: getPublicEvents, getEventBySlug, getEventOptions, getAdminEvents, createEvent, updateEvent (+6) |
| `backend/src/modules/events/event.routes.js` | 43 | Routes: GET /public, GET /options, GET /summary, GET /slug/:slug, GET /, POST /, GET /:id/enable-payment-preview, POST /:id/enable-payment (+6) |
| `backend/src/modules/events/event.service.js` | 601 | Exports: parseEventStartTimestamp, EventService, eventService |
| `backend/src/modules/feedback/feedback.controller.js` | 579 | Exports: getFeedbackForm, submitFeedback, ensureFeedbackToken, getAdminFeedbackStats, getAdminFeedbackList, toggleTestimonialPermission (+5) |
| `backend/src/modules/feedback/feedback.routes.js` | 31 | Routes: GET /public/testimonials, GET /admin/stats, GET /admin/list, GET /admin/export, POST /admin/:id/toggle-testimonial, POST /admin/:id/reset, DELETE /admin/:id, GET /:token (+1) |
| `backend/src/modules/finance/finance.controller.js` | 16 | Exports: getFinancialSummary |
| `backend/src/modules/finance/finance.routes.js` | 9 | Routes: GET /overview |
| `backend/src/modules/finance/finance.service.js` | 121 | Exports: FinanceService, financeService |
| `backend/src/modules/invitations/invitation.controller.js` | 83 | Exports: getInvitationCard, downloadInvitationCard, getInvitationCardJpeg |
| `backend/src/modules/invitations/invitation.routes.js` | 11 | Routes: GET /:inquiryId/card.jpg, GET /:inquiryId, GET /:inquiryId/preview, GET /:inquiryId/download |
| `backend/src/modules/media/media.controller.js` | 812 | Exports: warmRegistrationMediaCache, invalidateRegistrationMediaCache, createUploadSession, getDirectUploadUrl, completeUpload, getPrivateCouplePhoto (+4) |
| `backend/src/modules/media/media.routes.js` | 32 | Routes: POST /upload-session, POST /upload-url, POST /upload-complete, GET /:registrationId/couple-photo, GET /:registrationId/payment-proof, POST /:registrationId/view-token, GET /:registrationId/view-token, GET /:registrationId/preview (+1) |
| `backend/src/modules/media/media.service.js` | 496 | Exports: MediaService, mediaService |
| `backend/src/modules/passes/pass.controller.js` | 159 | Exports: getPassDetails, getPublicKey |
| `backend/src/modules/passes/pass.routes.js` | 8 | Routes: GET /public-key, GET /:inquiryId |
| `backend/src/modules/passes/qrPass.service.js` | 330 | Exports: canonicalStringify, signPassPayload, verifyPassToken, getPublicKeyInfo, ensurePass, getPassByInquiryId (+4) |
| `backend/src/modules/payments/payment.controller.js` | 196 | Exports: createOrder, verifyPayment, handleRazorpayWebhook, getPaymentStatus |
| `backend/src/modules/payments/payment.routes.js` | 15 | Routes: POST /create-order, POST /verify, POST /webhook, GET /status/:inquiryId |
| `backend/src/modules/payments/payment.service.js` | 485 | Exports: PaymentService, paymentService |
| `backend/src/modules/registrations/registration.controller.js` | 1719 | Exports: clearSubmissionsCache, submitRegistration, getRegistrationStatus, approveRegistration, rejectRegistration, markAttendance (+18) |
| `backend/src/modules/registrations/registration.routes.js` | 67 | Routes: POST /submit, POST /vip-request, GET /status/:inquiryId, GET /:inquiryId/photo, GET /:inquiryId/screenshot, GET /, GET /list, GET /duplicates (+16) |
| `backend/src/modules/registrations/registration.service.js` | 472 | Exports: RegistrationService, registrationService |
| `backend/src/modules/scanner/scanner.controller.js` | 911 | Exports: invalidateLiveAttendanceStatsCache, getEventLiveAttendanceStats, handleOnlineScan, prepareOfflineEvent, handleOfflineSync, handleManualAttendance (+2) |
| `backend/src/modules/scanner/scanner.routes.js` | 20 | Routes: POST /scan, POST /prepare, POST /sync, POST /manual, GET /stats, POST /reset |
| `backend/src/modules/vip/vipLink.controller.js` | 289 | Exports: checkVipLink, getVipLinks, createVipLink, updateVipLink, toggleVipLinkStatus, deleteVipLink |
| `backend/src/modules/vip/vipLink.routes.js` | 24 | Routes: GET /check, GET /, POST /, PATCH /:id, POST /:id/toggle, DELETE /:id |
| `backend/src/modules/whatsapp/whatsapp.controller.js` | 2925 | Exports: invalidateEventRegsCommCache, handleVerification, handleEvents, getMetaTemplates, sendTestMessage, getWhatsappLogs (+32) |
| `backend/src/modules/whatsapp/whatsapp.routes.js` | 96 | Routes: GET /webhook, POST /webhook, GET /conversations/stats, GET /conversations, POST /conversations/check-phone, POST /conversations/sync, POST /simulate-inbound, GET /conversations/:conversationId (+30) |
| `backend/src/modules/whatsapp/whatsappBroadcast.controller.js` | 362 | Exports: getBroadcastOverview, getBroadcastLogs, launchBroadcastCampaign |

## Backend operations scripts

| File | LOC | Detected responsibility |
|---|---:|---|
| `backend/scripts/activate_ek06_ek07_normal_mode.js` | 557 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/analyze_cloudinary_storage.js` | 44 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/analyze_csv_recipients.js` | 77 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/analyze_csv.js` | 49 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/audit_and_configure_invitation_ek06_ek07.js` | 99 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/audit_and_heal_passes.js` | 146 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/audit_assets_by_event.js` | 103 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/audit_counters.js` | 24 | MongoDB model: Counter |
| `backend/scripts/audit_unpaid_exported.js` | 25 | MongoDB model: Submission |
| `backend/scripts/audit_upcoming_events.js` | 137 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/audit_vip_counts.js` | 106 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/audit_vip_gaps.js` | 51 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/audit_whatsapp_messages.js` | 50 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/benchmark-admin-read-endpoints.js` | 132 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/broadcast_jamnagar_hall_pass.js` | 265 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/broadcast_jamnagar_show.js` | 243 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/broadcast_marketing_cohort.js` | 107 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/broadcast_september_share.js` | 193 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/calc_verified_size.js` | 36 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_archive_details.js` | 65 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_cld_resource_path.js` | 36 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_count.js` | 22 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_current_state.js` | 60 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_drive_ids.js` | 44 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_drive_images.js` | 58 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_events.js` | 31 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_failed_replacements.js` | 62 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_gaps.js` | 31 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_invites_status.js` | 51 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_live_progress.js` | 30 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_morning_regs.js` | 26 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_payment_screenshots.js` | 31 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_production_db.js` | 37 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_r2_status.js` | 46 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_sept_records.js` | 57 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_september_status.js` | 23 | MongoDB model: WhatsappMessage |
| `backend/scripts/check_singular_plural.js` | 24 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_superseded.js` | 43 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_template_approval.js` | 23 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_verified_records.js` | 31 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_verified_samples.js` | 26 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_vip_list.js` | 83 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check_whatsapp_health.js` | 54 | MongoDB model: WhatsappMessage |
| `backend/scripts/check-all-templates.js` | 27 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check-sub-fields.js` | 17 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check-token.js` | 15 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/check-whatsapp-template-status.js` | 48 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/clean_whatsapp_conversations.js` | 221 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/cleanup_superseded_failures.js` | 56 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/cleanup_unpaid_exported_frames.js` | 43 | MongoDB model: Submission |
| `backend/scripts/cleanup_verified_event.js` | 289 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/cleanup_verified_past_events.js` | 231 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/cleanup-automated-whatsapp-test-artifacts.js` | 92 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/complete_media_inventory.js` | 371 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/count_cloudinary_folders.js` | 48 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/create-meta-template-button.js` | 60 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/create-meta-template.js` | 50 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/deep_lifecycle_check.js` | 135 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/delete_meta_template.js` | 23 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/diagnose-status.js` | 39 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/dry_run_requeue.js` | 62 | MongoDB model: WhatsappMessage, Submission |
| `backend/scripts/export_qr_signing_keys.js` | 30 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/fast_verify_activated.js` | 61 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/final_sync_12sep.js` | 109 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/find_bhavik.js` | 47 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/find_missing_4.js` | 84 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/fix_all_prices_1500.js` | 41 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/fix_gu_language_and_dispatch.js` | 59 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/fix_legacy_media_urls.js` | 70 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/fix_prod_ek06_05.js` | 65 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/fix_production_passes_firstScannedBy.js` | 55 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/fix_vip_flags.js` | 40 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/generate_roster_pdf.js` | 409 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/index-programs.js` | 29 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/index-submissions.js` | 26 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/ingest_vip_batch.js` | 172 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_48h.js` | 53 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_above_90.js` | 40 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_all_events_photos.js` | 57 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_archives_status.js` | 49 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_backups.js` | 32 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_batch2.js` | 50 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_broadcast_failures.js` | 56 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_candidates.js` | 32 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_cloudinary_detailed.js` | 84 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_cloudinary_folders.js` | 80 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_counts.js` | 42 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_due_24h.js` | 49 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_ek07_current.js` | 83 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_event_stats.js` | 31 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_event_templates.js` | 33 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_exact_301.js` | 48 | MongoDB model: Submission |
| `backend/scripts/inspect_failed_24h.js` | 62 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_failed_items.js` | 23 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_frame_export_counts.js` | 77 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_frame_export_status.js` | 56 | MongoDB model: Submission |
| `backend/scripts/inspect_inbound_convs.js` | 34 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_inbound.js` | 38 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_locked.js` | 16 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_null_errors.js` | 33 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_old_in_batch2.js` | 27 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_prod_clean.js` | 53 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_prod_db.js` | 23 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_prod_direct.js` | 44 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_prod_events.js` | 44 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_prod_full.js` | 46 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_prod_mongo.js` | 45 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_prod_programs.js` | 27 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_prod_wa.js` | 36 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_prog_2026_09_07.js` | 40 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_protected_vs_archive.js` | 80 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_reset_claimed_job.js` | 48 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_samples.js` | 31 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_sept11_failures.js` | 86 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_sept7_cohort.js` | 46 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_september_event_data.js` | 107 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_unprinted.js` | 31 | MongoDB model: Submission |
| `backend/scripts/inspect_wa_errors.js` | 34 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect_zips.ps1` | 30 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect-indexes.js` | 28 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/inspect-meta-templates.js` | 55 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/isolate_single_test_job.js` | 36 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/list_all_dbs.js` | 25 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/list_all_regs.js` | 17 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/list_collections.js` | 23 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/list_unprinted.js` | 44 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/list_verified_21aug.js` | 24 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/live_archive_tracker.js` | 169 | MongoDB model: BackupRecord |
| `backend/scripts/migrate_11sep_to_12sep.js` | 121 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/migrate_active_media_to_r2.js` | 309 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/migrate_all_ek01_to_ek06.js` | 171 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/migrate_couple_photos_to_private_r2.js` | 211 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/migrate_prod_r2_urls.js` | 141 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/migrate_r2_urls.js` | 60 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/migrate_remaining_to_private_r2.js` | 294 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/migrate_upcoming_vips_prefix.js` | 71 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/migrate-event-config-v2.js` | 93 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/migrate-old-1000-new-1500.js` | 86 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/monitor_and_drive_21aug_archive.js` | 30 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/monitor_approval_and_demo.js` | 158 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/optimize-gallery-images.js` | 79 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/pilot_inspection.js` | 51 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/poll_live_render.js` | 32 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/pre_seed_snapshot.js` | 55 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/preflight_archive_test.js` | 29 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/preflight_controlled_archive.js` | 63 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/prepare_manual_e2e_event.js` | 52 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/print_counters.js` | 20 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/print_prod_events.js` | 19 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/purge_obsolete_old_event_queued_messages.js` | 67 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/queue_and_fix_past_event_archives.js` | 130 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/queue_jamnaba_bhavan_archive.js` | 95 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/reconcile_24h.js` | 79 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/requeue_failed_september_dispatches.js` | 85 | MongoDB model: WhatsappMessage, Submission |
| `backend/scripts/requeue_payment_confirmations.js` | 156 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/reset_archive_states.js` | 47 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/reset_cpl527.js` | 12 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/reset_ek06_210_export_status.js` | 40 | MongoDB model: Submission |
| `backend/scripts/reset_false_verified_cpl559.js` | 59 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/reset_production_feedback.js` | 102 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/reset_test_feedback_and_attendance.js` | 89 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/reset-test-environment.js` | 54 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/retry_failed_jamnagar_broadcast.js` | 124 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/retry_remaining_hall_pass.js` | 188 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/run_manual_e2e_rehearsal.js` | 264 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/run-real-pipeline-test.js` | 314 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/sanitize_scripts_uris.js` | 25 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/scratch_check_duplicates.js` | 31 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/scratch_check_photos.js` | 43 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/scratch_check_prefixes.js` | 28 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/scratch_check_queued_details.js` | 47 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/scratch_check_queued_prefixes.js` | 36 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/scratch_check_queued.js` | 22 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/scratch_check_stats.js` | 39 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/scratch_check_subs.js` | 34 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/scratch_check_vips.js` | 21 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/scratch_diagnose_whatsapp.js` | 64 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/scratch_inspect_379.js` | 32 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/scratch_inspect_failures.js` | 22 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/scratch_inspect_prod_379.js` | 69 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/scratch_list_dbs.js` | 27 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/seed_past_events.js` | 447 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/seed_september_programs.js` | 139 | MongoDB model: Program |
| `backend/scripts/seed-local-events.js` | 156 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/send_test_jamnagar_hall_pass.js` | 82 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/send_test_jamnagar_show.js` | 79 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/send_test_marketing_message.js` | 52 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/send_test_post_event.js` | 62 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/send_test_september_share.js` | 73 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/send-test-whatsapp.js` | 107 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/set_tbd_event.js` | 35 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/set-event-prices-correctly.js` | 67 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/set-two-step-pin.js` | 67 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/submit_jamnagar_hall_pass_template.js` | 74 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/submit_jamnagar_template.js` | 56 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/submit-compliant-template.js` | 57 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/submit-core-templates.js` | 64 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/sync_all_invitation_cards.js` | 112 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/sync_indexes.js` | 32 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/sync_sept7_lifecycle.js` | 129 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_archived_viewer_and_upcoming.js` | 133 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_automatic_archive_system.js` | 164 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_backup_endpoints_and_security.js` | 81 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_candidate_query.js` | 45 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_claim_event_batch.js` | 48 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_conv_queries.js` | 47 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_dash_breakdown.js` | 28 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_dashboard_perf_prod.js` | 65 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_dashboard_perf.js` | 63 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_event_find.js` | 48 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_hardened_backup_orchestration.js` | 133 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_http_endpoints.js` | 116 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_negative_payment_rehearsal.js` | 94 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_nightly_backup_routine.js` | 52 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_r2_connectivity.js` | 110 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_retry_query.js` | 24 | MongoDB model: WhatsappMessage |
| `backend/scripts/test_send_diagnostic.js` | 30 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_single_pass_dispatch.js` | 57 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_stats_api.js` | 47 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_temp_to_payment_flow.js` | 218 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test_viewer_urls.js` | 33 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/test-query.js` | 22 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/update_event_capacity.js` | 18 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/update_prices.js` | 41 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/update-live-phone.js` | 47 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/upgrade_vip_media.js` | 134 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/validate_cleanup_pilot_and_safety_gate.js` | 263 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/verify_deleted_resource.js` | 43 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/verify_phase_b_migration.js` | 253 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/verify_post_archive.js` | 85 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/verify_prod_upcoming.js` | 39 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/verify_production_readiness.js` | 477 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/verify_sample_registrations.js` | 138 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/verify_seeded_production.js` | 85 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/verify_september_prices.js` | 33 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/verify_upcoming_events_health.js` | 77 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/verify_upcoming_milestones.js` | 46 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/verify-all-prices.js` | 31 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |
| `backend/scripts/watch_archive_progress.js` | 29 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |

## Backend platform

| File | LOC | Detected responsibility |
|---|---:|---|
| `backend/src/app.js` | 262 | Routes: GET /sample_couple.png, GET /api/health, GET /api/config/public, GET /api/public/home, GET /api/public/events/:slug, GET /api/auth/verify, GET /api/submissions/:inquiryId/photo, GET /api/submissions/:inquiryId/screenshot (+30) |
| `backend/src/config/cors.js` | 54 | Exports: corsMiddleware |
| `backend/src/config/database.js` | 33 | Exports: connectDatabase |
| `backend/src/config/env.js` | 240 | Exports: extractDatabaseName, maskSecret, normalizePhoneNumber, META_GRAPH_API_VERSION, getMetaGraphApiUrl, env |
| `backend/src/middleware/auth.js` | 116 | Exports: requireAuth, optionalAuth, requireSuperAuth, requireArchiveWorkerAuth, requireBackupWorkerAuth, requireCronAuth |
| `backend/src/middleware/errorHandler.js` | 19 | Exports: errorHandler |
| `backend/src/middleware/requestLogger.js` | 22 | Exports: requestLogger |
| `backend/src/server.js` | 116 | Exports: startServer |
| `backend/src/utils/dateFormat.js` | 110 | Exports: formatToDDMMYYYY, parseDateToISO, formatIndianDateDisplay |
| `backend/src/utils/logger.js` | 16 | Exports: logger |
| `backend/src/utils/mediaPresets.js` | 69 | Exports: MEDIA_PRESETS, getOptimizedPhotoUrl |
| `backend/src/utils/response.js` | 16 | Exports: sendSuccess, sendError |
| `backend/src/utils/slug.js` | 8 | Exports: generateEventSlug |

## Backend services

| File | LOC | Detected responsibility |
|---|---:|---|
| `backend/src/services/communicationScheduler.service.js` | 894 | Exports: CommunicationSchedulerService, communicationSchedulerService |
| `backend/src/services/eventInit.service.js` | 78 | Exports: ensureEarlyRegistrationEvents |
| `backend/src/services/invitationCard.service.js` | 559 | Exports: InvitationCardService, invitationCardService |
| `backend/src/services/storage.service.js` | 48 | Exports: StorageService, storageService |
| `backend/src/services/transferNotification.service.js` | 171 | Exports: TransferNotificationService, transferNotificationService |

## Backend tests

| File | LOC | Detected responsibility |
|---|---:|---|
| `backend/tests/test_communication_dashboard.js` | 284 | Executable regression/integration test |
| `backend/tests/test_communication_lifecycle.js` | 325 | Executable regression/integration test |
| `backend/tests/test_e2e_isolated_system.js` | 372 | Executable regression/integration test |
| `backend/tests/test_early_registration_mode.js` | 137 | Executable regression/integration test |
| `backend/tests/test_event_lifecycle_edge_cases.js` | 486 | Executable regression/integration test |
| `backend/tests/test_event_selection.js` | 171 | Executable regression/integration test |
| `backend/tests/test_feedback_admin_dashboard.js` | 151 | Executable regression/integration test |
| `backend/tests/test_idempotency_verification.js` | 97 | Executable regression/integration test |
| `backend/tests/test_media_presets.js` | 256 | Executable regression/integration test |
| `backend/tests/test_media_security.js` | 468 | Executable regression/integration test |
| `backend/tests/test_normal_mode_ek06_ek07.js` | 126 | Executable regression/integration test |
| `backend/tests/test_order_creation.js` | 20 | Executable regression/integration test |
| `backend/tests/test_phase_a_whatsapp.js` | 147 | Executable regression/integration test |
| `backend/tests/test_phase_b_qr_signing.js` | 121 | Executable regression/integration test |
| `backend/tests/test_phase_c_and_e_scanner.js` | 220 | Executable regression/integration test |
| `backend/tests/test_razorpay.js` | 100 | Executable regression/integration test |
| `backend/tests/test_webhook.js` | 171 | Executable regression/integration test |
| `backend/tests/test_worker_auth_and_concurrency.js` | 186 | Executable regression/integration test |

## Backend tooling

| File | LOC | Detected responsibility |
|---|---:|---|
| `backend/check_ek06.js` | 29 | Supporting implementation file; inspect imports, callers, and side effects before modification |
| `backend/index.js` | 16 | Supporting implementation file; inspect imports, callers, and side effects before modification |
| `backend/services/razorpay.js` | 9 | Supporting implementation file; inspect imports, callers, and side effects before modification |
| `backend/services/whatsappWebhook.js` | 5 | Supporting implementation file; inspect imports, callers, and side effects before modification |

## Backend workers

| File | LOC | Detected responsibility |
|---|---:|---|
| `backend/src/workers/mediaVariantWorker.js` | 165 | Exports: mediaVariantWorker |
| `backend/src/workers/whatsappCommunicationWorker.js` | 253 | Exports: getEventDateTime, runAutomaticWhatsAppWorker |
| `backend/src/workers/whatsappWorker.js` | 52 | Exports: runAutomaticWhatsAppWorker |

## Frontend components

| File | LOC | Detected responsibility |
|---|---:|---|
| `frontend/src/components/admin/FinanceOverview.tsx` | 274 | Exports: FinanceOverview |
| `frontend/src/components/admin/IntegrationsCenter.tsx` | 213 | Exports: IntegrationsCenter |
| `frontend/src/components/admin/layout/AdminLayout.tsx` | 86 | Exports: AdminLayout |
| `frontend/src/components/admin/layout/AdminSidebar.tsx` | 174 | Exports: AdminSidebar |
| `frontend/src/components/admin/layout/AdminTopbar.tsx` | 55 | Exports: AdminTopbar |
| `frontend/src/components/admin/layout/EventSelectorDropdown.tsx` | 347 | Exports: EventSelectorDropdown |
| `frontend/src/components/admin/ResourceMonitor.tsx` | 305 | Exports: ResourceMonitor |
| `frontend/src/components/Icons.tsx` | 558 | Exports: LayoutDashboardIcon, TicketIcon, UsersIcon, DollarSignIcon, CheckSquareIcon, MessageCircleIcon (+65) |
| `frontend/src/components/LuxurySelect.tsx` | 235 | Exports: interface, LuxurySelect |
| `frontend/src/components/RazorpayModal.tsx` | 110 | Exports: loadRazorpayScript, interface, openRazorpayModal |
| `frontend/src/components/ui/ToastProvider.tsx` | 61 | Exports: ToastProvider |

## Frontend features

| File | LOC | Detected responsibility |
|---|---:|---|
| `frontend/src/features/admin/AdminApp.tsx` | 108 | Exports: AdminApp |
| `frontend/src/features/admin/auth/AdminLogin.tsx` | 156 | Exports: AdminLogin |
| `frontend/src/features/admin/context/AdminContext.tsx` | 228 | Exports: getIndiaTodayString, computeDefaultUpcomingEvent, AdminProvider, useAdmin |
| `frontend/src/features/admin/dashboard/DashboardPage.tsx` | 237 | Exports: DashboardPage |
| `frontend/src/features/admin/events/EventsPage.tsx` | 2098 | Exports: EventsPage |
| `frontend/src/features/admin/finance/FinancePage.tsx` | 19 | Exports: FinancePage |
| `frontend/src/features/admin/integrations/IntegrationsPage.tsx` | 16 | Exports: IntegrationsPage |
| `frontend/src/features/admin/registrations/AddRegistrationModal.tsx` | 513 | Exports: AddRegistrationModal |
| `frontend/src/features/admin/registrations/DuplicateSubmissionsView.tsx` | 174 | Exports: DuplicateSubmissionsView |
| `frontend/src/features/admin/registrations/EditRegistrationModal.tsx` | 439 | Exports: EditRegistrationModal |
| `frontend/src/features/admin/registrations/RegistrationsPage.tsx` | 1376 | Exports: RegistrationsPage |
| `frontend/src/features/admin/registrations/TrashSubmissionsView.tsx` | 131 | Exports: TrashSubmissionsView |
| `frontend/src/features/admin/reports/BatchExportModal.tsx` | 1088 | Exports: BatchExportModal, verified |
| `frontend/src/features/admin/reports/FrameReviewExportModal.tsx` | 1934 | Exports: matchCplToken, resolvePhotoUrl, getOptimizedPhotoUrl, clearFrameImageMemoryCache, loadSafeCanvasImage, getCanvasBlob (+4) |
| `frontend/src/features/admin/resources/ResourcesPage.tsx` | 16 | Exports: ResourcesPage |
| `frontend/src/features/admin/scanner/ScannerPage.tsx` | 1542 | Exports: ScannerPage |
| `frontend/src/features/admin/settings/SettingsPage.tsx` | 505 | Exports: SettingsPage |
| `frontend/src/features/admin/vip/VipPassesPage.tsx` | 2133 | Exports: type, interface, VIP_TIER_PRESETS, VipPassesPage |
| `frontend/src/features/admin/whatsapp/inbox/components/ChatComposer.tsx` | 172 | Exports: ChatComposer |
| `frontend/src/features/admin/whatsapp/inbox/components/ChatListSidebar.tsx` | 246 | Exports: ChatListSidebar |
| `frontend/src/features/admin/whatsapp/inbox/components/ChatThreadHeader.tsx` | 189 | Exports: ChatThreadHeader |
| `frontend/src/features/admin/whatsapp/inbox/components/ContactDetailsDrawer.tsx` | 237 | Exports: ContactDetailsDrawer |
| `frontend/src/features/admin/whatsapp/inbox/components/ConversationListItem.tsx` | 141 | Exports: ConversationListItem |
| `frontend/src/features/admin/whatsapp/inbox/components/DevSimulatorModal.tsx` | 151 | Exports: DevSimulatorModal |
| `frontend/src/features/admin/whatsapp/inbox/components/MessageBubble.tsx` | 180 | Exports: MessageBubble |
| `frontend/src/features/admin/whatsapp/inbox/components/NewChatModal.tsx` | 123 | Exports: NewChatModal |
| `frontend/src/features/admin/whatsapp/inbox/components/QuickRepliesBar.tsx` | 35 | Exports: GUJARATI_QUICK_REPLIES, QuickRepliesBar |
| `frontend/src/features/admin/whatsapp/inbox/components/TemplateSelectorModal.tsx` | 145 | Exports: TemplateSelectorModal |
| `frontend/src/features/admin/whatsapp/inbox/components/WhatsAppAvatar.tsx` | 75 | Exports: WhatsAppAvatar |
| `frontend/src/features/admin/whatsapp/inbox/hooks/useWhatsAppConversations.ts` | 185 | Exports: interface, useWhatsAppConversations |
| `frontend/src/features/admin/whatsapp/inbox/hooks/useWhatsAppThread.ts` | 193 | Exports: useWhatsAppThread |
| `frontend/src/features/admin/whatsapp/inbox/WhatsAppInboxContainer.tsx` | 437 | Exports: WhatsAppInboxContainer |
| `frontend/src/features/admin/whatsapp/WhatsAppInbox.tsx` | 27 | Exports: WhatsAppInbox |
| `frontend/src/features/admin/whatsapp/WhatsAppInboxPage.tsx` | 228 | Exports: WhatsAppInboxPage |
| `frontend/src/features/admin/whatsapp/WhatsAppPage.tsx` | 2159 | Exports: WhatsAppPage |
| `frontend/src/features/super-admin/dashboard/SuperAdminDashboard.tsx` | 95 | Exports: SuperAdminDashboard |
| `frontend/src/features/super-admin/feedback/FeedbackDashboardPage.tsx` | 1033 | Exports: FeedbackDashboardPage |
| `frontend/src/features/super-admin/storage/StoragePage.tsx` | 1112 | Exports: StoragePage |
| `frontend/src/features/super-admin/SuperAdminApp.tsx` | 161 | Exports: SuperAdminApp |
| `frontend/src/features/super-admin/whatsapp/WhatsAppBroadcastPage.tsx` | 711 | Exports: WhatsAppBroadcastPage |

## Frontend routes

| File | LOC | Detected responsibility |
|---|---:|---|
| `frontend/src/app/admin/page.tsx` | 8 | Next.js page for /admin |
| `frontend/src/app/admin/scanner/page.tsx` | 17 | Next.js page for /admin/scanner |
| `frontend/src/app/admin/vip-passes/page.tsx` | 8 | Next.js page for /admin/vip-passes |
| `frontend/src/app/admin/vip/page.tsx` | 8 | Next.js page for /admin/vip |
| `frontend/src/app/cancellation-refund-policy/page.tsx` | 322 | Next.js page for /cancellation-refund-policy |
| `frontend/src/app/contact/page.tsx` | 186 | Next.js page for /contact |
| `frontend/src/app/error.tsx` | 72 | Exports: GlobalError |
| `frontend/src/app/event/[slug]/page.tsx` | 1140 | Next.js page for /event/[slug] |
| `frontend/src/app/feedback/[token]/page.tsx` | 630 | Next.js page for /feedback/[token] |
| `frontend/src/app/gallery/[inquiryId]/page.tsx` | 408 | Next.js page for /gallery/[inquiryId] |
| `frontend/src/app/gallery/page.tsx` | 6 | Next.js page for /gallery |
| `frontend/src/app/globals.css` | 283 | Global styling, design tokens, responsive safeguards, and shared visual utilities |
| `frontend/src/app/invitation/[inquiryId]/page.tsx` | 862 | Next.js page for /invitation/[inquiryId] |
| `frontend/src/app/layout.tsx` | 63 | Exports: viewport, metadata, RootLayout |
| `frontend/src/app/not-found.tsx` | 52 | Exports: NotFound |
| `frontend/src/app/page.tsx` | 1398 | Next.js page for / |
| `frontend/src/app/pass/[inquiryId]/page.tsx` | 737 | Next.js page for /pass/[inquiryId] |
| `frontend/src/app/payment/[inquiryId]/page.tsx` | 571 | Next.js page for /payment/[inquiryId] |
| `frontend/src/app/privacy-policy/page.tsx` | 211 | Next.js page for /privacy-policy |
| `frontend/src/app/privacy/page.tsx` | 2 | Next.js page for /privacy |
| `frontend/src/app/refund-policy/page.tsx` | 2 | Next.js page for /refund-policy |
| `frontend/src/app/shipping-delivery-policy/page.tsx` | 186 | Next.js page for /shipping-delivery-policy |
| `frontend/src/app/shipping-policy/page.tsx` | 2 | Next.js page for /shipping-policy |
| `frontend/src/app/super-admin/page.tsx` | 8 | Next.js page for /super-admin |
| `frontend/src/app/terms/page.tsx` | 204 | Next.js page for /terms |
| `frontend/src/app/vip-entry/page.tsx` | 810 | Next.js page for /vip-entry |
| `frontend/src/app/vip/page.tsx` | 4 | Next.js page for /vip |

## Frontend services

| File | LOC | Detected responsibility |
|---|---:|---|
| `frontend/src/services/admin/archiveApi.ts` | 116 | Exports: interface, archiveApi |
| `frontend/src/services/admin/backupsApi.ts` | 37 | Exports: interface, backupsApi |
| `frontend/src/services/admin/dashboardApi.ts` | 49 | Exports: interface, dashboardApi |
| `frontend/src/services/admin/eventsApi.ts` | 65 | Exports: eventsApi |
| `frontend/src/services/admin/feedbackApi.ts` | 62 | Exports: feedbackApi |
| `frontend/src/services/admin/financeApi.ts` | 31 | Exports: financeApi |
| `frontend/src/services/admin/mediaApi.ts` | 27 | Exports: interface, mediaApi |
| `frontend/src/services/admin/registrationsApi.ts` | 159 | Exports: interface, registrationsApi |
| `frontend/src/services/admin/resourcesApi.ts` | 18 | Exports: resourcesApi |
| `frontend/src/services/admin/settingsApi.ts` | 39 | Exports: settingsApi |
| `frontend/src/services/admin/whatsappApi.ts` | 734 | Exports: interface, whatsappApi |
| `frontend/src/services/apiClient.ts` | 126 | Exports: interface, ApiError, clearApiClientCache, apiClient |
| `frontend/src/services/offlineCrypto.ts` | 144 | Exports: canonicalStringify, interface, canUseOfflineEd25519, verifyQrTokenOffline |
| `frontend/src/services/scannerDb.ts` | 270 | Exports: interface, getOrCreateDeviceId, savePreparedEvent, getPreparedEvent, isPassScannedOnThisDevice, saveOfflineScan (+3) |
| `frontend/src/services/scannerFeedback.ts` | 97 | Exports: playScanFeedback |

## Frontend shared

| File | LOC | Detected responsibility |
|---|---:|---|
| `frontend/src/config.ts` | 10 | Exports: API_BASE_URL |
| `frontend/src/constants/adminNavigation.ts` | 62 | Exports: type, interface, NORMAL_ADMIN_NAVIGATION, ADMIN_NAVIGATION |
| `frontend/src/constants/superAdminNavigation.ts` | 84 | Exports: interface, SUPER_ADMIN_NAVIGATION |
| `frontend/src/types/admin.ts` | 156 | Exports: type, interface |
| `frontend/src/types/event.ts` | 107 | Exports: interface |
| `frontend/src/types/feedback.ts` | 63 | Exports: interface |
| `frontend/src/types/finance.ts` | 21 | Exports: interface |
| `frontend/src/types/index.ts` | 6 | Supporting implementation file; inspect imports, callers, and side effects before modification |
| `frontend/src/types/registration.ts` | 82 | Exports: interface, type |
| `frontend/src/types/whatsapp.ts` | 28 | Exports: interface |
| `frontend/src/utils/dateFormat.ts` | 73 | Exports: formatToDDMMYYYY, formatIndianDate |
| `frontend/src/utils/mediaPresets.ts` | 200 | Exports: MEDIA_PRESETS, type, getOptimizedPhotoUrl, interface, resolveRegistrationPhoto, resolveDisplayImageUrl |
| `frontend/src/utils/safeStorage.ts` | 119 | Exports: safeSessionStorage, safeLocalStorage |

## Frontend tooling

| File | LOC | Detected responsibility |
|---|---:|---|
| `frontend/eslint.config.mjs` | 19 | Exports: eslintConfig |
| `frontend/next-env.d.ts` | 7 | Supporting implementation file; inspect imports, callers, and side effects before modification |
| `frontend/next.config.ts` | 18 | Exports: nextConfig |
| `frontend/postcss.config.mjs` | 8 | Exports: config |
| `frontend/public/sw.js` | 70 | Supporting implementation file; inspect imports, callers, and side effects before modification |
| `frontend/scripts/test_offline_crypto.js` | 249 | Operational, audit, migration, verification, or maintenance script; inspect header and dry-run behavior before use |

## Repository scripts

| File | LOC | Detected responsibility |
|---|---:|---|
| `scripts/audit-static-business-data.js` | 74 | Supporting implementation file; inspect imports, callers, and side effects before modification |
| `scripts/generate-codebase-inventory.js` | 118 | Supporting implementation file; inspect imports, callers, and side effects before modification |
| `scripts/google-drive-archive/Code.gs` | 1400 | Supporting implementation file; inspect imports, callers, and side effects before modification |

