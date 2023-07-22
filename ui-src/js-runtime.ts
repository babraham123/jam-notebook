import parse from "parse-es-import";
import { parse as parseCSV } from "csv-parse/sync";
import { js as jsBeautify } from "js-beautify";

import { JS_VAR_REGEX } from "../shared/constants";
import { Endpoint, Obj } from "../shared/types";
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

function formatAsCode(obj: Obj): string {
  switch (obj.type) {
    case "TEXT": // string
      return `'${obj.data}'`;
    case "JSON": // object
      return obj.data;
    case "CSV": // array of arrays
      const records = parseCSV(obj.data, { skip_empty_lines: true });
      return JSON.stringify(records);
    case "SVG": // XMLDocument of a DOM Element
      return `new DOMParser().parseFromString('${obj.data}', 'image/svg+xml')`;
    case "BINARY": // Buffer
      return `Buffer.from('${obj.data}', 'base64')`;
    case "ERROR":
      throw new Error(`Trying to insert error into code: ${obj.data}`);
    case "UNDEFINED":
      return "undefined";
    default:
      return "";
  }
}

function parseInput(obj: Obj): any {
  switch (obj.type) {
    case "TEXT":
      return obj.data;
    case "JSON":
      return JSON.parse(obj.data);
    case "CSV": // array of arrays
      return parseCSV(obj.data, { skip_empty_lines: true });
    case "SVG": // XMLDocument of a DOM SVGSVGElement
      return new DOMParser().parseFromString(obj.data, "image/svg+xml");
    case "BINARY": // Buffer
      return Buffer.from(obj.data, "base64");
    case "ERROR":
      return new Error(obj.data);
    case "UNDEFINED":
      return undefined;
    default:
      return "";
  }
}

// Insert Skypack imports into the user's code.
function replaceImports(code: string): string {
  const imports = parse(code).imports;
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
}

export function extractVariable(code: string): Variable {
  const found = code.match(JS_VAR_REGEX);
  if (!found || !found.groups) {
    throw new Error(`Could not extract variable name from code: ${code}`);
  }
  return {
    keyword: found.groups.keyword,
    name: found.groups.name,
  };
}

export async function runJSScript(
  code: string,
  inputs: Endpoint[],
  outputs: Endpoint[],
  std: any
): Promise<void> {
  const figma = Object.freeze({
    notebook: Object.freeze(std),
  });

  const codeLines = code.split("\n");
  for (const endpoint of inputs) {
    print(endpoint); // TODO: remove after iframe runner
    if (!endpoint.destLineNum) {
      throw new Error(`No destination for input: ${JSON.stringify(endpoint)}`);
    }
    const variable = extractVariable(codeLines[endpoint.destLineNum]);
    if (endpoint.node) {
      codeLines[endpoint.destLineNum] = `${variable.keyword} ${
        variable.name
      } = ${JSON.stringify(endpoint.node)};`;
      continue;
    }

    const input = getOutput(endpoint.sourceId, endpoint.lineNum);
    if (!input) {
      throw new Error(`Input not found: ${JSON.stringify(endpoint)}`);
    }
    // TODO: Use alias var (__name__) to pass in var by value
    const inputCode = formatAsCode(input);
    codeLines[
      endpoint.destLineNum
    ] = `${variable.keyword} ${variable.name} = ${inputCode};`;
  }

  for (const endpoint of outputs) {
    const variable = extractVariable(codeLines[endpoint.lineNum]);
    codeLines.push(`figma.notebook.storeAny('${endpoint.sourceId}', ${endpoint.lineNum}, ${variable.name});`);
  }

  const runFunc = replaceImports(codeLines.join("\n"));

  const script = `
    ${runFunc}
    return Promise.resolve();
`;
  print(script); // TODO: remove after validating iframe runner
  const func = new Function("figma", script);

  try {
    await func(figma, script);
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
