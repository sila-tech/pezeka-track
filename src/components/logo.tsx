import { CreditCard } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-primary group-data-[collapsible=icon]:justify-center">
      <CreditCard className="h-6 w-6 shrink-0" />
      <span className={cn(
        "font-bold text-lg font-headline truncate",
        "duration-200 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:-translate-x-4"
      )}>
        PezekaTrack
      </span>
    </Link>
  );
}
