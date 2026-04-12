import { ClubProvider } from "@/lib/club-context";

// Fullscreen layout — no sidebar, no nav.
// Used by the operational POS till (/pos).
export default function POSOperateLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClubProvider>
      <div className="h-screen overflow-hidden bg-gray-100">
        {children}
      </div>
    </ClubProvider>
  );
}
