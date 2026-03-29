'use client';

interface UsageMeterProps {
  label: string;
  used: number;
  limit: number | null;
  unit?: string;
}

export function UsageMeter({ label, used, limit, unit = '' }: UsageMeterProps) {
  const isUnlimited = limit === null;
  const percent = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const isWarning = !isUnlimited && percent >= 80;
  const isCritical = !isUnlimited && percent >= 95;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {used.toLocaleString()}
          {isUnlimited ? '' : ` / ${limit!.toLocaleString()}`}
          {unit && ` ${unit}`}
          {isUnlimited && ' (Unlimited)'}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isCritical
                ? 'bg-red-500'
                : isWarning
                  ? 'bg-amber-500'
                  : 'bg-primary'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
