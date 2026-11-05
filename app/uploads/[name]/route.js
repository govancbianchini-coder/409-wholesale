import fs from "node:fs/promises";
import path from "node:path";

// Serves local-dev uploads (production uses Vercel Blob URLs instead).
const TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

export async function GET(_req, { params }) {
  const { name } = await params;
  if (!/^[\w.-]+$/.test(name)) return new Response("Not found", { status: 404 });
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "public", "uploads", name));
    return new Response(buf, { headers: { "Content-Type": TYPES[name.split(".").pop()] || "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
