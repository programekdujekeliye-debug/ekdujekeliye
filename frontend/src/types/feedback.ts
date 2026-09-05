export interface FeedbackItem {
  _id: string;
  inquiryId: string;
  eventId: string;
  token: string;
  coupleName: string;
  overallRating: number;
  contentRating?: number;
  speakerRating?: number;
  venueRating: number;
  wouldRecommend: boolean;
  feedbackText: string;
  keyTakeaways: string[];
  connectionRating: string;
  isTestimonialAllowed: boolean;
  isSubmitted: boolean;
  submittedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  phoneNumber?: string;
  couplePhoto?: string;
  attendance?: string;
  programDate?: string;
  programName?: string;
}

export interface FeedbackStats {
  totalGenerated: number;
  totalSubmitted: number;
  totalPending: number;
  submissionRate: number;
  averageOverallRating: number;
  averageVenueRating: number;
  recommendationRate: number;
  testimonialCount: number;
  testimonialRate: number;
  withCommentsCount: number;
  ratingDistribution: Record<number, number>;
  connectionBreakdown: Record<string, number>;
  takeawaysFrequency: Record<string, number>;
}

export interface FeedbackListFilter {
  eventId?: string;
  status?: 'all' | 'submitted' | 'pending';
  rating?: 'all' | '5' | '4' | '3' | 'low';
  testimonial?: 'all' | 'allowed' | 'not_allowed';
  search?: string;
  page?: number;
  limit?: number;
}

export interface FeedbackListResponse {
  success: boolean;
  data: FeedbackItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
