/**
 * Everything in this file is accessible in scripts under the namespace
 * 'figma.notebook'.
 */

import { svgToString as stringifySVG } from "../utils";
import { stringify as stringifyCSV } from 'csv-stringify/sync';
import { IFrameMessage } from "../../shared/types";
import { PLUGIN_ID } from "../../shared/constants";

function queryNodes(node: { id: string }, selector: string): Promise<any[]>;
function queryNodes(selector: string): Promise<any[]>;
function queryNodes(
  rootNode: { id: string } | string,
  selector?: string
): Promise<any[]> {
  if (!selector) {
    selector = rootNode as string;
    rootNode = undefined;
  }
  const id = (rootNode as { id: string } | null)?.id;

  return new Promise((resolve) => {
    function callback(event: MessageEvent) {
      if (event?.data?.type === "QUERY") {
        const msg = event.data as IFrameMessage;
        resolve(msg.nodes);
      }
      window.removeEventListener("message", callback);
    }

    window.addEventListener("message", callback);
    const queryMsg: IFrameMessage = {
      type: "QUERY",
      nodeQuery: {
        selector,
        id,
      },
    };
    window.postMessage(queryMsg, PLUGIN_ID);
  });
}

// Converts an Uint8Array, ArrayBuffer, Buffer or string to a base64 string. Encoding indicates
// the string's encoding, defaults to 'binary'.
function stringifyBytes(data: Uint8Array | ArrayBuffer | Buffer | string, encoding?: string): string {
  if (data instanceof Uint8Array) {
    // Uint8Array -> ArrayBuffer
    data = data.buffer.slice(data.byteOffset, data.byteLength + data.byteOffset);
  }
  if (!encoding) {
    encoding = 'binary';
  }
  return Buffer.from(data, encoding).toString("base64");
}

export { queryNodes, stringifyCSV, stringifySVG, stringifyBytes };
