'use client';

/**
 * @fileOverview Passthrough layout for the Agent section.
 * The layout logic has been consolidated into the page component to resolve hydration and chunk loading issues.
 */
export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
