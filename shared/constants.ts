// Used by both widget and iframe modules

import { Code } from "./types";
import manifest from "../manifest.json";

export let DEBUG = true;

export const NAMESPACE = "jam_notebook";

export const PLUGIN_ID = "*"; // manifest.id; // TODO

export const IFRAME_URL =
  "https://babraham123.github.io/jam-notebook/index.html";
// Example test in browser:
// window.postMessage({'pluginMessage': {'type': 'RUN', 'code': {'language': 'javascript', 'code': 'console.log("hello")'}}})

export const INFO_URL = "https://github.com/babraham123/jam-notebook#readme";

export const NULL_ID = "0:1";

export const JS_VAR_REGEX =
  /^\s*(?<keyword>const|var|let)\s+(?<name>[$_a-zA-Z0-9]+)/;

export const PY_VAR_REGEX = /^\s*(?<name>[_a-zA-Z0-9]+)\s*=/;

export const FILE_ID_REGEX = /^\/file\/(?<fileId>[^/]+)\/(?<fileName>.+)$/;

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
