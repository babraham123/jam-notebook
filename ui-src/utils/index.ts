import { print as subPrint, printErr as subPrintErr } from "../../shared/utils";
import { Obj } from "../../shared/types";
import { PLUGIN_ID } from "../../shared/constants";

export function printErr(msg: string) {
  subPrintErr(`iframe: ${msg}`);
}

export function print(msg: string) {
  subPrint(`iframe: ${msg}`);
}

export function getOutput(baseKey: string, lineNum: number): Obj | undefined {
  const res = localStorage.getItem(`${baseKey}:${lineNum}`);
  if (res) {
    return JSON.parse(res) as Obj;
  }
  return undefined;
}

export function setOutput(baseKey: string, lineNum: number, res: Obj) {
  localStorage.setItem(`${baseKey}:${lineNum}`, JSON.stringify(res));
}

export function clearOutputs(baseKey?: string) {
  if (!baseKey) {
    return;
  }
  baseKey += ":";
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (key.startsWith(baseKey)) {
      localStorage.removeItem(key);
    }
  }
  parent.postMessage({ type: "CLEAR" }, PLUGIN_ID);
}

/**
 * Right now, since hidden iframes don't do layout, we can only check for SVG
 * elements inside.
 */
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
