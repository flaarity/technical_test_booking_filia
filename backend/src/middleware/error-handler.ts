import type { ErrorRequestHandler, RequestHandler } from "express";
import {
  TokenVerificationError,
  TokenVerificationErrorReason,
} from "@clerk/backend/errors";
import { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../lib/errors.js";

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new HttpError(404, `Endpoint ${request.method} ${request.path} tidak ditemukan`));
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  if (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400
  ) {
    response.status(422).json({
      success: false,
      message: "Validasi gagal",
      errors: { body: ["JSON request tidak valid"] },
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.errors ? { errors: error.errors } : {}),
    });
    return;
  }

  if (error instanceof TokenVerificationError) {
    const invalidTokenReasons = new Set<string>([
      TokenVerificationErrorReason.TokenExpired,
      TokenVerificationErrorReason.TokenInvalid,
      TokenVerificationErrorReason.TokenInvalidAlgorithm,
      TokenVerificationErrorReason.TokenInvalidAuthorizedParties,
      TokenVerificationErrorReason.TokenInvalidIssuer,
      TokenVerificationErrorReason.TokenInvalidSignature,
      TokenVerificationErrorReason.TokenNotActiveYet,
      TokenVerificationErrorReason.TokenIatInTheFuture,
      TokenVerificationErrorReason.TokenVerificationFailed,
    ]);
    if (invalidTokenReasons.has(error.reason)) {
      response.status(401).json({
        success: false,
        message: "Silakan login terlebih dahulu",
      });
      return;
    }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    response.status(409).json({
      success: false,
      message: "Data bertabrakan dengan data yang sudah ada",
    });
    return;
  }

  console.error(
    "Unhandled request error",
    error instanceof Error ? error.name : "UnknownError",
  );
  response.status(500).json({
    success: false,
    message: "Terjadi kesalahan pada server",
  });
};
