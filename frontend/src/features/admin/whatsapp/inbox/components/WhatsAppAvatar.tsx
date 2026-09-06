import React, { useState } from 'react';
import { getOptimizedPhotoUrl } from '@/utils/mediaPresets';

interface WhatsAppAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isWindowActive?: boolean;
  className?: string;
}

export const WhatsAppAvatar: React.FC<WhatsAppAvatarProps> = ({
  name,
  photoUrl,
  size = 'md',
  isWindowActive = false,
  className = ''
}) => {
  const [imageError, setImageError] = useState(false);

  // Compute initials
  const initials = (name || 'WG')
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const sizeClasses = {
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-10 h-10 text-xs',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-16 h-16 text-base'
  }[size];

  const dotSize = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-3.5 h-3.5'
  }[size];

  // Check if valid photo URL exists
  const hasValidPhoto = photoUrl && photoUrl.trim().length > 5 && !imageError && photoUrl !== '/sample_couple.png';

  return (
    <div className={`relative flex-shrink-0 select-none ${className}`}>
      {hasValidPhoto ? (
        <img
          src={getOptimizedPhotoUrl(photoUrl, 'thumbnail')}
          alt={name}
          onError={() => setImageError(true)}
          className={`${sizeClasses} rounded-full object-cover border border-slate-200/90 shadow-2xs bg-slate-100`}
          loading="lazy"
        />
      ) : (
        <div
          className={`${sizeClasses} rounded-full bg-gradient-to-br from-[#881337] to-[#BE123C] text-white flex items-center justify-center font-black shadow-2xs border border-white/40`}
        >
          {initials}
        </div>
      )}

      {/* 24-Hour Active Green Online Pulse Dot */}
      {isWindowActive && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 ${dotSize} rounded-full bg-emerald-500 ring-2 ring-white animate-pulse`}
          title="24h WhatsApp Session Active"
        />
      )}
    </div>
  );
};
