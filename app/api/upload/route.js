import fs from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { currentUser, currentDealer, token } from "@/lib/util";
import { blobToken } from "@/lib/env";

export const runtime = "nodejs";

const OK = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

export async function POST(req) {
  const user = await currentUser();
  const dealer = await currentDealer();
  if (user?.role !== "admin" && !dealer) return Response.json({ error: "Not allowed" }, { status: 401 });
  const fd = await req.formData();
  const file = fd.get("file");
  if (!file || typeof file === "string") return Response.json({ error: "No file" }, { status: 400 });
  const ext = OK[file.type];
  if (!ext) return Response.json({ error: "Use JPG, PNG, WEBP or PDF" }, { status: 400 });
  const name = `wholesale/${new Date().toISOString().slice(0, 10)}/${token(9)}.${ext}`;

  const bt = blobToken();
  if (bt) {
    const blob = await put(name, file, { access: "public", contentType: file.type, token: bt });
    return Response.json({ url: blob.url });
  }
  if (process.env.VERCEL) return Response.json({ error: "Photo storage isn't connected. In Vercel, connect the Blob store with 'Add a read-write token' ticked, then redeploy." }, { status: 500 });
  // Local development fallback: write into /public/uploads
  const dest = path.join(process.cwd(), "public", "uploads", name.replace(/\//g, "_"));
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, Buffer.from(await file.arrayBuffer()));
  return Response.json({ url: `/uploads/${path.basename(dest)}` });
}
