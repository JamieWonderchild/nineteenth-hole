import { ManageSidebar } from "@/components/layout/ManageSidebar";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <ManageSidebar />
      <div className="flex-1 min-w-0 flex flex-col pt-14 md:pt-0">
        {children}
      </div>
    </div>
  );
}
