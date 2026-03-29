'use client';

import * as React from 'react';
import { X } from 'lucide-react';

interface FeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  preventDismiss?: boolean;
}

export function FeatureModal({
  isOpen,
  onClose,
  title,
  children,
  size = 'medium',
  preventDismiss = false,
}: FeatureModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    small: 'max-w-md',
    medium: 'max-w-2xl',
    large: 'max-w-4xl',
    fullscreen: 'max-w-full h-full',
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (!preventDismiss && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-background rounded-lg shadow-lg w-full ${sizeClasses[size]} ${
          size === 'fullscreen' ? '' : 'max-h-[90vh]'
        } flex flex-col`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">{title}</h2>
          {!preventDismiss && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-md transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
