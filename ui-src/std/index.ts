/**
 * Everything in this file is accessible in scripts under the namespace
 * 'figma.notebook'.
 */

import { stringify as stringifyCSV } from "csv-stringify/sync";

import { postMessage, svgToString as stringifySVG } from "../utils";
import { IFrameMessage, Obj } from "../../shared/types";


function queryNodes(node: { id: string }, selector: string): Promise<any[]>;
function queryNodes(selector: string): Promise<any[]>;
function queryNodes(
  rootNode: { id: string } | string,
  selector?: string
): Promise<any[]> {
  let id: string | undefined;
  if (selector) {
    id = (rootNode as { id: string } | null)?.id;
  } else {
    selector = rootNode as string;
    // Don't set id, so that we query the whole document
  }

  return new Promise((resolve) => {
    function callback(event: MessageEvent) {
      if (event?.data?.type === "QUERY") {
        const msg = event.data as IFrameMessage;
        resolve(msg.nodes ?? []);
      }
      window.removeEventListener("message", callback);
    }

    window.addEventListener("message", callback);
    selector = selector ?? ""; // Just to make TS happy
    const queryMsg: IFrameMessage = {
      type: "QUERY",
      nodeQuery: {
        selector,
        id,
      },
    };
    postMessage(queryMsg);
  });
}

// Converts an Uint8Array, ArrayBuffer, Buffer or string to a base64 string. Encoding indicates
// the string's encoding, defaults to 'binary'.
function stringifyBytes(
  data: Uint8Array | ArrayBuffer | Buffer | string,
  encoding?: BufferEncoding
): string {
  if (!encoding) {
    encoding = "binary";
  }

  if (data instanceof Uint8Array) {
    // Uint8Array -> ArrayBuffer
    data = data.buffer.slice(
      data.byteOffset,
      data.byteLength + data.byteOffset
    );
  }
  if (typeof data === "string") {
    return Buffer.from(data as string, encoding).toString("base64");
  } else {
    return Buffer.from(data).toString("base64");
  }
}

function storeAny(key: string, data: any) {
  let obj: Obj;
  if (
    data instanceof Uint8Array ||
    data instanceof ArrayBuffer ||
    data instanceof Buffer
  ) {
    obj = {
      type: "BINARY",
      data: stringifyBytes(data),
    };
  } else if (typeof data === "string") {
    obj = {
      type: "TEXT",
      data,
    };
  } else if (data instanceof Error) {
    obj = {
      type: "ERROR",
      data: JSON.stringify(data),
    };
  } else if (data instanceof Element || data instanceof SVGSVGElement) {
    obj = {
      type: "SVG",
      data: stringifySVG(data as Element),
    };
  } else if (
    Array.isArray(data) &&
    data.length > 0 &&
    Array.isArray(data[0]) &&
    data[0].length > 0 &&
    typeof data[0][0] === "number"
  ) {
    obj = {
      type: "CSV",
      data: stringifyCSV(data),
    };
  } else if (data === undefined) {
    obj = {
      type: "UNDEFINED",
      data: "",
    };
  } else {
    obj = {
      type: "JSON",
      data: JSON.stringify(data),
    };
  }
  localStorage.setItem(key, JSON.stringify(obj));
}

export { queryNodes, stringifyCSV, stringifySVG, storeAny };
