const ADULT_KEY = "cinemastral-adult-mode";

const listeners = new Set<() => void>();

export function getAdultMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ADULT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAdultMode(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(ADULT_KEY, "1");
    } else {
      localStorage.removeItem(ADULT_KEY);
    }
  } catch {}
  listeners.forEach((l) => l());
}

export function subscribeAdultMode(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
