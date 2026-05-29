import { Redis } from 'ioredis';

let redisClient: Redis | null = null;
let isRedisConnected = false;

// Robust In-Memory Fallback Cache
interface CacheItem {
  value: string;
  expiresAt: number;
}
const memoryCache = new Map<string, CacheItem>();

// Clean up expired items periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of memoryCache.entries()) {
    if (item.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
}, 30000); // every 30 seconds

try {
  // Attempt connection — if Redis isn't running locally, fail silently and use in-memory cache
  const redisUrl = process.env.REDIS_URL;
  const redisOptions = {
    maxRetriesPerRequest: 0,
    connectTimeout: 2000,
    // Prevent ioredis from spamming retry attempts — fall back to memory instead
    retryStrategy: () => null,
    enableOfflineQueue: false,
  };

  if (redisUrl) {
    redisClient = new Redis(redisUrl, redisOptions);
  } else {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      ...redisOptions,
    });
  }

  redisClient.on('connect', () => {
    isRedisConnected = true;
    console.log('✅ Connected to Redis successfully for OTP cache.');
  });

  // Log only once — retryStrategy: null prevents repeated error spam
  redisClient.on('error', (err: any) => {
    if (isRedisConnected) {
      console.warn('⚠️ Redis disconnected. Falling back to secure in-memory cache.');
    }
    isRedisConnected = false;
  });
} catch (e) {
  isRedisConnected = false;
  console.warn('⚠️ Redis initialization failed. Using in-memory cache fallback.');
}

/**
 * Store a key-value pair with an expiration time (TTL) in seconds
 */
export const setCache = async (key: string, value: string, ttlSeconds: number): Promise<void> => {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.setex(key, ttlSeconds, value);
      return;
    } catch (err) {
      console.error('Failed to set in Redis, falling back to memory:', err);
    }
  }

  // Fallback to in-memory
  const expiresAt = Date.now() + ttlSeconds * 1000;
  memoryCache.set(key, { value, expiresAt });
};

/**
 * Retrieve a value by key
 */
export const getCache = async (key: string): Promise<string | null> => {
  if (isRedisConnected && redisClient) {
    try {
      return await redisClient.get(key);
    } catch (err) {
      console.error('Failed to get from Redis, falling back to memory:', err);
    }
  }

  // Fallback to in-memory
  const item = memoryCache.get(key);
  if (!item) return null;

  if (item.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }

  return item.value;
};

/**
 * Delete a key
 */
export const delCache = async (key: string): Promise<void> => {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.del(key);
      return;
    } catch (err) {
      console.error('Failed to delete from Redis, falling back to memory:', err);
    }
  }

  // Fallback to in-memory
  memoryCache.delete(key);
};
