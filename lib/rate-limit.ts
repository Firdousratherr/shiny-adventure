import { Redis } from '@upstash/redis';

let redis: Redis | null = null;
function getRedis() {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

export async function rateLimit(key: string, limit = 10, windowSeconds = 600) {
  const client = getRedis();
  if (!client) return { limited: false, configured: false, remaining: limit };

  const bucket = `rl:${key}`;
  try {
    const count = await client.incr(bucket);
    if (count === 1) await client.expire(bucket, windowSeconds);
    return {
      limited: count > limit,
      configured: true,
      remaining: Math.max(0, limit - count),
    };
  } catch (error) {
    console.error('rate limit backend failed', error);
    return { limited: false, configured: false, remaining: limit };
  }
}
