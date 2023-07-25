export function printErr(prefix: string, msg: any) {
  if (typeof msg === 'string') {
    console.error(`jam: ${prefix} ${msg}`);
  }
  console.error(`jam: ${prefix} ${JSON.stringify(msg)}`);
}

export function print(prefix: string, msg: any) {
  if (typeof msg === 'string') {
    console.log(`jam: ${prefix} ${msg}`);
  }
  console.log(`jam: ${prefix} ${JSON.stringify(msg)}`);
}
