import React from 'react';
import { InsigniaType } from '../types';

interface SymbolProps {
  size?: number;
  className?: string;
  title?: string;
}

export const FemaleSymbol: React.FC<SymbolProps> = ({
  size = 19,
  className = 'text-red-600',
  title = 'Mujer',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`inline-block shrink-0 ${className}`}
    title={title}
    aria-label={title}
  >
    <circle cx="12" cy="8" r="5" />
    <path d="M12 13v8" />
    <path d="M8.5 17.5h7" />
  </svg>
);

export const MaleSymbol: React.FC<SymbolProps> = ({
  size = 19,
  className = 'text-blue-600',
  title = 'Hombre',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`inline-block shrink-0 ${className}`}
    title={title}
    aria-label={title}
  >
    <circle cx="10" cy="14" r="5" />
    <path d="M19 5l-5.4 5.4" />
    <path d="M13.5 5H19v5.5" />
  </svg>
);

export const RevisionSymbol: React.FC<SymbolProps> = ({
  size = 12,
  className = 'text-amber-500',
  title = 'Revisión',
}) => (
  <span
    style={{ fontSize: `${size}px`, lineHeight: 1 }}
    className={`inline-block font-black select-none shrink-0 ${className}`}
    title={title}
    aria-label={title}
  >
    ●
  </span>
);

export function getInsigniaColorStyles(insignia: InsigniaType) {
  switch (insignia) {
    case 'MUJER':
      return {
        text: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-200',
        activeBg: 'bg-red-600 text-white border-red-700',
        selectBg: 'bg-red-50/90 text-red-700 border-red-300 focus:ring-red-400',
        label: 'MUJER',
        symbol: '♀',
      };
    case 'HOMBRE':
      return {
        text: 'text-blue-700',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        activeBg: 'bg-blue-600 text-white border-blue-700',
        selectBg: 'bg-blue-50/90 text-blue-700 border-blue-300 focus:ring-blue-400',
        label: 'HOMBRE',
        symbol: '♂',
      };
    case 'REVISION':
    default:
      return {
        text: 'text-amber-800',
        bg: 'bg-amber-50',
        border: 'border-amber-300',
        activeBg: 'bg-amber-500 text-white border-amber-600',
        selectBg: 'bg-amber-50/90 text-amber-800 border-amber-300 focus:ring-amber-400',
        label: 'REVISIÓN',
        symbol: '●',
      };
  }
}
