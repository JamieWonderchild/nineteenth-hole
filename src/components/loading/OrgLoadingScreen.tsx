import { Loader2, Stethoscope } from 'lucide-react';

export function OrgLoadingScreen() {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
            <Stethoscope className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">[PRODUCT_NAME]</h1>
        </div>
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground">
          Loading your practice...
        </p>
      </div>
    </div>
  );
}
