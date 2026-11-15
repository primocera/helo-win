import type { HeloApi } from '../../shared/types';

declare global {
  interface Window {
    helo: HeloApi;
  }
}

export {};
