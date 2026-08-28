'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { API_BASE_URL } from '../../../config';
import { CheckCircleIcon, AlertTriangleIcon, HeartIcon, StarIcon, CheckIcon } from '../../../components/Icons';

interface FeedbackData {
  token: string;
  inquiryId: string;
  coupleName: string;
  eventName: string;
  eventDate: string;
  isSubmitted: boolean;
  overallRating: number;
  contentRating: number;
  speakerRating: number;
  venueRating: number;
  wouldRecommend: boolean;
  feedbackText: string;
}

export default function FeedbackPage() {
  const params = useParams();
  const token = (params?.token as string) || '';

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FeedbackData | null>(null);

  const [overallRating, setOverallRating] = useState<number>(5);
  const [contentRating, setContentRating] = useState<number>(5);
  const [speakerRating, setSpeakerRating] = useState<number>(5);
  const [venueRating, setVenueRating] = useState<number>(5);
  const [wouldRecommend, setWouldRecommend] = useState<boolean>(true);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  useEffect(() => {
    if (!token) return;

    async function loadForm() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/feedback/${encodeURIComponent(token)}`);
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to load feedback form');

        setData(result);
        if (result.isSubmitted) {
          setSubmitted(true);
        }
      } catch (err: any) {
        setError(err.message || 'Feedback form not available.');
      } finally {
        setLoading(false);
      }
    }

    loadForm();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/feedback/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overallRating,
          contentRating,
          speakerRating,
          venueRating,
          wouldRecommend,
          feedbackText
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to submit feedback');

      setSubmitted(true);
    } catch (err: any) {
      alert(err.message || 'Error submitting feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStarPicker = (value: number, onChange: (v: number) => void, label: string) => {
    return (
      <div className="space-y-1">
        <label className="text-xs font-bold text-stone-700 block">{label}</label>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm transition-all cursor-pointer ${
                star <= value
                  ? 'bg-amber-400 text-stone-950 shadow-xs scale-105'
                  : 'bg-stone-100 text-stone-300 hover:bg-stone-200'
              }`}
            >
              <StarIcon className={`w-4 h-4 ${star <= value ? 'fill-stone-950 text-stone-950' : 'fill-stone-300 text-stone-300'}`} />
            </button>
          ))}
          <span className="text-xs font-semibold text-stone-500 ml-2">{value} / 5</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-4 text-stone-800">
        <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-stone-600 font-medium">Loading seminar feedback form...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-4 text-stone-800">
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-3xl p-6 text-center space-y-3 shadow-xl">
          <AlertTriangleIcon className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-stone-900">Feedback Form Not Available</h2>
          <p className="text-xs text-stone-600 leading-relaxed">{error || 'This link may have expired or is invalid.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-800 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-white text-stone-900 rounded-3xl shadow-xl overflow-hidden border border-stone-200/90">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-700 text-white p-6 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-rose-100 mb-1">
            <HeartIcon className="w-3.5 h-3.5" />
            <span>Attendee Experience Review</span>
          </div>
          <h1 className="text-xl font-black tracking-tight">EK DUJE KE LIYE</h1>
          <p className="text-xs text-rose-100 mt-1 font-medium">{data.eventName}</p>
        </div>

        {/* Form or Submitted State */}
        {submitted ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircleIcon className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-stone-900">Thank You So Much!</h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              Your feedback is greatly appreciated and helps us continually elevate the seminar experience for couples.
            </p>
            <div className="pt-2">
              <a
                href="/"
                className="inline-block px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-md"
              >
                Back to Ek Duje Ke Liye
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 text-xs">
              <span className="text-stone-500 block">Feedback for:</span>
              <span className="font-bold text-stone-900">{data.coupleName || `Inquiry #${data.inquiryId}`}</span>
            </div>

            {renderStarPicker(overallRating, setOverallRating, '1. Overall Experience')}
            {renderStarPicker(contentRating, setContentRating, '2. Seminar Topics & Content')}
            {renderStarPicker(speakerRating, setSpeakerRating, '3. Speaker & Presentation')}
            {renderStarPicker(venueRating, setVenueRating, '4. Venue & Arrangements')}

            {/* Recommendation Toggle */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-stone-700 block">
                Would you recommend this seminar to other couples?
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWouldRecommend(true)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1 ${
                    wouldRecommend
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  <CheckIcon className="w-3.5 h-3.5" />
                  <span>Yes, Definitely</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWouldRecommend(false)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    !wouldRecommend
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  No
                </button>
              </div>
            </div>

            {/* Comments */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700 block">
                Any specific thoughts or highlights you would like to share?
              </label>
              <textarea
                rows={3}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Write your feedback here..."
                className="w-full bg-stone-50 border border-stone-300 rounded-xl p-3 text-xs text-stone-900 focus:bg-white focus:border-rose-500 focus:outline-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold rounded-2xl text-xs transition-all shadow-lg cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Submitting Feedback...' : 'Submit Feedback'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
