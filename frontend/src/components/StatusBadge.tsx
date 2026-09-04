import React from 'react';
import { VerificationStatus } from '../types';
import { VERIFICATION_CONFIG } from '../lib/riskHelpers';
import { CheckCircle2, Clock, HelpCircle, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: VerificationStatus | undefined;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const currentStatus = status || 'PENDING_VERIFICATION';
  const config = VERIFICATION_CONFIG[currentStatus] || VERIFICATION_CONFIG.PENDING_VERIFICATION;

  const renderIcon = () => {
    switch (currentStatus) {
      case 'CONFIRMED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-black" />;
      case 'NEEDS_REVIEW':
        return <HelpCircle className="w-3.5 h-3.5 text-zinc-200" />;
      case 'FALSE_POSITIVE':
        return <XCircle className="w-3.5 h-3.5 text-zinc-500" />;
      case 'PENDING_VERIFICATION':
      default:
        return <Clock className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors ${config.badgeClass} ${className}`}
    >
      {renderIcon()}
      <span>{config.label}</span>
    </span>
  );
};
