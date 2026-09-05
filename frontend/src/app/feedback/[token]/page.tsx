'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL } from '../../../config';
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  HeartIcon,
  StarIcon,
  CheckIcon,
  CalendarIcon,
  MapPinIcon,
  CameraIcon,
  MessageCircleIcon,
  UsersIcon
} from '../../../components/Icons';
import toast from 'react-hot-toast';

interface FeedbackData {
  token: string;
  inquiryId: string;
  coupleName: string;
  eventName: string;
  eventDate: string;
  eventTime?: string;
  eventVenue?: string;
  isSubmitted: boolean;
  overallRating: number;
  contentRating: number;
  speakerRating: number;
  venueRating: number;
  wouldRecommend: boolean;
  feedbackText: string;
  keyTakeaways?: string[];
  connectionRating?: string;
  isTestimonialAllowed?: boolean;
}

const TAKEAWAY_OPTIONS = [
  { id: 'communication', label: 'Emotional Communication', guj: 'વાતચીત અને સાંભળવાની કળા' },
  { id: 'conflict_resolution', label: 'Resolving Conflicts with Love', guj: 'પ્રેમપૂર્વક મતભેદ ઉકેલવા' },
  { id: 'quality_time', label: 'Quality Time in Daily Life', guj: 'દોડધામમાં સાથે ગુણવત્તાપૂર્ણ સમય' },
  { id: 'appreciation', label: 'Mutual Respect & Appreciation', guj: 'એકબીજાની કદર અને સાચો આદર' },
  { id: 'family_harmony', label: 'Family & In-Laws Harmony', guj: 'પરિવાર અને સંબંધોમાં સંતુલન' },
  { id: 'friendship', label: 'Lifelong Romance & Friendship', guj: 'જીવનભરની પાકી મિત્રતા અને સ્નેહ' }
];

const CONNECTION_OPTIONS = [
  {
    id: 'MUCH_CLOSER',
    title: 'Much Closer & Connected',
    guj: 'ખૂબ નજીક અને મજબૂત સમજણ',
    description: 'We feel a deeper bond, renewed affection, and mutual understanding.'
  },
  {
    id: 'REFRESHED',
    title: 'Positively Refreshed & Inspired',
    guj: 'નવો ઉત્સાહ અને પ્રેરણા',
    description: 'Brought positive energy and fresh perspectives to our marriage.'
  },
  {
    id: 'HELPFUL',
    title: 'Helpful & Practical',
    guj: 'ઉપયોગી અને વ્યવહારુ માર્ગદર્શન',
    description: 'Gave us practical tools and clarity for everyday relationship situations.'
  },
  {
    id: 'GOOD',
    title: 'Good Experience',
    guj: 'સારો અનુભવ',
    description: 'A pleasant, informative evening spent together as a couple.'
  }
];

const STAR_LABELS: Record<number, { eng: string; guj: string }> = {
  1: { eng: 'Disappointing', guj: 'નબળો અનુભવ' },
  2: { eng: 'Below Expectations', guj: 'અપેક્ષાથી ઓછો' },
  3: { eng: 'Good & Informative', guj: 'સંતોષકારક' },
  4: { eng: 'Very Good & Meaningful', guj: 'ખૂબ સારો અને ઉપયોગી' },
  5: { eng: 'Outstanding & Memorable', guj: 'શ્રેષ્ઠ અને જીવનભર યાદગાર' }
};

export default function FeedbackPage() {
  const params = useParams();
  const rawToken = (params?.token as string) || '';
  const token = decodeURIComponent(rawToken).trim();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FeedbackData | null>(null);

  // Form State
  const [overallRating, setOverallRating] = useState<number>(5);
  const [connectionRating, setConnectionRating] = useState<string>('MUCH_CLOSER');
  const [selectedTakeaways, setSelectedTakeaways] = useState<string[]>([
    'communication',
    'appreciation'
  ]);
  const [venueRating, setVenueRating] = useState<number>(5);
  const [wouldRecommend, setWouldRecommend] = useState<boolean>(true);
  const [recommendLevel, setRecommendLevel] = useState<'DEFINITELY' | 'YES' | 'NEUTRAL'>('DEFINITELY');
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [isTestimonialAllowed, setIsTestimonialAllowed] = useState<boolean>(true);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  useEffect(() => {
    if (!token) return;

    async function loadForm() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/api/feedback/${encodeURIComponent(token)}`);
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Feedback form not available.');

        setData(result);
        if (result.overallRating) setOverallRating(result.overallRating);
        if (result.venueRating) setVenueRating(result.venueRating);
        if (result.wouldRecommend !== undefined) setWouldRecommend(result.wouldRecommend);
        if (result.feedbackText) setFeedbackText(result.feedbackText);
        if (result.keyTakeaways && result.keyTakeaways.length > 0) {
          setSelectedTakeaways(result.keyTakeaways);
        }
        if (result.connectionRating) setConnectionRating(result.connectionRating);
        if (result.isSubmitted) {
          setSubmitted(true);
          if (result.isTestimonialAllowed !== undefined) {
            setIsTestimonialAllowed(result.isTestimonialAllowed);
          }
        } else {
          // Auto-select website testimonial permission by default
          setIsTestimonialAllowed(true);
        }
      } catch (err: any) {
        setError(err.message || 'Feedback form is currently not available.');
      } finally {
        setLoading(false);
      }
    }

    loadForm();
  }, [token]);

  const toggleTakeaway = (id: string) => {
    if (selectedTakeaways.includes(id)) {
      setSelectedTakeaways(selectedTakeaways.filter((t) => t !== id));
    } else {
      setSelectedTakeaways([...selectedTakeaways, id]);
    }
  };

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
          contentRating: 5,
          speakerRating: 5,
          venueRating,
          wouldRecommend: recommendLevel !== 'NEUTRAL',
          feedbackText,
          keyTakeaways: selectedTakeaways,
          connectionRating,
          isTestimonialAllowed
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to submit feedback');

      setSubmitted(true);
      toast.success('આપનો પ્રતિભાવ સફળતાપૂર્વક સ્વીકારવામાં આવ્યો છે!');
    } catch (err: any) {
      toast.error(err.message || 'Error submitting feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  // Luxury Traditional Star Rating Picker
  const renderStarPicker = (
    value: number,
    onChange: (v: number) => void,
    title: string,
    gujTitle: string
  ) => {
    const activeLabel = STAR_LABELS[value] || STAR_LABELS[5];
    return (
      <div className="p-4 rounded-2xl bg-stone-50/80 border border-stone-200/90 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-stone-900 tracking-tight">{title}</h4>
            <p className="text-[11px] text-stone-500 font-medium">{gujTitle}</p>
          </div>
          <span className="text-xs font-black text-rose-900 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg">
            {value} / 5
          </span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1 sm:gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => onChange(star)}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                  star <= value
                    ? 'bg-amber-400 border-amber-500 text-stone-950 shadow-xs scale-105'
                    : 'bg-white border-stone-200 text-stone-300 hover:border-amber-300 hover:text-amber-400'
                }`}
              >
                <StarIcon className={`w-5 h-5 ${star <= value ? 'fill-stone-950' : 'fill-none'}`} />
              </button>
            ))}
          </div>

          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-stone-800 block">{activeLabel.eng}</span>
            <span className="text-[10px] text-stone-500">{activeLabel.guj}</span>
          </div>
        </div>

        <div className="sm:hidden text-left pt-1 border-t border-stone-200/60 flex items-center justify-between text-[11px]">
          <span className="font-bold text-stone-800">{activeLabel.eng}</span>
          <span className="text-stone-500">{activeLabel.guj}</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex flex-col items-center justify-center p-4 text-stone-800">
        <div className="w-10 h-10 border-3 border-rose-800 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-stone-600 font-bold tracking-wide">
          સેમિનાર પ્રતિભાવ ફોર્મ લોડ થઈ રહ્યું છે...
        </p>
        <p className="text-[11px] text-stone-400 font-medium mt-1">Loading Seminar Review Form...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex flex-col items-center justify-center p-4 text-stone-800">
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangleIcon className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">Feedback Form Not Available</h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            {error || 'The requested feedback form link is invalid or has expired.'}
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-block px-5 py-2.5 bg-rose-800 hover:bg-rose-900 text-white rounded-xl text-xs font-bold transition-all shadow-md"
            >
              Return to Ek Duje Ke Liye
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-stone-900 py-8 px-4 sm:px-6 flex flex-col items-center justify-center select-none">
      
      {/* Luxury Traditional Container */}
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden border border-rose-100/90 flex flex-col">
        
        {/* Royal Classic Banner */}
        <div className="bg-gradient-to-r from-[#881337] via-[#9f1239] to-[#881337] text-white p-6 sm:p-8 text-center relative overflow-hidden">
          {/* Traditional Decorative Motifs */}
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-28 h-28 rounded-full bg-white/10 blur-lg pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-6 -mb-6 w-28 h-28 rounded-full bg-amber-400/15 blur-lg pointer-events-none" />

          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md text-rose-100 border border-white/20 px-3.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest">
              <HeartIcon className="w-3.5 h-3.5 text-rose-200 fill-rose-200" />
              <span>Marital Seminar Experience Review</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-white">
              EK DUJE KE LIYE
            </h1>

            <p className="text-xs sm:text-sm text-rose-100 font-medium max-w-md mx-auto leading-relaxed">
              એક દુજે કે લિયે સેમિનાર • આપનો અમૂલ્ય અને સાચો પ્રતિભાવ
            </p>
          </div>
        </div>

        {/* Couple & Event Credential Spotlight */}
        <div className="px-6 py-4 bg-[#FDFBF7] border-b border-rose-100/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
              <UsersIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider">Respected Couple</span>
              <span className="font-extrabold text-stone-900 text-sm">
                {data.coupleName || `Inquiry #${data.inquiryId}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-stone-600 font-medium text-[11px] self-start sm:self-auto">
            {data.eventDate && (
              <span className="flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5 text-rose-800" />
                <span>{data.eventDate}</span>
              </span>
            )}
            {data.eventVenue && (
              <span className="flex items-center gap-1">
                <MapPinIcon className="w-3.5 h-3.5 text-rose-800" />
                <span className="truncate max-w-[150px]">{data.eventVenue}</span>
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        {submitted ? (
          /* Thank You & Completion State */
          <div className="p-8 sm:p-12 text-center space-y-6">
            <div className="w-18 h-18 bg-emerald-50 text-emerald-700 border-2 border-emerald-200 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircleIcon className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-serif font-black text-stone-900">
                આપનો દિલથી ખૂબ ખૂબ આભાર!
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-rose-900">
                Thank You So Much, {data.coupleName}!
              </p>
              <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed pt-1">
                આપનો પ્રતિભાવ અમારા માટે અત્યંત મહત્વનો છે. આપના વિચારો અને સૂચનો દ્વારા અમે ભવિષ્યના કપલ્સ માટે આ દામ્પત્ય યાત્રાને વધુ પ્રેરણાદાયી અને મજબૂત બનાવી શકીશું.
              </p>
            </div>

            {/* Confirmed Review Summary Pill */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl max-w-sm mx-auto text-xs text-stone-700 space-y-1">
              <span className="font-bold text-stone-900 block">Your Review Rating</span>
              <div className="flex items-center justify-center gap-1 text-amber-500 font-bold">
                {[...Array(overallRating)].map((_, i) => (
                  <StarIcon key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
                <span className="text-stone-800 ml-1 font-black">({overallRating} / 5 Stars)</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2 max-w-md mx-auto">
              <Link
                href={`/gallery/${encodeURIComponent(data.inquiryId)}`}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-rose-800 to-rose-900 hover:from-rose-900 hover:to-stone-900 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2"
              >
                <CameraIcon className="w-4 h-4 text-rose-200" />
                <span>View Seminar Photos (ફોટા જુઓ)</span>
              </Link>

              <Link
                href="/"
                className="w-full sm:w-auto px-6 py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl text-xs transition-colors border border-stone-300"
              >
                Return to Home
              </Link>
            </div>
          </div>
        ) : (
          /* Interactive Feedback Form */
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">

            {/* Introduction Note */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 text-stone-800 text-xs leading-relaxed space-y-1">
              <span className="font-extrabold text-amber-950 block">
                પ્રિય દંપતી (Dear Couple),
              </span>
              <p className="text-stone-700">
                સેમિનારમાં તમારી ઉપસ્થિતિ અમારા માટે ગૌરવપૂર્ણ હતી. તમારા સાચા અનુભવો શેર કરવા માટે માત્ર ૨ મિનિટ ફાળવો, જેથી અમે આ સેવાને વધુ ઉત્કૃષ્ટ બનાવી શકીએ.
              </p>
            </div>

            {/* Question 1: Overall Experience */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-900 text-white font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <span className="text-sm font-bold text-stone-900">
                  Overall Seminar Experience (સમગ્ર સેમિનારનો અનુભવ)
                </span>
              </div>

              {renderStarPicker(
                overallRating,
                setOverallRating,
                'How would you rate the seminar overall?',
                'આ સેમિનાર તમારા માટે કેવો રહ્યો?'
              )}
            </div>

            {/* Question 2: Relationship Connection Card */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-900 text-white font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <span className="text-sm font-bold text-stone-900">
                  Marital Connection & Impact (સંબંધ પર પ્રભાવ)
                </span>
              </div>
              <p className="text-xs text-stone-600 pl-8">
                સેમિનાર પછી આપના દાંપત્યજીવનમાં કેવો અનુભવ થાય છે? (How do you feel about your bond?)
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {CONNECTION_OPTIONS.map((opt) => {
                  const isSelected = connectionRating === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setConnectionRating(opt.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left space-y-1 ${
                        isSelected
                          ? 'bg-rose-50/80 border-rose-800 ring-1 ring-rose-800 shadow-xs'
                          : 'bg-white border-stone-200 hover:border-rose-300 hover:bg-stone-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-stone-900">{opt.title}</span>
                        {isSelected && <CheckIcon className="w-4 h-4 text-rose-800 font-bold" />}
                      </div>
                      <span className="text-[11px] font-semibold text-rose-900 block">{opt.guj}</span>
                      <p className="text-[10px] text-stone-500 leading-normal">{opt.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Question 3: Key Takeaways (Multi-Select Chips) */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-900 text-white font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <span className="text-sm font-bold text-stone-900">
                  Key Takeaways (તમને સૌથી વધુ શું સ્પર્શી ગયું?)
                </span>
              </div>
              <p className="text-xs text-stone-600 pl-8">
                Select topics that resonated most with you (તમારા મનપસંદ વિષયો પસંદ કરો):
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {TAKEAWAY_OPTIONS.map((item) => {
                  const isChecked = selectedTakeaways.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleTakeaway(item.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isChecked
                          ? 'bg-rose-50/90 border-rose-800 text-rose-950 font-bold shadow-2xs'
                          : 'bg-stone-50 border-stone-200 text-stone-700 hover:border-rose-300'
                      }`}
                    >
                      <div>
                        <span className="text-xs block font-bold">{item.label}</span>
                        <span className="text-[10px] text-stone-500">{item.guj}</span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border flex-shrink-0 ${
                          isChecked ? 'bg-rose-800 border-rose-800 text-white' : 'border-stone-300 bg-white'
                        }`}
                      >
                        {isChecked && <CheckIcon className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Question 4: Venue & Hospitality Ratings */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-900 text-white font-bold text-xs flex items-center justify-center">
                  4
                </span>
                <span className="text-sm font-bold text-stone-900">
                  Venue & Hospitality (સ્થળ અને વ્યવસ્થા)
                </span>
              </div>

              <div className="space-y-3">
                {renderStarPicker(
                  venueRating,
                  setVenueRating,
                  'Venue, Seating & Hospitality Ambience',
                  'હોલ, બેઠક વ્યવસ્થા અને વાતાવરણ'
                )}
              </div>
            </div>

            {/* Question 5: Net Promoter Score / Recommendation */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-900 text-white font-bold text-xs flex items-center justify-center">
                  5
                </span>
                <span className="text-sm font-bold text-stone-900">
                  Recommendation (ભલામણ)
                </span>
              </div>
              <p className="text-xs text-stone-600 pl-8">
                શું આપ અન્ય યુગલોને આ સેમિનારમાં જોડાવા ભલામણ કરશો? (Would you recommend this seminar to others?)
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {[
                  { id: 'DEFINITELY', title: 'Definitely Yes!', guj: 'ચોક્કસપણે ભલામણ કરીશું' },
                  { id: 'YES', title: 'Yes, Helpful', guj: 'હા, સારો અનુભવ હતો' },
                  { id: 'NEUTRAL', title: 'Neutral / Needs Work', guj: 'સામાન્ય / સુધારા જરૂરી' }
                ].map((rec) => {
                  const isRecSelected = recommendLevel === rec.id;
                  return (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => setRecommendLevel(rec.id as any)}
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                        isRecSelected
                          ? 'bg-rose-900 border-rose-900 text-white shadow-xs font-bold'
                          : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100 font-medium'
                      }`}
                    >
                      <span className="text-xs block font-bold">{rec.title}</span>
                      <span className={`text-[10px] block mt-0.5 ${isRecSelected ? 'text-rose-100' : 'text-stone-500'}`}>
                        {rec.guj}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Question 6: Personal Thoughts & Highlights */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-900 text-white font-bold text-xs flex items-center justify-center">
                  6
                </span>
                <span className="text-sm font-bold text-stone-900">
                  Heartfelt Thoughts or Special Moments (આપના વિચારો)
                </span>
              </div>
              <p className="text-xs text-stone-500 pl-8">
                Any memorable quote, touching moment, or message for the team (Optional):
              </p>

              <div className="pl-8 space-y-3">
                <textarea
                  rows={3}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="સેમિનારની કઈ વાત તમને સૌથી વધુ સ્પર્શી ગઈ? અથવા કોઈ સૂચન હોય તો અહીં લખો..."
                  className="w-full bg-[#FAF9F5] border border-stone-300 rounded-2xl p-3.5 text-xs text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-rose-800 focus:outline-none focus:ring-1 focus:ring-rose-800 transition-all leading-relaxed"
                />

                {/* Testimonial Consent Checkbox - Auto-selected by default */}
                <label className="flex items-start gap-2.5 p-3.5 bg-rose-50/50 hover:bg-rose-50/80 rounded-2xl border border-rose-200/80 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={isTestimonialAllowed}
                    onChange={(e) => setIsTestimonialAllowed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-rose-800 focus:ring-rose-800 border-rose-300 accent-rose-800 cursor-pointer"
                  />
                  <span className="text-xs text-stone-700 leading-snug select-none">
                    <span className="font-semibold text-rose-950 block mb-0.5">
                      અમારા પ્રતિભાવને અન્ય દંપતીઓની પ્રેરણા માટે વેબસાઇટ પર મૂકવા માટે અમારી સંમતિ છે.
                    </span>
                    <span className="text-stone-500 text-[11px] block font-normal">
                      (Permission to publish our feedback on the Ek Duje Ke Liye website to inspire newlywed couples.)
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-stone-200">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 px-6 bg-gradient-to-r from-rose-800 via-rose-800 to-rose-900 hover:from-rose-900 hover:to-stone-900 active:scale-[0.99] text-white font-serif font-black rounded-2xl shadow-xl shadow-rose-950/20 text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>{submitting ? 'પ્રતિભાવ સબમિટ થઈ રહ્યો છે...' : 'Submit Your Feedback (પ્રતિભાવ મોકલો)'}</span>
                <CheckIcon className="w-5 h-5" />
              </button>
              <p className="text-[10px] text-stone-400 text-center mt-2 font-medium">
                🔒 Your response is treated with utmost respect and privacy by Ek Duje Ke Liye.
              </p>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
