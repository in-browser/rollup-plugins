import pathe from 'pathe';

import { transform } from 'sucrase';
import { createFilter } from '@in-browser/rollup-pluginutils';

export default function sucrase(opts = {}) {
  const { fs, cwd } = opts;
  const filter = createFilter(opts.include, opts.exclude);

  return {
    name: 'sucrase',

    // eslint-disable-next-line consistent-return
    resolveId(importee, importer) {
      if (!fs) {
        return;
      }

      if (importer && /^[./]/.test(importee)) {
        const finalCwd = typeof process === 'undefined' ? cwd ?? '/' : process.cwd();
        const resolved = pathe.resolve(importer ? pathe.dirname(importer) : finalCwd, importee);
        // resolve in the same order that TypeScript resolves modules
        const resolvedFilenames = [
          `${resolved}.ts`,
          `${resolved}.tsx`,
          `${resolved}/index.ts`,
          `${resolved}/index.tsx`
        ];
        if (resolved.endsWith('.js')) {
          resolvedFilenames.splice(
            2,
            0,
            `${resolved.slice(0, -3)}.ts`,
            `${resolved.slice(0, -3)}.tsx`
          );
        }
        const resolvedFilename = resolvedFilenames.find((filename) => fs.existsSync(filename));

        if (resolvedFilename) {
          // eslint-disable-next-line consistent-return
          return resolvedFilename;
        }
      }
    },

    transform(code, id) {
      if (!filter(id)) return null;

      const result = transform(code, {
        transforms: opts.transforms,
        jsxPragma: opts.jsxPragma,
        jsxFragmentPragma: opts.jsxFragmentPragma,
        enableLegacyTypeScriptModuleInterop: opts.enableLegacyTypeScriptModuleInterop,
        enableLegacyBabel5ModuleInterop: opts.enableLegacyBabel5ModuleInterop,
        production: opts.production,
        disableESTransforms: opts.disableESTransforms,
        filePath: id,
        sourceMapOptions: {
          compiledFilename: id
        }
      });
      return {
        code: result.code,
        map: result.sourceMap
      };
    }
  };
}
