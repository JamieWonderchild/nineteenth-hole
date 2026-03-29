'use client';

import * as React from 'react';
import { X } from 'lucide-react';

export interface WizardStep {
  id: string;
  title: string;
  component: React.ComponentType<{ onNext: () => void; onBack: () => void; data: any; setData: (data: any) => void }>;
}

interface WizardProps {
  steps: WizardStep[];
  currentStep: number;
  onNext: () => void;
  onBack: () => void;
  onComplete: () => void;
  onSkip?: () => void;
  onClose?: () => void;
  data?: any;
  setData?: (data: any) => void;
  showStepIndicator?: boolean;
  skipLabel?: string;
}

export function Wizard({
  steps,
  currentStep,
  onNext,
  onBack,
  onComplete,
  onSkip,
  onClose,
  data = {},
  setData,
  showStepIndicator = true,
  skipLabel = 'Skip for now',
}: WizardProps) {
  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      onNext();
    }
  };

  if (!step) return null;

  const StepComponent = step.component;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex-1">
          {showStepIndicator && (
            <div className="flex items-center gap-2">
              {steps.map((s, i) => (
                <React.Fragment key={s.id}>
                  <div
                    className={`h-2 flex-1 rounded-full transition-colors ${
                      i <= currentStep ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 ml-6">
          {onSkip && !isLastStep && (
            <button
              onClick={onSkip}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {skipLabel}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-md transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <StepComponent
          onNext={handleNext}
          onBack={onBack}
          data={data}
          setData={setData || (() => {})}
        />
      </div>
    </div>
  );
}
