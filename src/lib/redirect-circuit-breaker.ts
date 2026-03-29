// Circuit breaker to prevent infinite redirect loops
// Tracks redirect attempts and opens the circuit after too many failures

const STORAGE_KEY = 'vetai_redirect_breaker';
const MAX_ATTEMPTS = 3;
const COOLDOWN_MS = 30000; // 30 seconds

export interface RedirectAttempt {
  timestamp: number;
  reason: string;
  pathname: string;
  context: {
    userId?: string;
    clerkOrgId?: string;
    hasOrgContext: boolean;
    clerkOrgCount: number;
  };
}

export interface CircuitBreakerState {
  isOpen: boolean;
  attempts: RedirectAttempt[];
  openedAt?: number;
}

export class RedirectCircuitBreaker {
  private getState(): CircuitBreakerState {
    if (typeof window === 'undefined') {
      return { isOpen: false, attempts: [] };
    }

    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return { isOpen: false, attempts: [] };
      }

      const state = JSON.parse(stored) as CircuitBreakerState;

      // Auto-close circuit after cooldown
      if (state.isOpen && state.openedAt) {
        const elapsed = Date.now() - state.openedAt;
        if (elapsed >= COOLDOWN_MS) {
          return { isOpen: false, attempts: [] };
        }
      }

      return state;
    } catch (err) {
      console.error('Failed to read circuit breaker state:', err);
      return { isOpen: false, attempts: [] };
    }
  }

  private setState(state: CircuitBreakerState): void {
    if (typeof window === 'undefined') return;

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Failed to save circuit breaker state:', err);
    }
  }

  /**
   * Check if the circuit breaker is currently open
   */
  isOpen(): boolean {
    return this.getState().isOpen;
  }

  /**
   * Record a redirect attempt
   * Opens the circuit if too many attempts in a short time
   */
  recordAttempt(reason: string, pathname: string, context: RedirectAttempt['context']): void {
    const state = this.getState();
    const now = Date.now();

    // Only count attempts in the last 10 seconds
    const recentAttempts = state.attempts.filter(
      (attempt) => now - attempt.timestamp < 10000
    );

    const newAttempt: RedirectAttempt = {
      timestamp: now,
      reason,
      pathname,
      context,
    };

    recentAttempts.push(newAttempt);

    // Open circuit if too many attempts
    if (recentAttempts.length >= MAX_ATTEMPTS) {
      console.error('🔴 Circuit breaker OPENED - too many redirect attempts', {
        attempts: recentAttempts,
      });

      this.setState({
        isOpen: true,
        attempts: recentAttempts,
        openedAt: now,
      });
    } else {
      this.setState({
        isOpen: false,
        attempts: recentAttempts,
      });
    }
  }

  /**
   * Get breadcrumb trail of recent redirect attempts
   */
  getBreadcrumbs(): RedirectAttempt[] {
    return this.getState().attempts;
  }

  /**
   * Get remaining cooldown time in milliseconds
   */
  getRemainingCooldown(): number {
    const state = this.getState();
    if (!state.isOpen || !state.openedAt) return 0;

    const elapsed = Date.now() - state.openedAt;
    const remaining = COOLDOWN_MS - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.setState({ isOpen: false, attempts: [] });
  }
}
