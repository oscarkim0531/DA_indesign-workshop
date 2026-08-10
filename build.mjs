import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(projectDir, "dist", "server");

const sourceAssets = [
  ["/", path.join(projectDir, "index.html"), "text/html; charset=utf-8", "utf8"],
  ["/index.html", path.join(projectDir, "index.html"), "text/html; charset=utf-8", "utf8"],
  ["/style.css", path.join(projectDir, "style.css"), "text/css; charset=utf-8", "utf8"],
  ["/script.js", path.join(projectDir, "script.js"), "text/javascript; charset=utf-8", "utf8"],
  ["/og.png", path.join(projectDir, "public", "og.png"), "image/png", "base64"],
];

const assets = [];
for (const [route, filename, contentType, encoding] of sourceAssets) {
  assets.push([
    route,
    [await fs.readFile(filename, encoding), contentType, encoding],
  ]);
}

const workerSource = `const assets = new Map(${JSON.stringify(assets)});

export default {
  async fetch(request) {
    const url = new URL(request.url);
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
      "cache-control": url.pathname === "/" || url.pathname === "/index.html"
        ? "public, max-age=0, must-revalidate"
        : "private, max-age=3600",
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
await fs.writeFile(path.join(outputDir, "index.js"), workerSource, "utf8");
console.log("Built dist/server/index.js");
