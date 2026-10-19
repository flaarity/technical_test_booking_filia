import type { Response } from "express";

export const sendSuccess = <T>(
  response: Response,
  statusCode: number,
  message: string,
  data: T,
): void => {
  response.status(statusCode).json({ success: true, message, data });
};
