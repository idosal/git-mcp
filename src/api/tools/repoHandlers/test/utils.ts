import type { ZodRawShape } from "zod";

export class MockMcp {
  #tools: Record<
    string,
    {
      description: string;
      cb: (args: Record<string, any>) => Promise<any>;
    }
  > = {};

  tool(
    name: string,
    description: string,
    paramsSchema: ZodRawShape,
    cb: (args: Record<string, any>) => Promise<any>,
  ): void {
    this.#tools[name] = { description, cb };
  }

  getTool(name: string) {
    return this.#tools[name];
  }

  getTools() {
    // filter out the cb from the tools
    return Object.fromEntries(
      Object.entries(this.#tools).map(([name, { description }]) => [
        name,
        { description },
      ]),
    );
  }
}
