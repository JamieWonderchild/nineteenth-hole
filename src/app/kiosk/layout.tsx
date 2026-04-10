export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-950 text-white select-none">
      {children}
    </div>
  );
}
