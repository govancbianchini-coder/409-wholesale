// Finds the Postgres and Blob credentials however Vercel named them
// (integration prefixes vary: DATABASE_URL, DATABASE_POSTGRES_URL, STORAGE_URL, …).

export function databaseUrl() {
  const env = process.env;
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.POSTGRES_URL) return env.POSTGRES_URL;
  const pg = Object.entries(env).filter(([, v]) => typeof v === "string" && /^postgres(ql)?:\/\//.test(v));
  const score = ([k]) => (/UNPOOLED|NON_POOLING|NO_SSL|PRISMA/.test(k) ? 1 : 0) + (/_URL$/.test(k) ? 0 : 2);
  pg.sort((a, b) => score(a) - score(b));
  return pg[0]?.[1] || null;
}

export function blobToken() {
  const env = process.env;
  if (env.BLOB_READ_WRITE_TOKEN) return env.BLOB_READ_WRITE_TOKEN;
  const hit = Object.entries(env).find(([k, v]) => /READ_WRITE_TOKEN$/.test(k) || (typeof v === "string" && v.startsWith("vercel_blob_rw_")));
  return hit?.[1] || null;
}
