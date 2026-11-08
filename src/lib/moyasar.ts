/**
 * Moyasar's payment form (Saudi card top-ups), loaded on demand.
 *
 * The script and its stylesheet used to sit in the root layout, so a
 * third-party payment script ran on every page of the dashboard. They are now
 * added only when the top-up form actually needs Moyasar, and only once per tab.
 *
 * No Subresource Integrity: Moyasar publishes no hash for `mpf`, and
 * cdn.moyasar.com sends no `Access-Control-Allow-Origin`, so a `crossorigin`
 * load (which SRI requires) would be refused by the browser. The version stays
 * pinned in the URL.
 */

export const MOYASAR_VERSION = '1.14.0';

const MOYASAR_BASE = `https://cdn.moyasar.com/mpf/${MOYASAR_VERSION}`;
const SCRIPT_URL   = `${MOYASAR_BASE}/moyasar.js`;
const STYLE_URL    = `${MOYASAR_BASE}/moyasar.css`;

/** How long the script may take before the form reports it could not be loaded. */
const LOAD_TIMEOUT_MS = 20_000;

type MoyasarGlobal = typeof Moyasar;
type WindowWithMoyasar = Window & { Moyasar?: MoyasarGlobal };

let loading: Promise<MoyasarGlobal> | null = null;

/**
 * Resolve with `window.Moyasar`, adding the script and stylesheet first if this
 * tab has not loaded them yet. Rejects when the script fails, is blocked or
 * times out; the next call tries again.
 */
export function loadMoyasar(): Promise<MoyasarGlobal> {
  const w = window as WindowWithMoyasar;
  if (w.Moyasar) return Promise.resolve(w.Moyasar);
  if (loading) return loading;

  if (!document.querySelector('link[data-moyasar]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLE_URL;
    link.dataset.moyasar = '';
    document.head.appendChild(link);
  }

  loading = new Promise<MoyasarGlobal>((resolve, reject) => {
    const script = document.createElement('script');

    // Only ever called from the timer or the script's own events, so `timer`
    // is always assigned by then.
    const fail = (reason: string) => {
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      script.remove();
      loading = null;
      reject(new Error(`The Moyasar payment form ${reason}.`));
    };

    const timer = setTimeout(() => fail(`did not load within ${LOAD_TIMEOUT_MS / 1000} s`), LOAD_TIMEOUT_MS);
    script.onload = () => {
      clearTimeout(timer);
      if (w.Moyasar) resolve(w.Moyasar);
      else fail('script loaded without defining window.Moyasar');
    };
    script.onerror = () => fail('script could not be loaded (network, CSP or ad blocker)');

    script.src = SCRIPT_URL;
    script.async = true;
    script.dataset.moyasar = '';
    document.head.appendChild(script);
  });
  return loading;
}
