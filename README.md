# Jam Notebook

Javascript code notebooks in Figjam.

Built upon the work done by previous widgets, mainly Michael Bullington's Code Notebooks and Michael Feldstein's Play button.

## Quick start

Open up the widget in a FigJam file, place it on top of a code block and try the following sample code:

```javascript
// Point an arrow from another code block to the line below.
const input;

console.log('hello, world');

// Point an arrow from the line below.
const output = 'hello ' + input;
```

Connector arrows are used to indicate the inputs and outputs of a given code block. Make sure to connect the arrow to the line where a variable is declared. Outputs can be connected to the "Jam Viewer" widget, other code blocks, or any component that supports text.

The following functions are provided via the `figma.notebook` library:
Javascript:

```javascript
function queryNodes(rootNode: { id: string } | string, selector?: string): Promise<any[]>
function svgToString(svg: Element): string
function stringToSVG(svgData: string): SVGSVGElement
```

You can also import any JS libraries present in the [Skypack CDN](https://www.skypack.dev/). Python libraries can be imported if they are pure Python wheels or built into Pyodide ([ref](https://micropip.pyodide.org/en/v0.2.2/project/api.html#micropip.install)).

Go to [examples](./examples) to get some inspiration!

## Code organization

| dir / path               | description                          |
| ------------------------ | ------------------------------------ |
| ui-src/                  | This is where the iframe code lives  |
| ui-src/index.html        | Main entry point for the iframe code |
| ui-src/tsconfig.json     | tsconfig for the iframe code         |
| widget-src/              | This is where the widget code lives  |
| widget-src/code.tsx      | Main entry point for the widget code |
| widget-src/tsconfig.json | tsconfig for the widget code         |
| dist/                    | Built output goes here               |

- The widget code just uses esbuild to bundle widget-src/code.tsx into one file.
- The iframe code uses a tool called [vite](https://vitejs.dev/) to bundle everything into a single html file

## Getting started

### One-time setup

1. Make a copy of this folder
2. Update manifest.json, package.json and package-lock.json where it says `Jam Notebook`
3. Install the required dependencies `npm ci`

### Importing your widget

1. "Import widget from manifest"
2. Build code `npm run build`
3. Choose your manifest

## Development

The quickest way to build your widget during development is by running:

```sh
npm run dev
```

This command starts the follow in watch mode:

1. typechecking for widget-src & ui-src
2. bundling for widget-src & ui-src
3. starts a vite dev server that serves ui-src/index.html at localhost:3000

## Other scripts

| script                   | description                                                            |
| ------------------------ | ---------------------------------------------------------------------- |
| npm run build            | one-off full build of both the iframe and widget                       |
| npm run build:production | one-off full production (minified) build of both the iframe and widget |
| npm run build:main       | one-off build of the widget code                                       |
| npm run build:ui         | one-off build of the iframe code                                       |
| npm run tsc              | typecheck both the iframe and widget                                   |

# Issues / Bugs

For more information about widgets, please visit the widget documentation at https://www.figma.com/widget-docs.

If you find anything bugs or have any questions, please reach out via https://www.figma.com/widget-docs/get-help/.
