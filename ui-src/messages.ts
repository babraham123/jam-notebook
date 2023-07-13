import * as std from "./std";
import { runJSScript, formatJSScript } from "./js-runtime";
import { IFrameMessage, CommandType, ErrorLike } from "../shared/types";
import { postMessage, print, setOutput, clearOutputs } from "./utils";

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
  CLEAR: ignoreHandler,
  CREATE: ignoreHandler,
};

function recordError(
  type: CommandType,
  widgetId: string | undefined,
  err: ErrorLike
): IFrameMessage {
  if (widgetId) {
    setOutput(widgetId, 0, {
      type: "ERROR",
      data: JSON.stringify(err),
    });
  }
  return {
    type,
    status: "FAILURE",
    error: err,
  };
}

async function ignoreHandler(
  msg: IFrameMessage
): Promise<IFrameMessage | undefined> {
  return undefined;
}

async function runHandler(
  msg: IFrameMessage
): Promise<IFrameMessage | undefined> {
  if (!msg.code || !msg.code.code) {
    clearOutputs(msg.widgetId);
    return recordError("RUN", msg.widgetId, {
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
          msg.outputs ?? [],
          std
        );
        break;
      default:
        clearOutputs(msg.widgetId);
        return recordError("RUN", msg.widgetId, {
          name: "Unsupported",
          message: `Unsupported language: ${msg.code.language}`,
          stack: "",
        });
    }
    return {
      type: "RUN",
      status: "SUCCESS",
    };
  } catch (err: any) {
    clearOutputs(msg.widgetId);
    return recordError("RUN", msg.widgetId, {
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
    return recordError("FORMAT", msg.widgetId, {
      name: "NotFound",
      message: "No code found",
      stack: "",
    });
  }
  try {
    let formattedCode = msg.code?.code ?? "";
    switch (msg.code.language) {
      case "javascript":
      case "typescript":
        formattedCode = formatJSScript(formattedCode);
        break;
      default:
        return recordError("FORMAT", msg.widgetId, {
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
    return recordError("FORMAT", msg.widgetId, {
      name: err.name ?? "ExecutionError",
      message: err.message ?? "",
      stack: err.stack ?? `${err}`,
    });
  }
}

// Do some processing and then return the result to the React component.
export async function handleMessage(msg: IFrameMessage): Promise<void> {
  if (msg.debug) {
    print(`msg ${msg.type} debug: ${msg.debug}`);
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
