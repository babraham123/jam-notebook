import { print as subPrint, printErr as subPrintErr } from "../../shared/utils";
import { IFrameMessage, Obj } from "../../shared/types";
import { PLUGIN_ID } from "../../shared/constants";

export function printErr(msg: any) {
  subPrintErr('iframe:', msg);
}

export function print(msg: any) {
  subPrint('iframe:', msg);
}

export function postMessage(msg: IFrameMessage) {
  parent.postMessage({ pluginMessage: msg}, PLUGIN_ID);
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
  // Or send msg to widget and call setSharedPluginData
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
