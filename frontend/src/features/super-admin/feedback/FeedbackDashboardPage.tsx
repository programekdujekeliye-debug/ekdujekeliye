'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAdmin } from '../../admin/context/AdminContext';
import { feedbackApi } from '../../../services/admin/feedbackApi';
import { FeedbackItem, FeedbackStats, FeedbackListFilter } from '../../../types/feedback';
import {
  StarIcon,
  SearchIcon,
  RefreshCwIcon,
  UsersIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  TrashIcon,
  ExternalLinkIcon,
  MessageCircleIcon,
  CopyIcon,
  DownloadIcon,
  XIcon,
  CalendarIcon,
  AwardIcon,
  HeartIcon
} from '../../../components/Icons';
import toast from 'react-hot-toast';

const TAKEAWAY_LABELS: Record<string, { eng: string; guj: string }> = {
  communication: { eng: 'Emotional Communication', guj: 'વાતચીત અને સાંભળવાની કળા' },
  conflict_resolution: { eng: 'Resolving Conflicts with Love', guj: 'પ્રેમપૂર્વક મતભેદ ઉકેલવા' },
  quality_time: { eng: 'Quality Time in Daily Life', guj: 'દોડધામમાં સાથે ગુણવત્તાપૂર્ણ સમય' },
  appreciation: { eng: 'Mutual Respect & Appreciation', guj: 'એકબીજાની કદર અને સાચો આદર' },
  family_harmony: { eng: 'Family & In-Laws Harmony', guj: 'પરિવાર અને સંબંધોમાં સંતુલન' },
  friendship: { eng: 'Lifelong Romance & Friendship', guj: 'જીવનભરની પાકી મિત્રતા અને સ્નેહ' }
};

const CONNECTION_LABELS: Record<string, { eng: string; guj: string }> = {
  MUCH_CLOSER: { eng: 'Much Closer & Connected', guj: 'ખૂબ નજીક અને મજબૂત સમજણ' },
  REFRESHED: { eng: 'Positively Refreshed & Inspired', guj: 'નવો ઉત્સાહ અને પ્રેરણા' },
  HELPFUL: { eng: 'Helpful & Practical', guj: 'ઉપયોગી અને વ્યવહારુ માર્ગદર્શન' },
  GOOD: { eng: 'Good Experience', guj: 'સારો અનુભવ' }
};

export const FeedbackDashboardPage = () => {
  const { selectedProgramId, programs } = useAdmin();

  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'testimonials'>('all');
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'pending'>('all');
  const [ratingFilter, setRatingFilter] = useState<'all' | '5' | '4' | '3' | 'low'>('all');
  const [testimonialFilter, setTestimonialFilter] = useState<'all' | 'allowed' | 'not_allowed'>('all');

  // Detail Modal
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeEventId = selectedProgramId;

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const data = await feedbackApi.getStats(activeEventId);
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load feedback stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchList = async () => {
    try {
      setLoadingList(true);
      const filter: FeedbackListFilter = {
        eventId: activeEventId,
        status: activeTab === 'testimonials' ? 'submitted' : statusFilter,
        rating: ratingFilter,
        testimonial: activeTab === 'testimonials' ? 'allowed' : testimonialFilter,
        search: search.trim(),
        page,
        limit: 25
      };
      const res = await feedbackApi.getList(filter);
      if (res && res.success) {
        setFeedbacks(res.data || []);
        setTotalCount(res.pagination?.total || 0);
        setTotalPages(res.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      console.error('Failed to load feedback list:', err);
      toast.error(err.message || 'Failed to fetch reviews list');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [activeEventId]);

  useEffect(() => {
    fetchList();
  }, [activeEventId, activeTab, statusFilter, ratingFilter, testimonialFilter, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchList();
  };

  const handleToggleTestimonial = async (item: FeedbackItem) => {
    try {
      setTogglingId(item._id);
      const res = await feedbackApi.toggleTestimonial(item._id);
      if (res && res.success) {
        toast.success(
          res.isTestimonialAllowed
            ? 'Testimonial approved for website showcase!'
            : 'Testimonial marked as private.'
        );
        // Update local state in table & modal
        setFeedbacks((prev) =>
          prev.map((f) => (f._id === item._id ? { ...f, isTestimonialAllowed: res.isTestimonialAllowed } : f))
        );
        if (selectedFeedback && selectedFeedback._id === item._id) {
          setSelectedFeedback({ ...selectedFeedback, isTestimonialAllowed: res.isTestimonialAllowed });
        }
        fetchStats();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update testimonial status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteFeedback = async (id: string, coupleName: string) => {
    if (!window.confirm(`Are you sure you want to delete review for "${coupleName}"? This cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(id);
      const res = await feedbackApi.deleteFeedback(id);
      if (res && res.success) {
        toast.success('Feedback record deleted successfully.');
        setFeedbacks((prev) => prev.filter((f) => f._id !== id));
        if (selectedFeedback && selectedFeedback._id === id) {
          setSelectedFeedback(null);
        }
        fetchStats();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete record');
    } finally {
      setDeletingId(null);
    }
  };

  const copyFeedbackLink = (token: string, inquiryId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.ekdujekeliye.in';
    const link = `${origin}/feedback/${token || inquiryId}`;
    navigator.clipboard.writeText(link);
    toast.success('Couple feedback link copied to clipboard!');
  };

  const copyTestimonialQuote = (item: FeedbackItem) => {
    const text = `"${item.feedbackText}"\n— ${item.coupleName || 'Respected Couple'} (Ek Duje Ke Liye Seminar)`;
    navigator.clipboard.writeText(text);
    toast.success('Testimonial quote copied for social media / website!');
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Couples Feedback &amp; Testimonials
            </h1>
            <span className="px-2.5 py-0.5 text-[11px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200 rounded-full">
              દામ્પત્ય પ્રતિભાવ
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real couple ratings, heartfelt feedback, seminar takeaways, and website testimonial curation.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              fetchStats();
              fetchList();
            }}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Refresh Feedback Data"
          >
            <RefreshCwIcon className={`w-3.5 h-3.5 ${loadingList || loadingStats ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <a
            href={feedbackApi.getExportUrl(activeEventId, 'csv')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Top Executive Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Total Submitted & Rate */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Submissions</span>
            <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {stats?.totalSubmitted ?? 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">/ {stats?.totalGenerated ?? 0}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className="text-slate-500 font-medium">Response Rate</span>
            <span className="font-extrabold text-emerald-600">{stats?.submissionRate ?? 0}%</span>
          </div>
        </div>

        {/* Overall Satisfaction */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Overall Rating</span>
            <StarIcon className="w-4 h-4 text-amber-500 fill-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {stats ? stats.averageOverallRating.toFixed(1) : '5.0'}
            </span>
            <span className="text-xs text-amber-500 font-black">★ / 5.0</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium pt-1">
            {stats?.ratingDistribution[5] ?? 0} Five-Star reviews
          </div>
        </div>

        {/* Venue & Hospitality Rating */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Venue Ambience</span>
            <AwardIcon className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {stats ? stats.averageVenueRating.toFixed(1) : '5.0'}
            </span>
            <span className="text-xs text-rose-600 font-black">★ / 5.0</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium pt-1 truncate">
            Hall, seating &amp; hospitality
          </div>
        </div>

        {/* Website Testimonial Consent */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Website Ready</span>
            <EyeIcon className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-purple-700">
              {stats?.testimonialCount ?? 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">couples</span>
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className="text-slate-500 font-medium">Consent Given</span>
            <span className="font-extrabold text-purple-700">{stats?.testimonialRate ?? 0}%</span>
          </div>
        </div>

        {/* NPS & Recommendation Rate */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Would Recommend</span>
            <HeartIcon className="w-4 h-4 text-rose-600 fill-rose-100" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
              {stats?.recommendationRate ?? 100}%
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium pt-1 truncate">
            {stats?.withCommentsCount ?? 0} written thoughts
          </div>
        </div>
      </div>

      {/* Analytics Insights Breakdown */}
      {stats && stats.totalSubmitted > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Marital Connection & Bond Impact */}
          <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-extrabold text-slate-900">
                Marital Connection &amp; Bond Impact (સંબંધ પર પ્રભાવ)
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {stats.totalSubmitted} total couples
              </span>
            </div>

            <div className="space-y-2">
              {Object.entries(CONNECTION_LABELS).map(([key, label]) => {
                const count = stats.connectionBreakdown[key] || 0;
                const pct = stats.totalSubmitted > 0 ? Math.round((count / stats.totalSubmitted) * 100) : 0;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-800">
                        {label.eng} <span className="text-[11px] text-slate-400 font-normal">({label.guj})</span>
                      </span>
                      <span className="font-extrabold text-slate-700">
                        {count} <span className="text-slate-400 text-[10px]">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-rose-800 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Takeaways Valued by Couples */}
          <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-extrabold text-slate-900">
                Most Valued Takeaways (મુખ્ય મુદ્દાઓ)
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Frequency Count</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(TAKEAWAY_LABELS).map(([key, label]) => {
                const freq = stats.takeawaysFrequency[key] || 0;
                return (
                  <div
                    key={key}
                    className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 block truncate">{label.eng}</span>
                      <span className="text-[10px] text-slate-500 block truncate">{label.guj}</span>
                    </div>
                    <span className="px-2 py-0.5 text-xs font-extrabold bg-white border border-slate-200 rounded-lg text-slate-800 flex-shrink-0 shadow-2xs">
                      {freq}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tabs & Controls */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs p-4 sm:p-5 space-y-4">
        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab('all');
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Feedback ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('testimonials');
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'testimonials'
                  ? 'bg-rose-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Website Testimonials</span>
              <span className="w-2 h-2 rounded-full bg-rose-400" />
            </button>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Showing {feedbacks.length} of {totalCount} records
          </span>
        </div>

        {/* Search and Filters Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[240px]">
            <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by couple name, inquiry ID, or feedback words..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-20 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-rose-800 focus:outline-none focus:ring-1 focus:ring-rose-800 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[11px] font-bold hover:bg-slate-800 cursor-pointer transition-colors"
            >
              Go
            </button>
          </form>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'all' && (
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setPage(1);
                }}
                aria-label="Filter by Submission Status"
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-rose-800"
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted Only</option>
                <option value="pending">Pending Response</option>
              </select>
            )}

            <select
              value={ratingFilter}
              onChange={(e) => {
                setRatingFilter(e.target.value as any);
                setPage(1);
              }}
              aria-label="Filter by Star Rating"
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-rose-800"
            >
              <option value="all">All Ratings</option>
              <option value="5">5 Stars (Outstanding)</option>
              <option value="4">4 Stars (Very Good)</option>
              <option value="3">3 Stars (Good)</option>
              <option value="low">2 or Less Stars</option>
            </select>

            {activeTab === 'all' && (
              <select
                value={testimonialFilter}
                onChange={(e) => {
                  setTestimonialFilter(e.target.value as any);
                  setPage(1);
                }}
                aria-label="Filter by Testimonial Permission"
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-rose-800"
              >
                <option value="all">All Permissions</option>
                <option value="allowed">Allowed for Website</option>
                <option value="not_allowed">Private Only</option>
              </select>
            )}
          </div>
        </div>

        {/* Table / List Content */}
        {loadingList ? (
          <div className="py-16 text-center text-slate-500 text-xs font-bold space-y-2">
            <div className="w-8 h-8 border-3 border-rose-800 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Loading couple feedback reviews...</p>
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
              <StarIcon className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">No feedback submissions found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {search
                ? `No reviews match "${search}". Try clearing search filters.`
                : 'Couples will appear here once feedback links are dispatched and submitted.'}
            </p>
          </div>
        ) : activeTab === 'testimonials' ? (
          /* Curated Website Testimonials Showcase Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {feedbacks.map((item) => (
              <div
                key={item._id}
                className="p-5 rounded-2xl border border-rose-100 bg-[#FFFDF9] shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-amber-500">
                      {[...Array(item.overallRating || 5)].map((_, i) => (
                        <StarIcon key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                      ✓ Website Approved
                    </span>
                  </div>

                  <p className="text-xs text-slate-800 leading-relaxed font-serif italic line-clamp-4">
                    "{item.feedbackText || 'Outstanding seminar experience! Highly recommended for all married couples.'}"
                  </p>

                  {item.keyTakeaways && item.keyTakeaways.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.keyTakeaways.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 text-[9px] font-bold bg-rose-50 text-rose-800 rounded-md"
                        >
                          {TAKEAWAY_LABELS[t]?.eng || t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-rose-100/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-extrabold text-slate-900 block truncate">
                      {item.coupleName || `Inquiry #${item.inquiryId}`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium block">
                      {item.programDate || 'Seminar Attendee'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => copyTestimonialQuote(item)}
                      title="Copy Quote for Social Media"
                      className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 transition-colors cursor-pointer"
                    >
                      <CopyIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFeedback(item)}
                      title="Inspect Full Details"
                      className="p-2 bg-rose-800 hover:bg-rose-900 text-white rounded-xl transition-colors cursor-pointer"
                    >
                      <EyeIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Comprehensive All Feedbacks Table */
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-y border-slate-200">
                  <th className="py-3 px-3 sm:px-4">Couple &amp; Token</th>
                  <th className="py-3 px-3">Event Date</th>
                  <th className="py-3 px-3">Ratings</th>
                  <th className="py-3 px-3">Marital Impact</th>
                  <th className="py-3 px-3">Couple's Thoughts</th>
                  <th className="py-3 px-3 text-center">Web Consent</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {feedbacks.map((fb) => {
                  const conn = CONNECTION_LABELS[fb.connectionRating];
                  return (
                    <tr
                      key={fb._id}
                      className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                      onClick={() => setSelectedFeedback(fb)}
                    >
                      {/* Couple & Token */}
                      <td className="py-3 px-3 sm:px-4">
                        <div className="flex items-center gap-2.5">
                          {fb.couplePhoto ? (
                            <img
                              src={fb.couplePhoto}
                              alt={fb.coupleName}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-800 font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {fb.coupleName ? fb.coupleName.charAt(0) : '#'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-extrabold text-slate-900 block truncate">
                              {fb.coupleName || 'Respected Couple'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block truncate">
                              #{fb.inquiryId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Event Date */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-medium">
                        {fb.programDate || fb.eventId}
                      </td>

                      {/* Ratings */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {fb.isSubmitted ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 font-bold text-slate-800">
                              <span className="text-amber-500 font-black">{fb.overallRating || 5}★</span>
                              <span className="text-[10px] text-slate-500 font-normal">Overall</span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                              <span className="text-rose-700 font-bold">{fb.venueRating || 5}★</span>
                              <span className="text-[10px] text-slate-400">Venue</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Pending response</span>
                        )}
                      </td>

                      {/* Marital Impact */}
                      <td className="py-3 px-3 max-w-[160px]">
                        {fb.isSubmitted && conn ? (
                          <div className="truncate">
                            <span className="font-bold text-slate-800 block truncate">{conn.eng}</span>
                            <span className="text-[10px] text-slate-400 block truncate">{conn.guj}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>

                      {/* Written Thoughts */}
                      <td className="py-3 px-3 max-w-[240px]">
                        {fb.feedbackText ? (
                          <p className="text-slate-700 truncate line-clamp-1 italic font-serif">
                            "{fb.feedbackText}"
                          </p>
                        ) : fb.isSubmitted ? (
                          <span className="text-slate-400 text-[10px] italic">No written comment</span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded-full inline-block">
                            Link Dispatched
                          </span>
                        )}
                      </td>

                      {/* Website Consent */}
                      <td
                        className="py-3 px-3 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleTestimonial(fb)}
                          disabled={togglingId === fb._id}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all cursor-pointer ${
                            fb.isTestimonialAllowed
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {togglingId === fb._id
                            ? '...'
                            : fb.isTestimonialAllowed
                            ? '✓ Allowed'
                            : 'Private'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Copy Link */}
                          <button
                            type="button"
                            onClick={() => copyFeedbackLink(fb.token, fb.inquiryId)}
                            title="Copy Feedback Form Link"
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          >
                            <CopyIcon className="w-3.5 h-3.5" />
                          </button>

                          {/* Open Form */}
                          <a
                            href={`/feedback/${fb.token || fb.inquiryId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open Feedback Form as Couple"
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-rose-800 transition-colors"
                          >
                            <ExternalLinkIcon className="w-3.5 h-3.5" />
                          </a>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteFeedback(fb._id, fb.coupleName)}
                            disabled={deletingId === fb._id}
                            title="Delete Feedback Record"
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-600">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg font-bold disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg font-bold disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Detail Modal */}
      {selectedFeedback && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                {selectedFeedback.couplePhoto ? (
                  <img
                    src={selectedFeedback.couplePhoto}
                    alt={selectedFeedback.coupleName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-rose-200"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-800 font-extrabold flex items-center justify-center text-sm">
                    {selectedFeedback.coupleName ? selectedFeedback.coupleName.charAt(0) : '#'}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {selectedFeedback.coupleName || 'Respected Couple'}
                  </h3>
                  <span className="text-xs text-slate-500 font-mono block">
                    Inquiry #{selectedFeedback.inquiryId} • {selectedFeedback.programDate || selectedFeedback.eventId}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFeedback(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Ratings Breakdown Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-0.5">
                <span className="text-[10px] font-bold text-amber-950 uppercase tracking-wider block">
                  Overall Rating
                </span>
                <div className="flex items-center gap-1 text-amber-600 font-black text-lg">
                  {[...Array(selectedFeedback.overallRating || 5)].map((_, i) => (
                    <StarIcon key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="ml-1 text-slate-900 text-sm">({selectedFeedback.overallRating || 5}/5)</span>
                </div>
              </div>

              <div className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-2xl space-y-0.5">
                <span className="text-[10px] font-bold text-rose-950 uppercase tracking-wider block">
                  Venue &amp; Hospitality
                </span>
                <div className="flex items-center gap-1 text-rose-700 font-black text-lg">
                  {[...Array(selectedFeedback.venueRating || 5)].map((_, i) => (
                    <StarIcon key={i} className="w-4 h-4 fill-rose-500 text-rose-500" />
                  ))}
                  <span className="ml-1 text-slate-900 text-sm">({selectedFeedback.venueRating || 5}/5)</span>
                </div>
              </div>
            </div>

            {/* Marital Connection */}
            {selectedFeedback.connectionRating && (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Marital Connection (સંબંધ પર પ્રભાવ)
                </span>
                <span className="text-xs font-extrabold text-slate-900 block">
                  {CONNECTION_LABELS[selectedFeedback.connectionRating]?.eng || selectedFeedback.connectionRating}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {CONNECTION_LABELS[selectedFeedback.connectionRating]?.guj || ''}
                </span>
              </div>
            )}

            {/* Key Takeaways */}
            {selectedFeedback.keyTakeaways && selectedFeedback.keyTakeaways.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Selected Takeaways
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedFeedback.keyTakeaways.map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-1 text-xs font-bold bg-rose-50 text-rose-900 border border-rose-200 rounded-xl"
                    >
                      {TAKEAWAY_LABELS[t]?.eng || t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Written Quote */}
            <div className="p-4 bg-[#FAF9F5] border border-stone-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                Couple's Written Thoughts
              </span>
              <p className="text-xs text-stone-800 italic leading-relaxed font-serif">
                "{selectedFeedback.feedbackText || 'No written comment left by couple.'}"
              </p>
            </div>

            {/* Website Consent Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Feature on Website Testimonials</span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {selectedFeedback.isTestimonialAllowed
                    ? 'Couple gave explicit consent to display their review.'
                    : 'Review is currently kept private.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleTestimonial(selectedFeedback)}
                disabled={togglingId === selectedFeedback._id}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  selectedFeedback.isTestimonialAllowed
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                }`}
              >
                {selectedFeedback.isTestimonialAllowed ? '✓ Published' : 'Make Public'}
              </button>
            </div>

            {/* Actions Bar */}
            <div className="pt-2 flex items-center justify-between gap-2">
              {selectedFeedback.phoneNumber ? (
                <a
                  href={`https://wa.me/${selectedFeedback.phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Jay Shree Krishna ${selectedFeedback.coupleName}, Ek Duje Ke Liye parivaar tarf thi aapno feedback aavva badal dil thi aabhar!`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                >
                  <MessageCircleIcon className="w-4 h-4" />
                  <span>WhatsApp Couple</span>
                </a>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setSelectedFeedback(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
