// One-time purchase licensing through the Lemon Squeezy License API.
// The buyer gets a key by email and pastes it here. The number of PCs per
// key (3) is the "activation limit" set on the product in Lemon Squeezy.
//
// On disk: with a codec (Windows data protection in the app) the trial start, key and
// activation are in `license.bin`, which cannot be edited by hand or copied to another
// account. Without one it is the plain `license.json` of older versions. Deleting the file
// still restarts the trial; for a small one-time purchase that is accepted.
import fs from 'node:fs';
import os from 'node:os';
import type { LicenseStatus } from '../shared/types';

const API = 'https://api.lemonsqueezy.com/v1/licenses';
const DAY = 86_400_000;
const REVALIDATE_AFTER = 7 * DAY;
/** How long a call to the license server may take. */
export const LICENSE_TIMEOUT_MS = 10_000;

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ json(): Promise<unknown> }>;

/** Encrypts and decrypts the license file (Electron's safeStorage in the app). */
export interface LicenseCodec {
  seal(data: Buffer): Buffer;
  open(data: Buffer): Buffer;
}

interface LicenseData {
  firstRunAt: number;
  key?: string;
  instanceId?: string;
  validatedAt?: number;
}

interface StoreIds {
  storeId?: number | null;
  productId?: number | null;
}

interface LsResponse {
  activated?: boolean;
  deactivated?: boolean;
  valid?: boolean;
  error?: string;
  instance?: { id: string };
  meta?: { store_id?: number; product_id?: number };
}

export interface License {
  status(): LicenseStatus;
  activate(rawKey: string): Promise<void>;
  revalidate(): Promise<void>;
  deactivate(): Promise<void>;
}

export function createLicense({
  file,
  store = {},
  trialDays = 7,
  fetchImpl = fetch as unknown as FetchLike,
  now = Date.now,
  codec = null,
  timeoutMs = LICENSE_TIMEOUT_MS,
}: { file: string; store?: StoreIds; trialDays?: number; fetchImpl?: FetchLike; now?: () => number; codec?: LicenseCodec | null; timeoutMs?: number }): License {
  // `file` is the plain file's path; the encrypted one sits beside it.
  const sealedFile = file.replace(/\.json$/i, '') + '.bin';
  let data = {} as LicenseData;
  let needsSave = false;
  let loaded = false;
  if (codec && fs.existsSync(sealedFile)) {
    try {
      data = JSON.parse(codec.open(fs.readFileSync(sealedFile)).toString('utf8')) as LicenseData;
      loaded = true;
    } catch { /* unreadable: start again, as with a missing file */ }
  }
  if (!loaded) {
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8')) as LicenseData;
      // A plain file from an older version: it is encrypted now.
      needsSave = Boolean(codec);
    } catch { /* first run */ }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {} as LicenseData;
  // A date in the future is a set-back clock or an edited file. Neither extends the trial
  // or skips the check with the store.
  if (typeof data.firstRunAt !== 'number' || !Number.isFinite(data.firstRunAt) || data.firstRunAt > now()) {
    data.firstRunAt = now();
    needsSave = true;
  }
  if (typeof data.validatedAt === 'number' && data.validatedAt > now()) {
    data.validatedAt = 0;
    needsSave = true;
  }
  if (needsSave) save();

  /** Writes through a temp file and a rename, so a crash mid-write cannot reset the trial. */
  function save() {
    try {
      const target = codec ? sealedFile : file;
      const bytes = codec ? codec.seal(Buffer.from(JSON.stringify(data), 'utf8')) : Buffer.from(JSON.stringify(data, null, 2), 'utf8');
      const tmp = `${target}.tmp`;
      fs.writeFileSync(tmp, bytes);
      fs.renameSync(tmp, target);
      if (codec) fs.rmSync(file, { force: true });
    } catch { /* a read-only or full disk: the license still works for this run */ }
  }

  async function post(action: string, params: Record<string, string>): Promise<LsResponse> {
    let res: { json(): Promise<unknown> };
    try {
      res = await fetchImpl(`${API}/${action}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const name = (err as Error)?.name;
      throw new Error(name === 'TimeoutError' || name === 'AbortError'
        ? 'The license server did not answer in time. Check your connection and try again.'
        : 'Could not reach the license server. Check your connection and try again.');
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      // An error page instead of an answer (a proxy, a captive portal, the store being down).
      throw new Error('The license server sent an answer that could not be read. Try again in a few minutes.');
    }
    if (!json || typeof json !== 'object') throw new Error('The license server sent an answer that could not be read. Try again in a few minutes.');
    return json as LsResponse;
  }

  function wrongProduct(meta: LsResponse['meta'] = {}) {
    return (store.storeId != null && meta.store_id !== store.storeId)
      || (store.productId != null && meta.product_id !== store.productId);
  }

  function clear() {
    data = { firstRunAt: data.firstRunAt };
    save();
  }

  return {
    status() {
      if (data.key && data.instanceId) return { state: 'licensed' };
      const daysLeft = Math.ceil(trialDays - (now() - data.firstRunAt) / DAY);
      return daysLeft > 0 ? { state: 'trial', daysLeft } : { state: 'expired' };
    },

    async activate(rawKey) {
      const key = String(rawKey || '').trim();
      if (!key) throw new Error('Enter your license key.');
      const json = await post('activate', { license_key: key, instance_name: os.hostname() });
      if (!json.activated || !json.instance) throw new Error(json.error || 'This key could not be activated.');
      if (wrongProduct(json.meta)) {
        // Give the activation back; the key belongs to another product.
        await post('deactivate', { license_key: key, instance_id: json.instance.id }).catch(() => {});
        throw new Error('This key is for a different product.');
      }
      data = { firstRunAt: data.firstRunAt, key, instanceId: json.instance.id, validatedAt: now() };
      save();
    },

    /** Checks the stored key with the server now and then. Offline is fine. */
    async revalidate() {
      if (!data.key || !data.instanceId) return;
      if (now() - (data.validatedAt || 0) < REVALIDATE_AFTER) return;
      let json: LsResponse;
      try {
        json = await post('validate', { license_key: data.key, instance_id: data.instanceId });
      } catch {
        return;
      }
      if (json.valid === false) {
        clear();
        return;
      }
      data.validatedAt = now();
      save();
    },

    /** Frees this PC's slot so the key can be used on another one. */
    async deactivate() {
      if (!data.key || !data.instanceId) return;
      const json = await post('deactivate', { license_key: data.key, instance_id: data.instanceId });
      if (!json.deactivated) throw new Error(json.error || 'Could not deactivate this PC.');
      clear();
    },
  };
}
