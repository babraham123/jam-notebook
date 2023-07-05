// Used by both widget and iframe modules

import { Code } from "./types";
import manifest from "../manifest.json";

export const PLUGIN_ID = manifest.id;

export const DEFAULT_CODE: Code = {
  language: "javascript",
  code: `// title: hello_world

// imports

figma.localStore({
  type: 'TEXT',
  data: 'hello, world'
});

console.log('hello, world');
`,
};

export const DEFAULT_TITLE = "place on top of a code block";
