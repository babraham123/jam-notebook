import { handleMessage, initiate } from "./messages";
import { print } from "./utils";

window.onmessage = (event: MessageEvent) => {
  print(event); // TODO: remove after validating msg passing
  if (!event.data?.type) {
    return;
  }
  handleMessage(event.data);
};

initiate();
