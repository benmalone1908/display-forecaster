import { CheckCircle, AlertTriangle, AlertCircle, XCircle } from 'lucide-react';

export type SeverityLevel = 'on-target' | 'minor' | 'moderate' | 'major';

export const severityLevels = {
  'on-target': { 
    min: 0.99, 
    max: 1.01, 
    label: 'On Target', 
    description: '±1%',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
    iconColor: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  'minor': { 
    min: 0.90, 
    max: 1.10, 
    label: 'Minor Deviation', 
    description: '±1-10%',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: AlertTriangle,
    iconColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200'
  },
  'moderate': { 
    min: 0.75, 
    max: 1.25, 
    label: 'Moderate Deviation', 
    description: '±10-25%',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: AlertCircle,
    iconColor: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },
  'major': { 
    min: 0, 
    max: 2, 
    label: 'Major Deviation', 
    description: '±25%+',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  }
};

// Utility function to get severity level for a pacing value
export const getSeverityLevel = (pacing: number): SeverityLevel => {
  if (pacing >= severityLevels['on-target'].min && pacing <= severityLevels['on-target'].max) {
    return 'on-target';
  }
  if (pacing >= severityLevels['minor'].min && pacing <= severityLevels['minor'].max) {
    return 'minor';
  }
  if (pacing >= severityLevels['moderate'].min && pacing <= severityLevels['moderate'].max) {
    return 'moderate';
  }
  return 'major';
};

// Utility function to get severity badge
export const getSeverityBadge = (level: SeverityLevel) => {
  const config = severityLevels[level];
  const symbol = level === 'on-target' ? '✓' : 
                level === 'minor' ? '!' : 
                level === 'moderate' ? '!!' : '!!!';
  
  return {
    symbol,
    className: `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`
  };
};