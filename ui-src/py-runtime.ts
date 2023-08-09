import "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.asm.js";
// @ts-ignore
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.mjs";

import { JAM_DEBUG } from "../shared/constants";
import { Code, Endpoint } from "../shared/types";
import { getOutput, extractVariable, print } from "./utils";

const IMPORT_REGEX = /^\s*import\s+(?<name>[_a-zA-Z0-9]+)/;
const FROM_REGEX = /^\s*from\s+(?<name>[_a-zA-Z0-9]+)/;

async function loadImports(code: string, pyodide: any): Promise<void> {
  const codeLines = code.split("\n");
  const packages = new Set<string>();
  for (const line of codeLines) {
    let found = code.match(IMPORT_REGEX);
    if (found && found.groups) {
      packages.add(found.groups.name);
      continue;
    }

    found = code.match(FROM_REGEX);
    if (found && found.groups) {
      packages.add(found.groups.name);
      continue;
    }
  }

  if (packages.size > 0) {
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install([...packages]);
  }
}

// Test pyodide here: https://pyodide.org/en/stable/console.html
export async function runPYScript(
  code: string,
  inputs: Endpoint[],
  libraries: Code[],
  outputs: Endpoint[],
  std: any
): Promise<void> {
  const figma = {
    notebook: std,
  };
  const pyodide = await loadPyodide();
  pyodide.registerJsModule("figma", figma);

  const codeLines = code.split("\n");
  for (const endpoint of inputs) {
    if (!endpoint.destLineNum) {
      throw new Error(`No destination for input: ${JSON.stringify(endpoint)}`);
    }
    const variable = extractVariable(
      codeLines[endpoint.destLineNum - 1],
      "python"
    );
    if (endpoint.node) {
      variable.value = endpoint.node;
    } else {
      variable.value = getOutput(endpoint.sourceId, endpoint.srcLineNum);
    }
    codeLines[
      endpoint.destLineNum - 1
    ] = `${variable.name} = ${variable.altName};`;
    pyodide.globals.set(variable.altName, variable.value);
  }

  let script = codeLines.join("\n");
  for (const libScript of libraries) {
    if (libScript.language === "python") {
      script = `${libScript.code}\n\n${script}`;
    } else {
      // TODO: add support for other languages in PY runtime
      throw new Error(
        `Trying to run ${libScript.language} code in PY runtime as a library`
      );
    }
  }
  if (JAM_DEBUG) {
    print(pyodide.globals.toString());
    print(script);
  }

  await loadImports(script, pyodide);
  await pyodide.runPythonAsync(script);

  for (const endpoint of outputs) {
    const variable = extractVariable(
      codeLines[endpoint.srcLineNum - 1],
      "python"
    );
    // Store final result
    // TODO: consider using altName in case var is not in global scope
    let val = pyodide.globals.get(variable.name);
    if (val?.toJs) {
      val = val.toJs();
    }
    figma.notebook.storeResult(endpoint.sourceId, endpoint.srcLineNum, val);
  }
}

const FORMAT_CODE = `
import micropip
await micropip.install('black')
import black
result = black.format_file_contents(code, fast=True, mode=black.Mode())
`;

export async function formatPYScript(code: string): Promise<string> {
  const pyodide = await loadPyodide();
  pyodide.globals.set("code", code);

  await pyodide.loadPackage("micropip");
  await pyodide.runPythonAsync(FORMAT_CODE);
  // Should already be a string and not need toJs()
  return `${pyodide.globals.get("result")}`;
}
