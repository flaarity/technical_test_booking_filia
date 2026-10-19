import type { Worker } from "../../generated/prisma/client.js";

declare module "express-serve-static-core" {
  interface Request {
    worker?: Worker;
  }
}
