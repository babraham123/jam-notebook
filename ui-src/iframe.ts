import { handleMessage } from "./messages";
import { PLUGIN_ID } from "../shared/constants";

window.onmessage = (event: MessageEvent) => {
  if (!event.data?.type) {
    return;
  }
  handleMessage(event.data);
};
// Send 'ready' msg to the plugin.
parent.postMessage({ type: "INITIATE" }, PLUGIN_ID);
