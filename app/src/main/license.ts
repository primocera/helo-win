// One-time purchase licensing through the Lemon Squeezy License API.
// The buyer gets a key by email and pastes it here. The number of PCs per
// key (3) is the "activation limit" set on the product in Lemon Squeezy.
import fs from 'node:fs';
import os from 'node:os';
import type { LicenseStatus } from '../shared/types';

const API = 'https://api.lemonsqueezy.com/v1/licenses';
const DAY = 86_400_000;
const REVALIDATE_AFTER = 7 * DAY;

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ json(): Promise<unknown> }>;

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
}: { file: string; store?: StoreIds; trialDays?: number; fetchImpl?: FetchLike; now?: () => number }): License {
  let data: LicenseData;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8')) as LicenseData;
  } catch {
    data = {} as LicenseData;
  }
  if (typeof data.firstRunAt !== 'number') {
    data.firstRunAt = now();
    save();
  }

  function save() {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  }

  async function post(action: string, params: Record<string, string>): Promise<LsResponse> {
    const res = await fetchImpl(`${API}/${action}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
    return (await res.json()) as LsResponse;
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
