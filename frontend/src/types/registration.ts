export interface Submission {
  _id?: string;
  inquiryId: string;
  customerToken?: string;
  husbandName: string;
  wifeName: string;
  surname: string;
  phoneNumber: string;
  couplePhoto: string;
  photoThumbnailUrl?: string;
  photoStorageStatus?: 'ACTIVE' | 'QUEUED' | 'ARCHIVED';
  hasArchivedOriginal?: boolean;
  archiveStatus?: string;
  paymentScreenshot?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  programId: string;
  programName?: string;
  programDate?: string;
  programTime?: string;
  attendance?: 'unmarked' | 'present' | 'absent';
  attendanceMarkedAt?: string;
  photoZoom?: number;
  photoOffsetY?: number;
  photoLink?: string;
  isVip?: boolean;
  isDeleted?: boolean;
  frameExportStatus?: 'NOT_EXPORTED' | 'EXPORTED' | 'MODIFIED';
  frameExportedAt?: string;
  frameExportBatch?: number;

  payment?: {
    provider?: string;
    status?: 'pending' | 'captured' | 'failed' | 'refunded';
    amount?: number;
    currency?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    paidAt?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export type Registration = Submission;

export interface DuplicateGroup {
  id: string;
  type: 'phone' | 'name' | 'both';
  label: string;
  submissions: Submission[];
}

export interface SubmissionsResponse {
  submissions: Submission[];
  totalSubmissions: number;
  total?: number;
  currentPage: number;
  page?: number;
  totalPages: number;
}
