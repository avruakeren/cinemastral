"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return;
    }

    let reloaded = false;

    navigator.serviceWorker.register("/sw.js").catch(() => {});

    // Listen for a new SW controlling the page; activate it immediately so
    // fresh deploys propagate on a single reload instead of requiring 2+.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });

    // If a new SW is waiting, tell it to activate right away.
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg && reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    });
  }, []);

  return null;
}
