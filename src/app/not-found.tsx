import Link from "next/link";
import { Wordmark } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <Wordmark className="text-xl" />
      <h1 className="mt-8 font-display text-5xl font-extrabold">404</h1>
      <p className="mt-2 text-ink-2">This page doesn&apos;t exist. Your portfolio is fine.</p>
      <Link href="/" className="mt-6 rounded-full bg-ink px-6 py-3 font-display font-bold text-bg">Go home</Link>
    </main>
  );
}
