import * as React from 'react';
import { cn } from '@/lib/utils';

interface FABProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

/**
 * Floating Action Button - Mobile-optimized primary action button
 * Positioned fixed at bottom-right, above mobile nav bar
 */
export function FAB({ children, className, ...props }: FABProps) {
  return (
    <button
      className={cn(
        // Base styles
        'fixed z-50 rounded-full shadow-lg',
        'bg-primary text-primary-foreground',
        'hover:bg-primary/90 active:scale-95',
        'transition-all duration-200',
        // Size
        'h-14 w-14 sm:h-16 sm:w-16',
        // Position - bottom right, above mobile nav
        'bottom-20 right-4',
        'sm:bottom-6 sm:right-6',
        // Focus ring
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
