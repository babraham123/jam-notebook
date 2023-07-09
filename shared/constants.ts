// Used by both widget and iframe modules

import { Code } from "./types";
import manifest from "../manifest.json";

export const PLUGIN_ID = manifest.id;

export const DEFAULT_CODE: Code = {
  language: "javascript",
  code: `// title: hello_world

// imports

// Point an arrow from another code block to the line below.
const input;

console.log('hello, world');

// Point an arrow from the line below.
const output = 'hello ' + input;
`,
};

export const DEFAULT_TITLE = "place on top of a code block";
