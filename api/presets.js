import { Redis } from "@upstash/redis";

function createRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function presetKey(name) {
  return `college:${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function normalizePreset(body) {
  if (!body || typeof body !== "object") return null;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const holidays = Array.isArray(body.holidays)
    ? body.holidays.filter(date => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date))
    : [];

  if (!name || !holidays.length) return null;

  return {
    name,
    description,
    holidays: [...new Set(holidays)].sort(),
    updatedAt: typeof body.updatedAt === "string" && body.updatedAt ? body.updatedAt : new Date().toISOString().slice(0, 10),
  };
}

function send(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  const redis = createRedisClient();
  if (!redis) {
    return send(res, 503, {
      error: "Backend storage is not configured.",
      hint: "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your deployment.",
    });
  }

  try {
    if (req.method === "GET") {
      const prefix = typeof req.query.prefix === "string" ? req.query.prefix : "college:";
      const keys = await redis.keys(`${prefix}*`);
      const presets = [];

      for (const key of keys) {
        const preset = await redis.get(key);
        if (preset) presets.push({ key, ...preset });
      }

      presets.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      return send(res, 200, { presets });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const preset = normalizePreset(body);
      if (!preset) {
        return send(res, 400, { error: "Invalid preset payload." });
      }

      const key = presetKey(preset.name);
      await redis.set(key, preset);
      return send(res, 200, { key, preset });
    }

    return send(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return send(res, 500, { error: "Preset catalog request failed.", details: error.message });
  }
}