import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { relative, resolve } from 'node:path';
import { defineConfig } from 'tsup';

const require = createRequire(import.meta.url);

export default defineConfig({
  entry: ['src/index.ts', 'src/core.ts', 'src/media.ts', 'src/player.ts', 'src/chapters.ts', 'src/transcript-element.ts', 'src/annotations.ts', 'src/captions.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  // RAMP's stylesheet is bundled as text; RAMP itself stays a dependency.
  noExternal: [/\.css\?inline$/],
  esbuildPlugins: [{
    // `?inline` gives a stylesheet as text, as Vite does, for use inside shadow roots.
    name: 'inline-css',
    setup(build) {
      build.onResolve({ filter: /\.css\?inline$/ }, (args) => ({
        // Kept off `.css`, so tsup's own stylesheet handling leaves it alone.
        // Relative, so the bundle's source comments don't carry the build machine's paths.
        path: `${relative(process.cwd(), require.resolve(args.path.replace(/\?inline$/, ''), { paths: [args.resolveDir] }))}?inline`,
        namespace: 'inline-css',
      }));
      build.onLoad({ filter: /.*/, namespace: 'inline-css' }, async (args) => ({
        contents: await readFile(resolve(args.path.replace(/\?inline$/, '')), 'utf8'),
        loader: 'text',
      }));
    },
  }],
});
