import { Endpoint } from "../shared/types";
import { printErr } from "./utils";

// import { loadPyodide } from 'https://pyodide-cdn2.iodide.io/v0.20.0/full/pyodide.mjs';

// Pyodide
// Or https://openerp-web-v7.readthedocs.io/en/stable/

export async function runPYScript(
  code: string,
  inputs: Endpoint[],
  outputs: Endpoint[],
  std: any
): Promise<void> {
  // TODO: Will also need custom bundling to preload cython dependent libraries (numpy, etc) and use
  // micropip to install pure python libraries.

  try {
    // const pyodide = await loadPyodide({ indexURL: 'https://pyodide-cdn2.iodide.io/v0.20.0/full/' });
    // return await pyodide.runPythonAsync(code);
  } catch (err) {
    // Rethrow, just wrap the error with relevant information.
    // err.message = `Error in python code: ${err.message}`;
    throw err;
  }
}

export function formatPYScript(code: string): string {
  printErr("TODO: Implement");
  return code;

  // TODO: use https://github.com/psf/black
}
