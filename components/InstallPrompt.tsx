"use client";

import { useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_HOURS = 24;

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw) {
      const ts = parseInt(raw, 10);
      if (Number.isNaN(ts)) {
        localStorage.removeItem(DISMISS_KEY);
      } else {
        const hours = (Date.now() - ts) / (1000 * 60 * 60);
        if (hours < DISMISS_HOURS) return;
      }
    }

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    const installedHandler = () => {
      setShow(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  useEffect(() => {
    if (!show) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => closeBtnRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [show]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "dismissed") {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    }
    setShow(false);
    setDeferredPrompt(null);
    lastFocusedRef.current?.focus();
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setShow(false);
    lastFocusedRef.current?.focus();
  };

  useEffect(() => {
    if (!show) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    const handleTab = (e: KeyboardEvent) => {
      const el = overlayRef.current;
      if (!el || e.key !== "Tab") return;
      const focusables = el.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleEsc);
    window.addEventListener("keydown", handleTab);
    return () => {
      window.removeEventListener("keydown", handleEsc);
      window.removeEventListener("keydown", handleTab);
    };
  }, [show, handleDismiss]);

  if (!show) return null;

  return (
    <div
      className="install-popup-overlay"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Install Cinemastral"
      onClick={handleDismiss}
    >
      <div className="install-popup" onClick={(e) => e.stopPropagation()}>
        <button className="install-popup-close" ref={closeBtnRef} onClick={handleDismiss} aria-label="Tutup">
          <i className="fa-solid fa-xmark" />
        </button>
        <div className="install-popup-icon">
          <img src="/icon-192.png" alt="Cinemastral" />
        </div>
        <div className="install-popup-content">
          <h3 className="install-popup-title">Install Cinemastral</h3>
          <p className="install-popup-desc">
            Pasang di perangkatmu untuk akses lebih cepat dan buka seperti aplikasi.
          </p>
          <div className="install-popup-features">
            <span><i className="fa-solid fa-bolt" /> Cepat</span>
            <span><i className="fa-solid fa-display" /> Fullscreen</span>
          </div>
          <div className="install-popup-actions">
            <button onClick={handleDismiss} className="install-popup-later">
              Nanti aja
            </button>
            <button onClick={handleInstall} className="install-popup-btn">
              <i className="fa-solid fa-download" />
              Install Sekarang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
