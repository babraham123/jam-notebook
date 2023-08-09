import * as std from "./std";
import { runJSScript, formatJSScript } from "./js-runtime";
import { runPYScript, formatPYScript } from "./py-runtime";
import {
  IFrameMessage,
  CommandType,
  ErrorLike,
  Endpoint,
} from "../shared/types";
import { postMessage, print, printErr, getOutput, clearOutputs } from "./utils";

// Handlers return the msg that will be sent back to the widget. Type undefined
// will be ignored.
const HANDLERS: Record<
  CommandType,
  (msg: IFrameMessage) => Promise<IFrameMessage | undefined>
> = {
  INITIATE: ignoreHandler,
  RUN: runHandler,
  FORMAT: formatHandler,
  QUERY: ignoreHandler, // result handled by a separate listener
  CREATE: ignoreHandler,
};

function getErrorMsg(type: CommandType, err: ErrorLike): IFrameMessage {
  return {
    type,
    status: "FAILURE",
    error: err,
  };
}

async function ignoreHandler(
  msg: IFrameMessage
): Promise<IFrameMessage | undefined> {
  printErr(msg);
  return undefined;
}

async function runHandler(
  msg: IFrameMessage
): Promise<IFrameMessage | undefined> {
  clearOutputs(msg.blockId);
  if (!msg.code) {
    return getErrorMsg("RUN", {
      name: "NotFound",
      message: "No code found",
      stack: "",
    });
  }

  try {
    switch (msg.code.language) {
      case "javascript":
        await runJSScript(
          msg.code?.code ?? "",
          msg.inputs ?? [],
          msg.libraries ?? [],
          msg.outputs ?? [],
          std
        );
        break;
      case "python":
        await runPYScript(
          msg.code?.code ?? "",
          msg.inputs ?? [],
          msg.libraries ?? [],
          msg.outputs ?? [],
          std
        );
        break;
      default:
        return getErrorMsg("RUN", {
          name: "Unsupported",
          message: `Unsupported language: ${msg.code.language}`,
          stack: "",
        });
    }

    const outputs: Endpoint[] = [];
    for (const output of msg.outputs ?? []) {
      if (output.shouldReturn) {
        output.node = getOutput(output.sourceId, output.srcLineNum);
        outputs.push(output);
      }
    }
    return {
      type: "RUN",
      status: "SUCCESS",
      outputs,
    };
  } catch (err: any) {
    return getErrorMsg("RUN", {
      name: err.name ?? "ExecutionError",
      message: err.message ?? "",
      stack: err.stack ?? `${err}`,
    });
  }
}

async function formatHandler(
  msg: IFrameMessage
): Promise<IFrameMessage | undefined> {
  if (!msg.code || !msg.code.code) {
    return getErrorMsg("FORMAT", {
      name: "NotFound",
      message: "No code found",
      stack: "",
    });
  }
  try {
    let formattedCode = msg.code?.code ?? "";
    switch (msg.code.language) {
      case "javascript":
        formattedCode = formatJSScript(formattedCode);
        break;
      case "python":
        formattedCode = await formatPYScript(formattedCode);
        break;
      default:
        return getErrorMsg("FORMAT", {
          name: "Unsupported",
          message: `Unsupported language: ${msg.code.language}`,
          stack: "",
        });
    }
    return {
      type: "FORMAT",
      status: "SUCCESS",
      code: {
        language: msg.code.language,
        code: formattedCode,
      },
    };
  } catch (err: any) {
    return getErrorMsg("FORMAT", {
      name: err.name ?? "ExecutionError",
      message: err.message ?? "",
      stack: err.stack ?? `${err}`,
    });
  }
}

// Do some processing and then return the result to the React component.
export async function handleMessage(msg: IFrameMessage): Promise<void> {
  if (msg.debug) {
    print(msg);
  }
  if (Object.keys(HANDLERS).indexOf(msg.type) < 0) {
    return;
  }
  const resp = await HANDLERS[msg.type](msg);
  if (resp) {
    postMessage(resp);
  }
}

// Send 'ready' msg to the widget.
export function initiate(): void {
  postMessage({ type: "INITIATE" }); // , debug: "iframe started" });
}
