import parseJS from "parse-es-import";
import { js as jsBeautify } from "js-beautify";

import { JAM_DEBUG } from "../shared/constants";
import { Code, Endpoint } from "../shared/types";
import { getOutput, Variable, extractVariable, print } from "./utils";

// Insert Skypack imports into the user's code.
function replaceImports(code: string): string {
  const imports = parseJS(code).imports;
  let offset = 0;
  let newCode = `${code}`;
  for (const importObj of imports) {
    const importCode = code.slice(importObj.startIndex, importObj.endIndex);
    const pkgName = importObj.moduleName;
    if (pkgName?.startsWith("https://")) {
      continue;
    }
    if (pkgName.includes("/") || !pkgName) {
      throw new Error(
        `Only valid package imports are allowed. Invalid code:\n${importCode}`
      );
    }
    var pkgIndex = importCode.lastIndexOf(pkgName);
    if (pkgIndex < 0) {
      throw new Error(
        `Import pkg name not found. Invalid code:\n${importCode}`
      );
    }

    // Insert new pkg name into import. Skypack imports enable the NPM module magic.
    const newPkg = `https://cdn.skypack.dev/${pkgName}`;
    const newImportCode =
      importCode.slice(0, pkgIndex) +
      newPkg +
      importCode.slice(pkgIndex + pkgName.length);
    // Insert new import code into larger code.
    newCode =
      newCode.slice(0, importObj.startIndex + offset) +
      newImportCode +
      newCode.slice(importObj.endIndex + offset);
    offset += newImportCode.length - importCode.length;
  }
  return newCode;
}

export async function runJSScript(
  code: string,
  inputs: Endpoint[],
  libraries: Code[],
  outputs: Endpoint[],
  std: any
): Promise<void> {
  const figma = Object.freeze({
    notebook: Object.freeze(std),
  });

  const codeLines = code.split("\n");
  const inputVars: Variable[] = [];
  for (const endpoint of inputs) {
    if (!endpoint.destLineNum) {
      throw new Error(`No destination for input: ${JSON.stringify(endpoint)}`);
    }
    const variable = extractVariable(
      codeLines[endpoint.destLineNum - 1],
      "javascript"
    );
    if (endpoint.node) {
      variable.value = endpoint.node;
    } else {
      variable.value = getOutput(endpoint.sourceId, endpoint.srcLineNum);
    }
    inputVars.push(variable);

    codeLines[
      endpoint.destLineNum - 1
    ] = `${variable.keyword} ${variable.name} = ${variable.altName};`;
  }

  for (const endpoint of outputs) {
    const variable = extractVariable(
      codeLines[endpoint.srcLineNum - 1],
      "javascript"
    );
    // Store final result
    codeLines.push(
      `figma.notebook.storeResult('${endpoint.sourceId}', ${endpoint.srcLineNum}, ${variable.name});`
    );
  }

  let script = codeLines.join("\n");
  for (const libScript of libraries) {
    if (libScript.language === "javascript") {
      script = `${libScript.code}\n\n${script}`;
    } else {
      // TODO: add support for other languages in JS runtime
      throw new Error(
        `Trying to run ${libScript.language} code in JS runtime as a library`
      );
    }
  }
  script = replaceImports(script);
  script = `${script}\nreturn Promise.resolve();\n`;

  const params = inputVars.map((v) => v.altName);
  const vals = inputVars.map((v) => v.value);
  const func = new Function("figma", ...params, script);
  if (JAM_DEBUG) {
    print(inputVars);
    print(script);
  }

  await func(figma, ...vals);
}

export function formatJSScript(code: string): string {
  return jsBeautify(code, {
    indent_size: 2,
    preserve_newlines: false,
  });
}
