// Ambient augmentation: @types/node 25.2.3 (pulled transitively via bun-types)
// does not yet declare `styleText`, even though Bun 1.4 implements it at runtime.
// Remove this file once upstream @types/node ships the declaration.
declare module "node:util" {
  type StyleFormat =
    | "reset"
    | "bold"
    | "dim"
    | "italic"
    | "underline"
    | "doubleunderline"
    | "strikethrough"
    | "inverse"
    | "hidden"
    | "blink"
    | "black"
    | "red"
    | "green"
    | "yellow"
    | "blue"
    | "magenta"
    | "cyan"
    | "white"
    | "gray"
    | "grey"
    | "blackBright"
    | "redBright"
    | "greenBright"
    | "yellowBright"
    | "blueBright"
    | "magentaBright"
    | "cyanBright"
    | "whiteBright"
    | "bgBlack"
    | "bgRed"
    | "bgGreen"
    | "bgYellow"
    | "bgBlue"
    | "bgMagenta"
    | "bgCyan"
    | "bgWhite"
    | "bgGray"
    | "bgGrey"
    | "bgBlackBright"
    | "bgRedBright"
    | "bgGreenBright"
    | "bgYellowBright"
    | "bgBlueBright"
    | "bgMagentaBright"
    | "bgCyanBright"
    | "bgWhiteBright";

  interface StyleTextOptions {
    validateStream?: boolean;
    stream?: NodeJS.WritableStream;
  }

  function styleText(
    format: StyleFormat | StyleFormat[],
    text: string,
    options?: StyleTextOptions,
  ): string;
}
