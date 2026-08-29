import React from 'react';

interface VoxLogoProps {
  className?: string;
  variant?: 'auto' | 'light' | 'dark' | 'icon-only';
  showSubtitle?: boolean;
}

export const VoxLogo: React.FC<VoxLogoProps> = ({
  className = 'h-7 w-auto',
  variant = 'auto',
  showSubtitle = true
}) => {
  // If icon-only variant is requested (just the dual green pills)
  if (variant === 'icon-only') {
    return (
      <svg
        viewBox="0 0 240 300"
        className={`shrink-0 ${className}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="20" y="30" width="85" height="240" rx="42.5" fill="#1eb980" />
        <rect x="135" y="30" width="85" height="240" rx="42.5" fill="#1eb980" />
      </svg>
    );
  }

  // Determine text color class based on variant
  // auto: Black in light mode, White in dark mode
  let voxTextFillClass = 'fill-[#09090b] [html:not(.light)_&]:fill-white [html.light_&]:fill-[#09090b]';
  if (variant === 'light') {
    voxTextFillClass = 'fill-[#09090b]';
  } else if (variant === 'dark') {
    voxTextFillClass = 'fill-white';
  }

  return (
    <svg
      viewBox="0 0 900 400"
      className={`shrink-0 select-none ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left Dual Green Capsule / Pill Bars */}
      <rect x="40" y="80" width="76" height="240" rx="38" fill="#1eb980" />
      <rect x="156" y="80" width="76" height="240" rx="38" fill="#1eb980" />

      {/* Main VOX Wordmark */}
      <g className={`${voxTextFillClass} transition-colors duration-200`}>
        {/* V */}
        <path d="M 298 120 L 372 278 L 418 278 L 492 120 L 436 120 L 395 218 L 354 120 Z" />
        {/* O */}
        <path d="M 578 116 C 522 116 478 154 478 200 C 478 246 522 284 578 284 C 634 284 678 246 678 200 C 678 154 634 116 578 116 Z M 578 154 C 606 154 628 174 628 200 C 628 226 606 246 578 246 C 550 246 528 226 528 200 C 528 174 550 154 578 154 Z" />
        {/* X */}
        <path d="M 684 120 L 738 196 L 678 278 L 732 278 L 766 228 L 800 278 L 854 278 L 794 196 L 848 120 L 794 120 L 766 162 L 738 120 Z" />
      </g>

      {/* Green Underline Base & OZET Serif Text */}
      {showSubtitle && (
        <>
          <line
            x1="324"
            y1="316"
            x2="660"
            y2="316"
            stroke="#1eb980"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <text
            x="674"
            y="328"
            fontFamily="'Times New Roman', 'Playfair Display', Georgia, serif"
            fontWeight="900"
            fontSize="52"
            fill="#1eb980"
            letterSpacing="2"
          >
            OZET
          </text>
        </>
      )}
    </svg>
  );
};
