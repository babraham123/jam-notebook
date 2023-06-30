/**
 Copyright (c) 2011 Felix Geisendörfer (felix@debuggable.com)

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */

// Type definitions for node-stack-trace
// Project: https://github.com/felixge/node-stack-trace
// Definitions by: Exceptionless <https://github.com/exceptionless>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
export interface StackFrame {
  getTypeName(): string;
  getFunctionName(): string;
  getMethodName(): string;
  getFileName(): string;
  getLineNumber(): number;
  getColumnNumber(): number;
  isNative(): boolean;
  isConstructor(): boolean;
}

/**
 * Copied from https://github.com/felixge/node-stack-trace
 *
 * Modified the regex to:
 * 1) Support line numbers in eval functions.
 * 2) Support async functions.
 */
export function parseTraceFromError(err: Error): StackFrame[] {
  if (!err.stack) {
    return [];
  }

  const lines = err.stack.split("\n").slice(1);
  return lines
    .map(function (line) {
      if (line.match(/^\s*[-]{4,}$/)) {
        return createParsedCallSite({
          fileName: line,
          lineNumber: null,
          functionName: null,
          typeName: null,
          methodName: null,
          columnNumber: null,
          native: null,
        });
      }

      const lineMatch = line.match(
        /at (?:async )?(?:(.+?)\s+\()?(?:(.+?):(\d+)(?::(\d+))?|([^)]+))\)?(, .*:([0-9]+):([0-9]+)\)$)?/
      );
      if (!lineMatch) {
        return;
      }

      let object = null;
      let method = null;
      let functionName = null;
      let typeName = null;
      let methodName = null;
      let isNative = lineMatch[5] === "native";

      if (lineMatch[1]) {
        functionName = lineMatch[1];
        let methodStart = functionName.lastIndexOf(".");
        if (functionName[methodStart - 1] == ".") methodStart--;
        if (methodStart > 0) {
          object = functionName.substr(0, methodStart);
          method = functionName.substr(methodStart + 1);
          const objectEnd = object.indexOf(".Module");
          if (objectEnd > 0) {
            functionName = functionName.substr(objectEnd + 1);
            object = object.substr(0, objectEnd);
          }
        }
      }

      if (method) {
        typeName = object;
        methodName = method;
      }

      if (method === "<anonymous>") {
        methodName = null;
        functionName = null;
      }

      const properties = {
        fileName: lineMatch[2] || null,
        lineNumber: parseInt(lineMatch[7] || lineMatch[3], 10) || null,
        functionName: functionName,
        typeName: typeName,
        methodName: methodName,
        columnNumber: parseInt(lineMatch[8] || lineMatch[4], 10) || null,
        native: isNative,
      };

      return createParsedCallSite(properties);
    })
    .filter(function (callSite) {
      return !!callSite;
    });
}

function CallSite(properties) {
  for (const property in properties) {
    this[property] = properties[property];
  }
}

const strProperties = [
  "this",
  "typeName",
  "functionName",
  "methodName",
  "fileName",
  "lineNumber",
  "columnNumber",
  "function",
  "evalOrigin",
];

const boolProperties = ["topLevel", "eval", "native", "constructor"];

strProperties.forEach(function (property) {
  CallSite.prototype[property] = null;
  CallSite.prototype["get" + property[0].toUpperCase() + property.substr(1)] =
    function () {
      return this[property];
    };
});

boolProperties.forEach(function (property) {
  CallSite.prototype[property] = false;
  CallSite.prototype["is" + property[0].toUpperCase() + property.substr(1)] =
    function () {
      return this[property];
    };
});

function createParsedCallSite(properties) {
  return new CallSite(properties);
}
