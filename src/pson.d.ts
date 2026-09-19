declare module 'pson' {
  export class StaticPair {
    constructor(dictionary?: Array<string | number>);
    encode(value: unknown): { toBuffer(): Buffer | Uint8Array };
    decode(buf: Buffer | Uint8Array): unknown;
  }
  const PSON: { StaticPair: typeof StaticPair };
  export default PSON;
}
