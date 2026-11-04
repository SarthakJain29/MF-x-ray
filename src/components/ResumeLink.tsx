"use client";
import Link from "next/link";
import { useStore } from "@/store/store";

export function ResumeLink() {
  const has = useStore((s) => !!s.cas);
  if (!has) return null;
  return (
    <Link href="/app" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg">
      Open dashboard →
    </Link>
  );
}
