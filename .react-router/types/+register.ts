import "react-router";

declare module "react-router" {
  interface Register {
    params: Params;
  }
}

type Params = {
  "/": {};
  "/api/chat": {};
  "/*": {
    "*": string;
  };
};