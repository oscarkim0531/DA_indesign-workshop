import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(projectDir, "dist", "server");

const sourceAssets = [
  ["/", "index.html", "text/html; charset=utf-8"],
  ["/index.html", "index.html", "text/html; charset=utf-8"],
  ["/style.css", "style.css", "text/css; charset=utf-8"],
  ["/script.js", "script.js", "text/javascript; charset=utf-8"],
];

const assets = [];
for (const [route, filename, contentType] of sourceAssets) {
  assets.push([
    route,
    [await fs.readFile(path.join(projectDir, filename), "utf8"), contentType],
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

    const [body, contentType] = asset;
    return new Response(request.method === "HEAD" ? null : body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": url.pathname === "/" || url.pathname === "/index.html"
          ? "public, max-age=0, must-revalidate"
          : "public, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  },
};
`;

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "index.js"), workerSource, "utf8");
console.log("Built dist/server/index.js");
