import parseJS from "parse-es-import";
import { js as jsBeautify } from "js-beautify";

import { JS_VAR_REGEX } from "../shared/constants";
import { Code, Endpoint } from "../shared/types";
import { getOutput, print } from "./utils";

// This lets us access the execution environment from the error handler.
export class WrappedError extends Error {
  funcToString: string;

  constructor(err: Error, func: Function) {
    super(err.message);
    this.name = err.name;
    this.stack = err.stack;
    this.funcToString = func.toString();
  }
}

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

interface Variable {
  keyword: string;
  name: string;
  altName: string;
  value?: any;
}

export function extractVariable(code: string): Variable {
  const found = code.match(JS_VAR_REGEX);
  if (!found || !found.groups) {
    throw new Error(`Could not extract variable name from code: ${code}`);
  }
  return {
    keyword: found.groups.keyword,
    name: found.groups.name,
    altName: `__${found.groups.name}__`,
  };
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
    const variable = extractVariable(codeLines[endpoint.destLineNum - 1]);
    inputVars.push(variable);

    if (endpoint.node) {
      variable.value = endpoint.node;
    } else {
      variable.value = getOutput(endpoint.sourceId, endpoint.lineNum);
    }
    codeLines[
      endpoint.destLineNum - 1
    ] = `${variable.keyword} ${variable.name} = ${variable.altName};`;
  }

  for (const endpoint of outputs) {
    const variable = extractVariable(codeLines[endpoint.lineNum - 1]);
    // Store final result
    codeLines.push(
      `figma.notebook.storeResult('${endpoint.sourceId}', ${endpoint.lineNum}, ${variable.name});`
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
  print(inputVars); // TODO: remove after validating iframe runner
  print(script);

  const params = inputVars.map((v) => v.altName);
  const vals = inputVars.map((v) => v.value);
  const func = new Function("figma", ...params, script);

  try {
    await func(figma, ...vals);
  } catch (err) {
    // Rethrow, just wrap the error with relevant information.
    throw new WrappedError(err as Error, func);
  }
}

export function formatJSScript(code: string): string {
  return jsBeautify(code, {
    indent_size: 2,
    preserve_newlines: false,
  });
}
