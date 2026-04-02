export type NavigationDestination =
  | 'dashboard'
  | 'encounters'
  | 'billing'
  | 'catalog'
  | 'settings';

export type VoiceCommandIntent =
  | { action: 'navigate'; destination: NavigationDestination }
  | { action: 'open_patient'; patientName: string }
  | { action: 'start_note'; patientName?: string }
  | { action: 'create_invoice'; patientName?: string }
  | { action: 'unknown' };

export type VoiceOverlayState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'executing'
  | 'error';
