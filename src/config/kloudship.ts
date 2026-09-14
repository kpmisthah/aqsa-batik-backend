// Read lazily (not at module load) — dotenv.config() in index.ts runs after
// route modules are imported, so a top-level object here would capture
// empty env vars. Call getKloudshipConfig() only once you're past startup.
export function getKloudshipConfig() {
  return {
    baseUrl: process.env.KLOUDSHIP_BASE_URL || '',
    userName: process.env.KLOUDSHIP_USERNAME || '',
    password: process.env.KLOUDSHIP_PASSWORD || '',
    apiKey: process.env.KLOUDSHIP_API_KEY || '',
    apiSecret: process.env.KLOUDSHIP_API_SECRET || '',
    isTest: (process.env.KLOUDSHIP_IS_TEST || 'true').toLowerCase() === 'true',
    pickupLocationId: process.env.KLOUDSHIP_PICKUP_LOCATION_ID || '',
    pickup: {
      firstName: process.env.KLOUDSHIP_PICKUP_FIRST_NAME || '',
      lastName: process.env.KLOUDSHIP_PICKUP_LAST_NAME || '',
      company: process.env.KLOUDSHIP_PICKUP_COMPANY || '',
      street1: process.env.KLOUDSHIP_PICKUP_STREET1 || '',
      street2: process.env.KLOUDSHIP_PICKUP_STREET2 || '',
      city: process.env.KLOUDSHIP_PICKUP_CITY || '',
      state: process.env.KLOUDSHIP_PICKUP_STATE || '',
      zip: process.env.KLOUDSHIP_PICKUP_ZIP || '',
      phone: process.env.KLOUDSHIP_PICKUP_PHONE || '',
      email: process.env.KLOUDSHIP_PICKUP_EMAIL || '',
    },
    // Standard packaging for a single batik suit (16 x 13 x 2 in / 500 g).
    // Used for every order until per-product dimensions are tracked.
    defaultPackage: {
      length: 40.64,
      width: 33.02,
      height: 5.08,
      dimensionUnit: 'cm' as const,
      unitWeightKg: 0.5,
      weightUnit: 'kg' as const,
      minWeightKg: 0.5,
    },
  };
}

export type KloudShipConfig = ReturnType<typeof getKloudshipConfig>;
