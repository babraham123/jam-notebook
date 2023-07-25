import { handleMessage, initiate } from "./messages";
import { print } from "./utils";

window.onmessage = (event: MessageEvent) => {
  print(event);
  if (!event.data?.pluginMessage?.type) {
    return;
  }
  handleMessage(event.data.pluginMessage);
};

initiate();
