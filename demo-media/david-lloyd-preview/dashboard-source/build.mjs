const {build} = await import("esbuild").catch(() => import("../tools/node_modules/esbuild/lib/main.js"));
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const dir=path.dirname(fileURLToPath(import.meta.url));
await build({entryPoints:[path.join(dir,"main.tsx")],bundle:true,outdir:path.join(dir,"built"),jsx:"automatic",nodePaths:[process.env.PETEY_NODE_MODULES || path.join(dir,"../node_modules"),path.join(dir,"node_modules")],loader:{".woff2":"file",".woff":"file",".svg":"file"},define:{"process.env.NODE_ENV":'"production"'}});
for(const name of ["overview","trainers","emma","emma-bottom"])await fs.writeFile(path.join(dir,"built",name+".html"),'<html><head><meta charset="utf-8"><link rel="stylesheet" href="main.css"></head><body><div id="root"></div><script src="main.js"></script></body></html>');
console.log("Built capture routes: overview.html, trainers.html, emma.html");
