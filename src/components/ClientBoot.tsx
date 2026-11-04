"use client";
import { useEffect } from "react";
import { hydrateStore } from "@/store/store";

export function ClientBoot() {
  useEffect(() => {
    hydrateStore();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
