export function printErr(prefix: string, msg: any) {
  console.error(`fig: ${prefix} ${JSON.stringify(msg)}`);
}

export function print(prefix: string, msg: any) {
  console.log(`fig: ${prefix} ${JSON.stringify(msg)}`);
}
