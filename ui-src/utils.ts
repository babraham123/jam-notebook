import { print as subPrint, printErr as subPrintErr } from "../shared/utils";
import { IFrameMessage } from "../shared/types";
import { PLUGIN_ID, JS_VAR_REGEX, PY_VAR_REGEX } from "../shared/constants";

export function printErr(msg: any) {
  subPrintErr("iframe:", msg);
}

export function print(msg: any) {
  subPrint("iframe:", msg);
}

export function postMessage(msg: IFrameMessage) {
  // const val = new URLSearchParams(document.location.search).get("source");
  // const source = val ? decodeURIComponent(val) : "*";
  const data = { pluginMessage: msg, pluginId: PLUGIN_ID };
  parent.postMessage(data, "https://www.figma.com");
  parent.postMessage(data, "https://staging.figma.com");
}

export function getOutput(baseKey: string, lineNum: number): any | undefined {
  const res = sessionStorage.getItem(`${baseKey}:${lineNum}`);
  if (res) {
    return JSON.parse(res);
  }
  return undefined;
}

export function setOutput(baseKey: string, lineNum: number, res: string) {
  sessionStorage.setItem(`${baseKey}:${lineNum}`, res);
  // Or send msg to widget and call setSharedPluginData
}

export function clearOutputs(baseKey?: string) {
  if (!baseKey) {
    return;
  }
  baseKey += ":";
  const keys = Object.keys(sessionStorage);
  for (const key of keys) {
    if (key.startsWith(baseKey)) {
      sessionStorage.removeItem(key);
    }
  }
}

// Right now, since hidden iframes don't do layout, we can only check for SVG
// elements inside.
export function svgToString(svg: Element): string {
  if (svg.nodeName.toLowerCase() !== "svg") {
    const newSvg = svg.querySelector("svg");
    if (!newSvg) {
      throw new Error("Non-SVG elements currently unsupported.");
    }
    svg = newSvg;
  }

  const svgContainer = svg.cloneNode(true) as SVGSVGElement;

  // Cleanup SVG styles before importing into Figma.
  // TODO: necessary? Or only for ObservableHQ?
  svgContainer.querySelectorAll("style").forEach((style) => {
    style.remove();
  });

  const svgData = new XMLSerializer().serializeToString(svgContainer);
  return svgData;
}

export function stringToSVG(svgData: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(svgData, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) {
    throw new Error("No SVG elements were found.");
  }
  return svg;
}

export interface Variable {
  keyword: string;
  name: string;
  altName: string;
  value?: any;
}

export function extractVariable(code: string, lang: string): Variable {
  let found = null;
  switch (lang) {
    case "javascript":
      found = code.match(JS_VAR_REGEX);
      break;
    case "python":
      found = code.match(PY_VAR_REGEX);
      break;
  }
  if (!found || !found.groups) {
    throw new Error(`Could not extract variable name from code: ${code}`);
  }

  return {
    keyword: found.groups?.keyword ?? "",
    name: found.groups.name,
    altName: `__${found.groups.name}__`,
  };
}
