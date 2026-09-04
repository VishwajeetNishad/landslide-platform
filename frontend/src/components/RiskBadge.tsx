import React from 'react';
import { RiskLevel } from '../types';
import { RISK_COLORS } from '../lib/riskHelpers';

interface RiskBadgeProps {
  level: RiskLevel | undefined;
  showDot?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ 
  level, 
  showDot = true, 
  className = '',
  size = 'md'
}) => {
  const config = level ? (RISK_COLORS[level] || RISK_COLORS.NOT_ASSESSED) : RISK_COLORS.NOT_ASSESSED;
  const label = level ? level : 'NOT ASSESSED';
  
  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3.5 py-1.5 font-extrabold',
  }[size];

  return (
    <span 
      className={`inline-flex items-center gap-1.5 rounded-full font-bold border uppercase tracking-wide ${config.badgeBg} ${config.badgeText} ${config.badgeBorder} ${sizeClasses} ${className}`}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotBg}`} />
      )}
      <span>{label}</span>
    </span>
  );
};
