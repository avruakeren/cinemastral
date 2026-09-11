"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getAdultMode, setAdultMode, subscribeAdultMode } from "@/lib/adult-store";

export function AdultModeToggle() {
  const on = useSyncExternalStore(subscribeAdultMode, getAdultMode);
  const [showWarning, setShowWarning] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!showWarning) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => confirmBtnRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [showWarning]);

  const handleToggle = () => {
    if (on) {
      setAdultMode(false);
    } else {
      setShowWarning(true);
    }
  };

  const handleConfirm = () => {
    setAdultMode(true);
    setConfirmed(true);
    setShowWarning(false);
    lastFocusedRef.current?.focus();
  };

  const handleCancel = () => {
    setShowWarning(false);
    lastFocusedRef.current?.focus();
  };

  useEffect(() => {
    if (!showWarning) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWarning]);

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        className={`adult-toggle ${on ? "is-on" : ""}`}
        aria-pressed={on}
        aria-label={on ? "Sembunyikan konten dewasa" : "Tampilkan konten dewasa"}
      >
        <span className="adult-toggle-track">
          <span className="adult-toggle-thumb" />
        </span>
        <span className="adult-toggle-label">
          <i className={`fa-solid ${on ? "fa-eye" : "fa-eye-slash"}`} />
          {on ? "Mode Dewasa: ON" : "Mode Dewasa: OFF"}
        </span>
      </button>

      {showWarning && (
        <div
          className="adult-warning-overlay"
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="adult-warning-title"
          onClick={handleCancel}
        >
          <div className="adult-warning" onClick={(e) => e.stopPropagation()}>
            <div className="adult-warning-icon">
              <i className="fa-solid fa-triangle-exclamation" />
            </div>
            <h3 id="adult-warning-title" className="adult-warning-title">
              Peringatan Konten Dewasa (18+)
            </h3>
            <p className="adult-warning-desc">
              Kamu akan menampilkan konten dewasa yang hanya diperuntukkan bagi orang berusia 18
              tahun ke atas. Konten ini mengandung materi seksual eksplisit dan tidak cocok untuk
              anak-anak.
            </p>
            <div className="adult-warning-actions">
              <button className="adult-warning-cancel" onClick={handleCancel}>
                Batal
              </button>
              <button className="adult-warning-confirm" ref={confirmBtnRef} onClick={handleConfirm}>
                Saya berusia 18+ dan mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmed && !showWarning && (
        <div className="adult-toast" role="status">
          Mode Dewasa diaktifkan
        </div>
      )}
    </>
  );
}
