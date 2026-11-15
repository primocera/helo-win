// Product settings. Fill in the store values once the Lemon Squeezy product exists.
// The app and mascot names live in src/shared/brand.ts.
import { APP_NAME, MASCOT_NAME } from '../shared/brand';

export const config = {
  appName: APP_NAME,
  mascotName: MASCOT_NAME,
  price: '$9.99',
  trialDays: 7,
  defaultPort: 47615,
  store: {
    // Checkout page. Buyers get the download link and license key by email.
    buyUrl: 'https://example.com/buy',
    // Set both so keys from other Lemon Squeezy stores are rejected.
    storeId: null as number | null,
    productId: null as number | null,
  },
};
