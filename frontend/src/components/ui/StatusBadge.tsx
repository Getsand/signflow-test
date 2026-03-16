/**
 * StatusBadge Component
 * Displays file/signature field status with consistent colors
 */

import React from 'react';

type FileStatus = 'UPLOADING' | 'COMPLETED' | 'FAILED' | 'LOCKED' | 'PENDING' | 'SIGNED' | 'DRAFT' | 'SENT' | 'IN_PROGRESS' | 'READY';

interface StatusBadgeProps {
  status: FileStatus;
  size?: 'sm' | 'md';
}

/**
 * StatusBadge - Consistent status display across the app
 * 
 * Color mapping:
 * - UPLOADING → gray
 * - PENDING → amber
 * - COMPLETED → green
 * - LOCKED → purple
 * - FAILED → red
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  /* Draft=gray, Sent=blue, Viewed/In progress=orange, Completed=green, Failed=red */
  const statusConfig: Record<FileStatus, { label: string; bgColor: string; textColor: string; dotColor: string }> = {
    UPLOADING: {
      label: 'Uploading',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
      dotColor: 'bg-gray-500',
    },
    DRAFT: {
      label: 'Draft',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
      dotColor: 'bg-gray-500',
    },
    PENDING: {
      label: 'Pending',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-600',
      dotColor: 'bg-gray-500',
    },
    SENT: {
      label: 'Sent',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      dotColor: 'bg-blue-500',
    },
    IN_PROGRESS: {
      label: 'In Progress',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-800',
      dotColor: 'bg-amber-500',
    },
    SIGNED: {
      label: 'Signed',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      dotColor: 'bg-blue-500',
    },
    COMPLETED: {
      label: 'Completed',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      dotColor: 'bg-green-500',
    },
    READY: {
      label: 'Ready',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      dotColor: 'bg-green-500',
    },
    LOCKED: {
      label: 'Locked',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
      dotColor: 'bg-gray-500',
    },
    FAILED: {
      label: 'Failed',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
      dotColor: 'bg-red-500',
    },
  };

  const config = statusConfig[status] || statusConfig.PENDING;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border border-transparent ${sizeClasses[size]} ${config.bgColor} ${config.textColor}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotColor}`} />
      {config.label}
    </span>
  );
};
