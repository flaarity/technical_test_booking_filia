import { ZodError, type ZodType } from "zod";
import { HttpError, validationErrors } from "./errors.js";

export const parseInput = <T>(
  schema: ZodType<T>,
  value: unknown,
): T => {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(
        422,
        "Validasi gagal",
        validationErrors(error.issues),
      );
    }
    throw error;
  }
};
