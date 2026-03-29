'use client';

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { ReactNode } from 'react';

interface BannerProps {
  children: ReactNode;
  variant?: 'info' | 'warning' | 'success';
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Banner({
  children,
  variant = 'info',
  onDismiss,
  action,
}: BannerProps) {
  const variantClasses = {
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300',
    warning:
      'bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-300',
    success:
      'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300',
  };

  return (
    <div
      className={`border-b ${variantClasses[variant]} px-4 py-3 sm:pl-[calc(60px+1rem)] flex items-center justify-between gap-4`}
    >
      <div className="flex-1 flex items-center gap-4">
        <p className="text-sm font-medium">{children}</p>
        {action && (
          <Button
            onClick={action.onClick}
            size="sm"
            variant="outline"
            className="border-current"
          >
            {action.label}
          </Button>
        )}
      </div>

      {onDismiss && (
        <Button
          onClick={onDismiss}
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
