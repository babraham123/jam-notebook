import { Obj } from '../shared/types';

export async function runWasmScript(
  code: string,
  inputs: Obj[],
  ): Promise<Obj> {  
  // Only pass in an array of strings
  const stringInputs = inputs.map((obj: Obj): string => {
    return `${obj.data}`;
  });
  // Code: base64 string -> ArrayBuffer
  const codeBuffer = new Uint8Array(Buffer.from(code, 'base64')).buffer;

  try {
    const wasmModule = await WebAssembly.instantiate(codeBuffer);
    const { main } = wasmModule.instance.exports;

    const result = main(stringInputs);
    return { type: 'TEXT', data: result };
  } catch (err) {
    // Rethrow, just wrap the error with relevant information.
    err.message = `Error in WASM code: ${err.message}`;
    throw err;
  }
  }
