// Used by both widget and iframe modules

import { Obj, AppState, Code, CommandType, Result } from './types';
// import manifest from '../manifest.json';

export const PLUGIN_ID = '*'; // manifest.id;
// TODO: swap for more security

// import.meta.env.VITE_TARGET
export const SUPPORTED_MSGS: Record<string, CommandType[]> = {
  editor: ['INITIATE', 'RUN', 'FORMAT', 'TEST', 'QUERY', 'SAVE', 'CLOSE'],
  run: ['INITIATE', 'RUN', 'TEST'],
  widget: ['INITIATE', 'RUN', 'QUERY', 'SAVE', 'CLOSE'],
};

export const EMPTY_OBJ: Obj = {
  type: 'UNDEFINED',
  data: '',
};

export const DEFAULT_APP_STATE: AppState = {
  title: 'Example Script',
  codeWindow: {
    width: 500,
    height: 500,
  },
  previewWindow: {
    width: 1000,
    height: 600,
  },
};

export const DEFAULT_CODE: Code = {
  language: 'javascript',
  code: `// imports

// helper functions

async function run(inputs) {
  // code

  return {
    type: 'TEXT', // 'TEXT' | 'JSON' | 'CSV' | 'SVG' | 'BINARY' | 'ERROR' | 'UNDEFINED'
    data: 'hello, world'
  };
}`,
  testCode: `// imports

// helper functions

async function test() {
  // setup and mocks

  const output = await run(fakeInputs);

  // asserts
}`,
};

export const DEFAULT_RESULT: Result = {
  output: EMPTY_OBJ,
  inputsHash: '',
  codeHash: 'd1daa1a319842d3d053a4f5abb5055d0',
};
