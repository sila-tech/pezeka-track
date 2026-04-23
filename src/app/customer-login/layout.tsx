'use client';

export default function CustomerLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-[#1B2B33] overflow-hidden">
      {children}
    </div>
  );
}
