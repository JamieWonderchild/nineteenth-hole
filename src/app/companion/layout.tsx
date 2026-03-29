/**
 * Companion pages are public-facing with a fixed light design.
 * This layout resets the dark-mode CSS variables so that global styles
 * like `.prose { color: hsl(var(--foreground)) }` always use light values,
 * even when the main app is in dark mode.
 */
export default function CompanionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        '--foreground': '220 13% 10%',
        '--card-foreground': '220 13% 10%',
        '--muted-foreground': '0 0% 45.1%',
        '--background': '0 0% 100%',
        '--card': '0 0% 100%',
        '--border': '0 0% 89.8%',
        '--muted': '160 10% 96%',
      } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
