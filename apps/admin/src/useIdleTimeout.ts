import { useEffect } from 'react';

/**
 * Auto-logout setelah `minutes` tanpa aktivitas.
 *
 * Menyimpan timestamp aktivitas terakhir di localStorage (bukan hanya timer di
 * memori) supaya: (a) tahan throttling timer di tab background, (b) lintas-tab —
 * aktivitas di satu tab menyegarkan semua. Saat idle terlampaui: bersihkan sesi
 * dan arahkan ke halaman login dengan penanda ?idle=1.
 *
 * Override lama idle via env VITE_IDLE_MINUTES saat build (default 15).
 */
const DEFAULT_MINUTES = Number(import.meta.env.VITE_IDLE_MINUTES) || 15;
const KEY = 'admin_last_activity';
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

export function useIdleTimeout(minutes: number = DEFAULT_MINUTES): void {
  useEffect(() => {
    const ms = minutes * 60_000;
    const mark = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* storage penuh/diblokir */ } };
    mark();
    for (const e of EVENTS) window.addEventListener(e, mark, { passive: true });

    const check = window.setInterval(() => {
      const last = Number(localStorage.getItem(KEY) || Date.now());
      if (Date.now() - last > ms) {
        window.clearInterval(check);
        localStorage.clear();
        window.location.href = `${import.meta.env.BASE_URL}login?idle=1`;
      }
    }, 15_000);

    return () => {
      window.clearInterval(check);
      for (const e of EVENTS) window.removeEventListener(e, mark);
    };
  }, [minutes]);
}
