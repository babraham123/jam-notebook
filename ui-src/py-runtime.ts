// @ts-ignore
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.mjs";

import { Code, Endpoint } from "../shared/types";
import { getOutput, extractVariable } from "./utils";

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

export async function runPYScript(
  code: string,
  inputs: Endpoint[],
  libraries: Code[],
  outputs: Endpoint[],
  std: any
): Promise<void> {
  const figma = Object.freeze({
    notebook: Object.freeze(std),
  });
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
      variable.value = getOutput(endpoint.sourceId, endpoint.lineNum);
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
  await loadImports(script, pyodide);

  console.log(await pyodide.runPythonAsync(code));

  for (const endpoint of outputs) {
    const variable = extractVariable(codeLines[endpoint.lineNum - 1], "python");
    // Store final result
    const val = pyodide.globals.get(variable.name).toJs();
    figma.notebook.storeResult(endpoint.sourceId, endpoint.lineNum, val);
  }
}

export async function formatPYScript(code: string): Promise<string> {
  const wrappedCode = `
import micropip
micropip.install('black')
import black
black.format_file_contents(code, False, black.Mode())
  `;
  const pyodide = await loadPyodide();
  pyodide.globals.set("code", code);
  return await pyodide.runPythonAsync(wrappedCode);
}
