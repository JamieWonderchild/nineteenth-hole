'use client';

import * as React from 'react';
import { LucideIcon, Check } from 'lucide-react';
import { Button } from './button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  features?: string[]; // List of features/benefits to display
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'ghost';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  children?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  features,
  action,
  secondaryAction,
  children,
  size = 'medium',
}: EmptyStateProps) {
  const sizeClasses = {
    small: {
      container: 'py-8',
      icon: 'h-8 w-8',
      title: 'text-base',
      description: 'text-sm',
    },
    medium: {
      container: 'py-12',
      icon: 'h-12 w-12',
      title: 'text-lg',
      description: 'text-sm',
    },
    large: {
      container: 'py-16',
      icon: 'h-16 w-16',
      title: 'text-xl',
      description: 'text-base',
    },
  };

  const classes = sizeClasses[size];

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${classes.container}`}
    >
      {Icon && (
        <div className="mb-4 rounded-full bg-muted p-4">
          <Icon className={`${classes.icon} text-muted-foreground`} />
        </div>
      )}

      <h3 className={`font-semibold ${classes.title} mb-2`}>{title}</h3>

      <p
        className={`${classes.description} text-muted-foreground max-w-md mb-6`}
      >
        {description}
      </p>

      {features && features.length > 0 && (
        <div className="mb-6 max-w-md">
          <ul className="space-y-2 text-left">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {children && <div className="mb-6 max-w-md">{children}</div>}

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || 'default'}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button onClick={secondaryAction.onClick} variant="outline">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
