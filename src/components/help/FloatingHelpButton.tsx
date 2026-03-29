'use client';

import { useState } from 'react';
import {
  HelpCircle,
  X,
  Stethoscope,
  Users,
  FileText,
  Settings,
  CreditCard,
  BookOpen,
  ExternalLink,
} from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';

interface HelpAction {
  icon: React.ElementType;
  label: string;
  description: string;
  href: string;
  external?: boolean;
}

const HELP_ACTIONS: HelpAction[] = [
  {
    icon: Stethoscope,
    label: 'Add a patient',
    description: 'Create your first patient record',
    href: '/patient-records',
  },
  {
    icon: FileText,
    label: 'Start a encounter',
    description: 'Record and document a visit',
    href: '/encounter/new',
  },
  {
    icon: Users,
    label: 'Invite team members',
    description: 'Add providers and staff to your practice',
    href: '/settings/team',
  },
  {
    icon: Settings,
    label: 'Configure settings',
    description: 'Manage your practice and preferences',
    href: '/settings',
  },
  {
    icon: CreditCard,
    label: 'Manage billing',
    description: 'Update plan and payment methods',
    href: '/settings/billing',
  },
  {
    icon: BookOpen,
    label: 'View documentation',
    description: 'Learn about [PRODUCT_NAME] features',
    href: 'https://docs.[PRODUCT_NAME_DOMAIN]',
    external: true,
  },
];

export function FloatingHelpButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-200 ${
          isOpen
            ? 'bg-accent text-foreground'
            : 'bg-primary text-primary-foreground hover:scale-110'
        }`}
        aria-label="Help"
      >
        {isOpen ? (
          <X className="h-6 w-6 mx-auto" />
        ) : (
          <HelpCircle className="h-6 w-6 mx-auto" />
        )}
      </button>

      {/* Help Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu Panel */}
          <div className="fixed bottom-24 right-6 z-50 w-80 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-primary/5 border-b border-border">
              <h3 className="font-semibold text-lg">Need help?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Quick actions and guides
              </p>
            </div>

            {/* Actions */}
            <div className="p-2 max-h-96 overflow-y-auto">
              {HELP_ACTIONS.map((action) => {
                const Icon = action.icon;

                if (action.external) {
                  return (
                    <a
                      key={action.label}
                      href={action.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent transition-colors group"
                      onClick={() => setIsOpen(false)}
                    >
                      <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-medium">{action.label}</p>
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {action.description}
                        </p>
                      </div>
                    </a>
                  );
                }

                return (
                  <AppLink
                    key={action.label}
                    href={action.href}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent transition-colors group"
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{action.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {action.description}
                      </p>
                    </div>
                  </AppLink>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-3 bg-muted/50 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Need more help? Contact{' '}
                <a
                  href="mailto:support@[PRODUCT_NAME_DOMAIN]"
                  className="text-primary hover:underline"
                >
                  support@[PRODUCT_NAME_DOMAIN]
                </a>
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
