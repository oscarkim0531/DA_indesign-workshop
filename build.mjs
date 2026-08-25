import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(projectDir, "dist", "server");
const hostingOutputDir = path.join(projectDir, "dist", ".openai");

const sourceAssets = [
  ["/", path.join(projectDir, "index.html"), "text/html; charset=utf-8", "utf8"],
  ["/index.html", path.join(projectDir, "index.html"), "text/html; charset=utf-8", "utf8"],
  ["/style.css", path.join(projectDir, "style.css"), "text/css; charset=utf-8", "utf8"],
  ["/script.js", path.join(projectDir, "script.js"), "text/javascript; charset=utf-8", "utf8"],
  ["/og.png", path.join(projectDir, "public", "og.png"), "image/png", "base64"],
  ["/favicon.png", path.join(projectDir, "public", "favicon.png"), "image/png", "base64"],
];

const assets = [];
for (const [route, filename, contentType, encoding] of sourceAssets) {
  assets.push([
    route,
    [await fs.readFile(filename, encoding), contentType, encoding],
  ]);
}

const workerSource = `const assets = new Map(${JSON.stringify(assets)});
const downloads = new Map([
  ["/downloads/A-School-Year-in-the-Inbox.pdf", {
    key: "final/A-School-Year-in-the-Inbox.pdf",
    filename: "A School Year in the Inbox.pdf",
    contentType: "application/pdf",
  }],
  ["/downloads/Final_Package.zip", {
    key: "final/Final_Package.zip",
    filename: "Final_Package.zip",
    contentType: "application/zip",
  }],
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const download = downloads.get(url.pathname);

    if (download) {
      if (!env?.FILES) {
        return new Response("Download storage unavailable", { status: 503 });
      }
      const object = await env.FILES.get(download.key);
      if (!object) {
        return new Response("File not ready", { status: 404 });
      }
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("content-type", download.contentType);
      headers.set("content-length", String(object.size));
      headers.set("content-disposition", "attachment; filename*=UTF-8''" + encodeURIComponent(download.filename));
      headers.set("cache-control", "public, max-age=3600");
      headers.set("x-content-type-options", "nosniff");
      return new Response(request.method === "HEAD" ? null : object.body, {
        status: 200,
        headers,
      });
    }

    if (url.pathname === "/_site-upload" && request.method === "PUT") {
      if (!env?.UPLOAD_SECRET || request.headers.get("authorization") !== "Bearer " + env.UPLOAD_SECRET) {
        return new Response("Not found", { status: 404 });
      }
      const file = url.searchParams.get("file");
      const upload = file === "pdf"
        ? { key: "final/A-School-Year-in-the-Inbox.pdf", contentType: "application/pdf" }
        : file === "zip"
          ? { key: "final/Final_Package.zip", contentType: "application/zip" }
          : null;
      if (!upload || !request.body) {
        return new Response("Invalid upload", { status: 400 });
      }
      await env.FILES.put(upload.key, request.body, {
        httpMetadata: { contentType: upload.contentType },
      });
      return Response.json({ ok: true, key: upload.key }, { status: 201 });
    }

    const asset = assets.get(url.pathname);

    if (!asset) {
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const [sourceBody, contentType, encoding] = asset;
    const body = encoding === "base64"
      ? Uint8Array.from(atob(sourceBody), (character) => character.charCodeAt(0))
      : contentType.startsWith("text/html")
        ? sourceBody.replaceAll("__SITE_ORIGIN__", url.origin)
        : sourceBody;
    const headers = {
      "content-type": contentType,
      "cache-control": "public, max-age=0, must-revalidate",
      "x-content-type-options": "nosniff",
    };
    return new Response(request.method === "HEAD" ? null : body, {
      status: 200,
      headers,
    });
  },
};
`;

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(hostingOutputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "index.js"), workerSource, "utf8");
await fs.copyFile(
  path.join(projectDir, ".openai", "hosting.json"),
  path.join(hostingOutputDir, "hosting.json"),
);
console.log("Built dist/server/index.js");
