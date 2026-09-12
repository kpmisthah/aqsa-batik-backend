import crypto from 'crypto';
import { getKloudshipConfig } from '../config/kloudship.js';

interface KloudShipStateInfo {
  name: string;
  code: string;
}

interface KloudShipAddressInput {
  firstName: string;
  lastName?: string;
  company?: string;
  email: string;
  phone: string;
  address: string; // single free-text line as captured on the site today
  city: string;
  state: string; // full name as typed by the customer
  zip: string;
}

const TOKEN_LIFETIME_MS = 50 * 60 * 1000; // refresh a bit before the ~1h token actually expires

class KloudShipService {
  private token: string | null = null;
  private tokenFetchedAt = 0;
  private statesCache = new Map<string, KloudShipStateInfo[]>();

  private assertConfigured(cfg: ReturnType<typeof getKloudshipConfig>) {
    if (!cfg.baseUrl || !cfg.apiKey || !cfg.apiSecret) {
      throw new Error('KloudShip is not configured. Set KLOUDSHIP_BASE_URL/API_KEY/API_SECRET in .env.');
    }
  }

  private async fetchToken(): Promise<string> {
    const cfg = getKloudshipConfig();
    this.assertConfigured(cfg);
    const res = await fetch(`${cfg.baseUrl}/Auth/Token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName: cfg.userName,
        password: cfg.password,
        apiKey: cfg.apiKey,
        apiSecret: cfg.apiSecret,
      }),
    });

    if (!res.ok) {
      throw new Error(`KloudShip auth failed (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    if (!data.token) {
      throw new Error('KloudShip auth response did not contain a token.');
    }
    return data.token as string;
  }

  private async getToken(forceRefresh = false): Promise<string> {
    const isStale = Date.now() - this.tokenFetchedAt > TOKEN_LIFETIME_MS;
    if (!this.token || isStale || forceRefresh) {
      this.token = await this.fetchToken();
      this.tokenFetchedAt = Date.now();
    }
    return this.token;
  }

  /**
   * Authorized request helper. Retries once with a fresh token on 401.
   */
  private async request<T = any>(
    path: string,
    options: { method?: string; body?: any; headers?: Record<string, string>; retry?: boolean } = {}
  ): Promise<T> {
    const cfg = getKloudshipConfig();
    this.assertConfigured(cfg);
    const { method = 'GET', body, headers = {}, retry = true } = options;
    const token = await this.getToken();

    const init: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...headers,
      },
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const res = await fetch(`${cfg.baseUrl}${path}`, init);

    if (res.status === 401 && retry) {
      await this.getToken(true);
      return this.request<T>(path, { ...options, retry: false });
    }

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const message = data?.message || data?.errors?.[0]?.message || text || `KloudShip request failed (${res.status})`;
      throw new Error(message);
    }

    return data as T;
  }

  /**
   * Fetches (and caches) the state list for a country, used to resolve the
   * free-text state names the site currently collects into KloudShip's
   * required 2-letter state codes.
   */
  async getStates(countryCode = 'IN'): Promise<KloudShipStateInfo[]> {
    const cached = this.statesCache.get(countryCode);
    if (cached) return cached;

    const data = await this.request<{ states: KloudShipStateInfo[] }>(`/MetaData/Country/${countryCode}`);
    const states = data.states || [];
    this.statesCache.set(countryCode, states);
    return states;
  }

  async resolveStateCode(stateInput: string, countryCode = 'IN'): Promise<string> {
    const states = await this.getStates(countryCode);
    const normalized = stateInput.trim().toLowerCase();

    const match = states.find(
      (s) => s.code.toLowerCase() === normalized || s.name.toLowerCase() === normalized
    );

    if (!match) {
      throw new Error(`"${stateInput}" is not a recognized state for shipping. Please check the spelling.`);
    }

    return match.code;
  }

  private splitPhone(phone: string): { phoneCode: string; phone: string } {
    const digits = phone.replace(/\D/g, '');
    // Site only serves India today; strip a leading country code if present.
    const local = digits.length > 10 ? digits.slice(-10) : digits;
    return { phoneCode: '+91', phone: local };
  }

  private splitStreet(address: string): { street1: string; street2: string } {
    const commaIndex = address.indexOf(',');
    if (commaIndex === -1) {
      return { street1: address.trim(), street2: address.trim() };
    }
    return {
      street1: address.slice(0, commaIndex).trim(),
      street2: address.slice(commaIndex + 1).trim() || address.slice(0, commaIndex).trim(),
    };
  }

  private async mapAddress(input: KloudShipAddressInput) {
    const stateCode = await this.resolveStateCode(input.state);
    const { street1, street2 } = this.splitStreet(input.address);
    const { phoneCode, phone } = this.splitPhone(input.phone);

    return {
      firstName: input.firstName,
      lastName: input.lastName || '',
      company: input.company || '',
      street1,
      street2,
      street3: '',
      city: input.city,
      stateCode,
      zip: input.zip,
      countryCode: 'IN',
      phone,
      phoneCode,
      email: input.email,
      latitude: 0,
      longitude: 0,
    };
  }

  private buildDefaultPackages(quantity: number) {
    const cfg = getKloudshipConfig().defaultPackage;
    const weight = Math.max(cfg.minWeightKg, cfg.unitWeightKg * Math.max(1, quantity));

    return [
      {
        length: cfg.length,
        width: cfg.width,
        height: cfg.height,
        dimensionUnit: cfg.dimensionUnit,
        weight,
        weightUnit: cfg.weightUnit,
      },
    ];
  }

  private buildItems(items: Array<{ name: string; quantity: number; price: number }>) {
    const cfg = getKloudshipConfig().defaultPackage;
    return items.map((item) => ({
      productName: item.name,
      name: item.name,
      weight: cfg.unitWeightKg,
      weightUnit: cfg.weightUnit,
      value: item.price,
      quantity: item.quantity,
    }));
  }

  /**
   * Quotes shipping rates for a destination address and cart, returning the
   * cheapest available rate. Throws if KloudShip has no serviceable rate.
   */
  async getCheapestRate(params: {
    addressTo: KloudShipAddressInput;
    items: Array<{ name: string; quantity: number; price: number }>;
  }) {
    const cfg = getKloudshipConfig();
    if (!cfg.pickupLocationId) {
      throw new Error('KloudShip pickup location is not configured yet (KLOUDSHIP_PICKUP_LOCATION_ID).');
    }

    const totalQuantity = params.items.reduce((sum, i) => sum + i.quantity, 0);

    const data = await this.request<{ rates: any[]; errors: any[]; warnings: any[] }>('/ShipmentRate', {
      method: 'POST',
      body: {
        locationId: cfg.pickupLocationId,
        addressTo: await this.mapAddress(params.addressTo),
        packages: this.buildDefaultPackages(totalQuantity),
        items: this.buildItems(params.items),
        specialServices: [],
        isTest: cfg.isTest,
      },
    });

    if (!data.rates || data.rates.length === 0) {
      const reason = data.errors?.[0]?.message || data.warnings?.[0]?.message || 'No carrier can service this address right now.';
      throw new Error(`Unable to calculate shipping: ${reason}`);
    }

    // KloudShip tags its own pick via categories: ["Cheapest"] — trust that
    // over a naive min-by-fee, since offline/manual carrier accounts (e.g.
    // "KloudShip Logistics") report a placeholder totalFee of 0.
    const tagged = data.rates.find((rate) => rate.categories?.includes('Cheapest'));
    if (tagged) return tagged;

    const priced = data.rates.filter((rate) => rate.carrierMode === 'Online' && rate.totalFee > 0);
    const pool = priced.length > 0 ? priced : data.rates;

    return pool.reduce((cheapest, rate) => (rate.totalFee < cheapest.totalFee ? rate : cheapest));
  }

  /**
   * Creates the actual shipment (label + tracking number) after payment succeeds.
   */
  async createShipment(params: {
    addressShipTo: KloudShipAddressInput;
    items: Array<{ name: string; quantity: number; price: number }>;
    carrierAccountId: string;
    service: string;
    orderCode: string;
  }) {
    const cfg = getKloudshipConfig();
    const totalQuantity = params.items.reduce((sum, i) => sum + i.quantity, 0);

    return this.request<any>('/Shipment', {
      method: 'POST',
      headers: { transactionId: crypto.randomUUID() },
      body: {
        locationId: cfg.pickupLocationId,
        addressShipTo: await this.mapAddress(params.addressShipTo),
        packages: this.buildDefaultPackages(totalQuantity),
        items: this.buildItems(params.items),
        label: {
          labelSize: '4x6',
          labelOrientation: 'Portrait',
          customText1: params.orderCode,
        },
        specialServices: [],
        carrierAccountId: params.carrierAccountId,
        service: params.service,
        isTest: cfg.isTest,
      },
    });
  }

  async getTracking(trackingNumber: string) {
    return this.request<any>(
      `/Tracking/${encodeURIComponent(trackingNumber)}?trackingIdType=TrackingNumber&getLatestTracking=true`
    );
  }

  async cancelShipment(shipmentId: string, reason?: string) {
    return this.request<any>(`/Shipment/${encodeURIComponent(shipmentId)}/Refund`, {
      method: 'PUT',
      headers: { transactionId: crypto.randomUUID() },
      body: { CancelationReason: reason || 'Cancelled by store' },
    });
  }
}

export default new KloudShipService();
