// This widget will open an Iframe window with buttons to show a toast message and close the window.

const { widget } = figma;
const { AutoLayout, Text, Rectangle, useSyncedState, useWidgetId, useEffect } =
  widget;

import * as FigmaSelector from "./vendor/figma-selector";
import { serializeNode, print, printErr } from "./utils";
import { metrics, colors, badges } from "./tokens";
import { Button } from "./components/Button";
import { SUPPORTED_MSGS } from "../shared/constants";
import { IFrameMessage, CommandType } from "../shared/types";

type ResultStatus = "EMPTY" | "RUNNING" | "SUCCESS" | "ERROR";

async function unsupportedHandler(
  msg: IFrameMessage
): Promise<IFrameMessage | undefined> {
  printErr(`In widget, command ${msg.type} is unsupported`);
  return undefined;
}

function Widget() {
  const widgetId = useWidgetId();

  const [title, setTitle] = useSyncedState<string>("title", "untitled");
  // const [inputNodeIds, setInputNodeIds] = useSyncedState<string[]>("inputNodeIds", []);
  const [resultStatus, setResultStatus] = useSyncedState<ResultStatus>(
    "resultStatus",
    "EMPTY"
  );

  const HANDLERS: Record<
    CommandType,
    (msg: IFrameMessage) => Promise<IFrameMessage | undefined>
  > = {
    INITIATE: isReadyHandler,
    RUN: saveHandler,
    FORMAT: unsupportedHandler,
    TEST: unsupportedHandler,
    QUERY: queryHandler,
    SAVE: saveHandler,
    CLOSE: closeHandler,
  };

  // Modifies the React component. Response msg is sent to both the headless runner and
  // the editor, if present.
  async function handleMessage(msg: IFrameMessage): Promise<void> {
    if (msg.type in SUPPORTED_MSGS["widget"]) {
      if (msg.debug) {
        print(`msg ${msg.type} debug: ${msg.debug}`);
      }
      const resp = await HANDLERS[msg.type](msg);
      if (resp) {
        figma.ui.postMessage(resp);
      }
    } else {
      await unsupportedHandler(msg);
    }
  }

  function addMsgListener() {
    figma.ui.onmessage = async (event) => {
      if (!event?.data?.type) {
        return;
      }
      const msg = event.data as IFrameMessage;
      await handleMessage(msg);
    };
  }

  function isReadyHandler(
    msg: IFrameMessage
  ): Promise<IFrameMessage | undefined> {
    // TODO: send app state, code, inputs, etc
    return undefined;
  }

  function saveHandler(msg: IFrameMessage): Promise<IFrameMessage | undefined> {
    if (msg?.code) {
      // TODO: save
    }
    if (msg?.appState) {
      // TODO: save
      setTitle(msg.appState.title);
    }
    if (msg?.result) {
      // TODO: save
      if (msg.result.output.type === "ERROR") {
        setResultStatus("ERROR");
        // figma.notify("Notebook error: " + errorLike.message);
      } else {
        setResultStatus("SUCCESS");
      }
    }
    return undefined;
  }

  function queryHandler(
    msg: IFrameMessage
  ): Promise<IFrameMessage | undefined> {
    if (msg?.nodes) {
      printErr(`Incorrectly sent nodes from iframe: ${msg.nodes.length}`);
    }
    let serializedNodes: any[] = [];
    if (msg?.nodeQuery) {
      const { selector, id } = msg.nodeQuery;
      const rootNode = !id ? figma.currentPage : figma.getNodeById(id);
      const nodes = FigmaSelector.parse(selector, rootNode);
      serializedNodes = nodes.map((node) => serializeNode(node));
    }
    return Promise.resolve({
      type: "QUERY",
      nodeQuery: msg.nodeQuery,
      nodes: serializedNodes,
    });
  }

  function closeHandler(
    msg: IFrameMessage
  ): Promise<IFrameMessage | undefined> {
    closeIFrame();
    return undefined;
  }

  function closeIFrame(): void {
    figma.ui.close();
    figma.closePlugin();
    if (resultStatus === "RUNNING") {
      // TODO: revert to last result
      setResultStatus("EMPTY");
    }
  }

  function handlePlayBtn(): void {
    setResultStatus("RUNNING");
    addMsgListener();
    figma.showUI(__html__, {
      visible: false,
      title: "Code runner",
    });
  }

  return (
    <AutoLayout
      direction="vertical"
      cornerRadius={metrics.cornerRadius}
      fill={colors.bg}
      stroke={colors.stroke}
      strokeWidth={1}
    >
      <AutoLayout
        padding={metrics.detailPadding}
        fill={colors.bgDetail}
        width={metrics.width}
        verticalAlignItems="center"
        spacing={metrics.padding}
      >
        <Text fontSize={32} horizontalAlignText="center">
          {title}
        </Text>
        <Rectangle width="fill-parent" height={1} />
        <Button
          name="play"
          onClick={handlePlayBtn}
          enabled={resultStatus !== "RUNNING"}
        ></Button>
        <Button
          name="pause"
          onClick={closeIFrame}
          enabled={resultStatus === "RUNNING"}
        ></Button>
        {resultStatus !== "EMPTY" && (
          <AutoLayout
            padding={metrics.buttonPadding}
            fill={badges[resultStatus].fill}
            cornerRadius={metrics.cornerRadius}
          >
            <Text fill={badges[resultStatus].textFill}>{resultStatus}</Text>
          </AutoLayout>
        )}
      </AutoLayout>
    </AutoLayout>
  );
}

widget.register(Widget);
