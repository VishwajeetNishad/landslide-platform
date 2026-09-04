import { RiskLevel, VerificationStatus } from '../types';

export const RISK_COLORS = {
  HIGH: {
    hex: '#ef4444',
    fillHex: 'rgba(239, 68, 68, 0.55)',
    strokeHex: '#dc2626',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-700',
    badgeBorder: 'border-red-300',
    dotBg: 'bg-red-600',
    label: 'HIGH RISK',
  },
  MEDIUM: {
    hex: '#f97316',
    fillHex: 'rgba(249, 115, 22, 0.45)',
    strokeHex: '#ea580c',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-300',
    dotBg: 'bg-amber-600',
    label: 'MEDIUM RISK',
  },
  LOW: {
    hex: '#10b981',
    fillHex: 'rgba(16, 185, 129, 0.35)',
    strokeHex: '#059669',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300',
    dotBg: 'bg-emerald-600',
    label: 'LOW RISK',
  },
  NOT_ASSESSED: {
    hex: '#64748b',
    fillHex: 'rgba(100, 116, 139, 0.25)',
    strokeHex: '#475569',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-600',
    badgeBorder: 'border-slate-300',
    dotBg: 'bg-slate-400',
    label: 'NOT ASSESSED',
  },
};

export const VERIFICATION_CONFIG: Record<
  VerificationStatus,
  {
    label: string;
    badgeClass: string;
    dotClass: string;
    code: string;
  }
> = {
  PENDING_VERIFICATION: {
    label: 'Pending verification',
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-300 font-medium',
    dotClass: 'bg-slate-500',
    code: 'PENDING_VERIFICATION',
  },
  CONFIRMED: {
    label: 'Confirmed by officer',
    badgeClass: 'bg-blue-50 text-blue-800 border border-blue-300 font-bold',
    dotClass: 'bg-blue-600',
    code: 'CONFIRMED',
  },
  FALSE_POSITIVE: {
    label: 'False positive',
    badgeClass: 'bg-slate-100 text-slate-500 border border-slate-300 line-through decoration-slate-400 font-medium',
    dotClass: 'bg-slate-400',
    code: 'FALSE_POSITIVE',
  },
  NEEDS_REVIEW: {
    label: 'Needs review',
    badgeClass: 'bg-amber-50 text-amber-800 border border-amber-300 font-semibold',
    dotClass: 'bg-amber-600',
    code: 'NEEDS_REVIEW',
  },
};

export function getRiskColorHex(riskLevel: RiskLevel | undefined): string {
  if (!riskLevel) return RISK_COLORS.NOT_ASSESSED.hex;
  return RISK_COLORS[riskLevel]?.hex || RISK_COLORS.NOT_ASSESSED.hex;
}

export function formatPotentialExposure(pop: number | undefined | null): string {
  if (pop === undefined || pop === null) return 'Not assessed';
  if (pop === 0) return '0 people';
  return `~${pop} people`;
}
