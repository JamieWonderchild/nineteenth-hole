import { ManageSidebar } from "@/components/layout/ManageSidebar";
import { ClubProvider } from "@/lib/club-context";

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClubProvider>
      <div className="flex min-h-screen bg-gray-50">
        <ManageSidebar />
        <div className="flex-1 md:overflow-auto min-w-0 pt-14 md:pt-0">
          {children}
        </div>
      </div>
    </ClubProvider>
  );
}
