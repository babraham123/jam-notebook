import { print as subPrint, printErr as subPrintErr } from "../../shared/utils";

export function printErr(msg: string) {
  subPrintErr(`iframe ${import.meta.env.VITE_TARGET}: ${msg}`);
}

export function print(msg: string) {
  subPrint(`iframe ${import.meta.env.VITE_TARGET}: ${msg}`);
}

/**
 * Right now, since hidden iframes don't do layout, we can only check for SVG
 * elements inside.
 */
export function svgToString(svg: Element): string {
  if (svg.nodeName.toLowerCase() !== "svg") {
    svg = svg.querySelector("svg");
  }

  if (!svg) {
    throw new Error("Non-SVG elements currently unsupported.");
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
