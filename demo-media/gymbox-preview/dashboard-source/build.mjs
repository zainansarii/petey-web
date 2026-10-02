const { build } = await import('esbuild').catch(() => import('../tools/node_modules/esbuild/lib/main.js'));
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
await build({entryPoints:[path.join(dir,'main.tsx')],bundle:true,outdir:path.join(dir,'built'),jsx:'automatic',nodePaths:[process.env.PETEY_NODE_MODULES || path.join(dir,'../node_modules'),path.join(dir,'../tools/node_modules'),path.join(dir,'node_modules')],loader:{'.woff2':'file','.woff':'file','.svg':'file','.png':'file','.webp':'file'},define:{'process.env.NODE_ENV':'"production"'}});
const routes = { overview:1077, trainers:750, emma:1077, 'emma-bottom':600 };
for (const [name,height] of Object.entries(routes)) {
  await fs.writeFile(path.join(dir,'built',name+'.html'),'<html><head><meta charset="utf-8"><link rel="stylesheet" href="main.css"></head><body><div id="root"></div><script type="module" src="main.js"></script></body></html>');
  const shotDir = path.join(dir,'capture-'+name);
  await fs.mkdir(shotDir,{recursive:true});
  await fs.cp(path.join(dir,'built'),shotDir,{recursive:true});
  await fs.mkdir(path.join(shotDir,'trainers'),{recursive:true});
  for (const asset of await fs.readdir(path.join(dir,'../composition/assets'))) if (asset.startsWith('gb-demo-') && asset.endsWith('.webp')) await fs.copyFile(path.join(dir,'../composition/assets',asset),path.join(shotDir,'trainers',asset));
  await fs.copyFile(path.join(dir,'../composition/assets/gsap.min.js'),path.join(shotDir,'gsap.min.js'));
  await fs.writeFile(path.join(shotDir,'index.html'),`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><script src="gsap.min.js"></script><link rel="stylesheet" href="main.css"><style>#capture-root{width:100%;height:100%;overflow:hidden;background:white}</style></head><body><div id="capture-root" data-composition-id="gymbox-capture-${name}" data-width="1040" data-height="${height}" data-duration="1"><div id="root"></div></div><script>window.GYMBOX_CAPTURE=${JSON.stringify(name)};</script><script type="module" src="main.js"></script><script>window.__timelines=window.__timelines||{};window.__timelines['gymbox-capture-${name}']=gsap.timeline({paused:true});</script></body></html>`);
}
console.log('Built final Gymbox capture routes and Hyperframes static capture compositions.');
