import postcss from "postcss";
import postCssModules from "postcss-modules";

import revHash from "rev-hash";
import { findUp } from "find-up";
import fs from "fs-extra";

import { join, resolve, dirname } from "path";

const FAKE_EXT = ".css-modules";

/**
 * Ported from ESBuild to Vite:
 * https://github.com/yuanqing/create-figma-plugin/blob/main/packages/build/src/utilities/build-bundles-async/esbuild-css-modules-plugin.ts
 */
export function cssModulesPlugin() {
  return {
    name: "css-modules",
    enforce: "pre",
    async resolveId(id, importer) {
      if (
        !/\.css$/.test(id) ||
        (importer || "").indexOf("@create-figma-plugin") === -1
      ) {
        return;
      }

      const { path, isGlobalCss } = parseCssFilePath(id);
      const cssFilePath = await createCssFilePathAsync(path, dirname(importer));
      if (
        cssFilePath === null ||
        (await fs.pathExists(cssFilePath)) === false
      ) {
        throw new Error(`CSS file not found: ${id}`);
      }

      if (isGlobalCss) {
        return `!${cssFilePath}${FAKE_EXT}`;
      }
      return `${cssFilePath}${FAKE_EXT}`;
    },
    async load(id) {
      if (!id.endsWith(FAKE_EXT)) {
        return;
      }

      const { path: cssFilePath, isGlobalCss } = parseCssFilePath(
        id.substring(0, id.length - FAKE_EXT.length)
      );
      const js = isGlobalCss
        ? await createGlobalCssJavaScriptAsync(cssFilePath)
        : await createCssModulesJavaScriptAsync(cssFilePath);

      return js;
    },
  };
}

function parseCssFilePath(path) {
  if (path[0] === "!") {
    return {
      isGlobalCss: true,
      path: path.slice(1),
    };
  }
  return {
    isGlobalCss: false,
    path,
  };
}

async function createCssFilePathAsync(path, resolveDir) {
  if (path[0] === "/") {
    return path;
  }
  if (path[0] === ".") {
    return resolve(resolveDir, path);
  }
  const result = await findUp(join("node_modules", path));
  if (typeof result === "undefined") {
    return null;
  }
  return result;
}
const backQuoteRegex = /`/g;
async function createGlobalCssJavaScriptAsync(cssFilePath, minify) {
  let css = await fs.readFile(cssFilePath, "utf8");

  const elementId = revHash(cssFilePath);
  const isBaseCss =
    cssFilePath.indexOf("@create-figma-plugin/ui/lib/css/base.css") !== -1;
  return `
    if (document.getElementById('${elementId}') === null) {
      const element = document.createElement('style');
      element.id = '${elementId}';
      element.textContent = \`${css.replace(backQuoteRegex, "\\`")}\`;
      document.head.${isBaseCss === true ? "prepend" : "append"}(element);
    }
    export default {};
  `;
}
async function createCssModulesJavaScriptAsync(cssFilePath, minify) {
  let css = await fs.readFile(cssFilePath, "utf8");
  let classNamesJson = null;
  const plugins = [];
  plugins.push(
    postCssModules({
      getJSON: function (_, json) {
        if (classNamesJson !== null) {
          throw new Error("`getJSON` callback called more than once");
        }
        classNamesJson = JSON.stringify(json);
      },
    })
  );
  const result = await postcss(plugins).process(css, {
    from: cssFilePath,
    map:
      minify === true
        ? false
        : {
            inline: true,
          },
  });
  css = result.css;
  if (classNamesJson === null) {
    throw new Error("`getJSON` callback was not called");
  }
  const elementId = revHash(cssFilePath);
  return `
    if (document.getElementById('${elementId}') === null) {
      const element = document.createElement('style');
      element.id = '${elementId}';
      element.textContent = \`${css.replace(backQuoteRegex, "\\`")}\`;
      document.head.append(element);
    }
    export default ${classNamesJson};
  `;
}
