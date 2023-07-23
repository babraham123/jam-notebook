/**
 * Everything in this file is accessible in scripts under the namespace
 * 'figma.notebook'.
 */

import { postMessage, setOutput, svgToString, stringToSVG } from "../utils";
import { IFrameMessage } from "../../shared/types";

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
      if (event.data?.type === "QUERY") {
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

// 5MB limit on total stored data
function storeResult(baseKey: string, lineNum: number, data: any) {
  setOutput(baseKey, lineNum, JSON.stringify(data));
}

export { queryNodes, storeResult, svgToString, stringToSVG };
