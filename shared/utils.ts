export function printErr(prefix: string, msg: any) {
  console.error(`jam: ${prefix} ${anyToStr(msg)}`);
}

export function print(prefix: string, msg: any) {
  console.log(`jam: ${prefix} ${anyToStr(msg)}`);
}

export function anyToStr(data: any): string {
  if (typeof data === "string") {
    return data;
  }
  return JSON.stringify(data, undefined, 2);
}
