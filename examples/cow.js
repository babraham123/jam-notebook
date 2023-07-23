import { say } from "cowsay-browser";

window.delimiters = {
  first: ["/", "\\"],
  middle: ["|", "|"],
  last: ["\\", "/"],
  only: ["<", ">"],
};

// Connect output to a code block
const val = say({ text: "Welcome to code notebooks!" });
