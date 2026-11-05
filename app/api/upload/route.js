import fs from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { currentUser, token } from "@/lib/util";

export const runtime = "nodejs";

const OK = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

export async function POST(req) {
  const user = await currentUser();
  if (user?.role !== "admin") return Response.json({ error: "Not allowed" }, { status: 401 });
  const fd = await req.formData();
  const file = fd.get("file");
  if (!file || typeof file === "string") return Response.json({ error: "No file" }, { status: 400 });
  const ext = OK[file.type];
  if (!ext) return Response.json({ error: "Use JPG, PNG, WEBP or PDF" }, { status: 400 });
  const name = `wholesale/${new Date().toISOString().slice(0, 10)}/${token(9)}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(name, file, { access: "public", contentType: file.type });
    return Response.json({ url: blob.url });
  }
  if (process.env.VERCEL) return Response.json({ error: "Storage isn't connected. Add Vercel Blob to the project." }, { status: 500 });
  // Local development fallback: write into /public/uploads
  const dest = path.join(process.cwd(), "public", "uploads", name.replace(/\//g, "_"));
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, Buffer.from(await file.arrayBuffer()));
  return Response.json({ url: `/uploads/${path.basename(dest)}` });
}
