// Persistent URL parameters preserved across navigation
export interface PersistentParams {
  assume?: string; // Superadmin assume mode
  // Future: Add more persistent params
  // filter?: string;
  // view?: 'grid' | 'list';
}

export type PersistentParamKey = keyof PersistentParams;

export interface NavigationContext {
  params: PersistentParams;
  buildUrl: (path: string, additionalParams?: Record<string, string>) => string;
  setParam: (key: PersistentParamKey, value: string | null) => void;
}
