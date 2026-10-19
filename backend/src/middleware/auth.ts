import { clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { Role } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/errors.js";

export const requireWorkerAccount: RequestHandler = async (
  request,
  _response,
  next,
) => {
  try {
    const { isAuthenticated, userId } = getAuth(request, {
      acceptsToken: "session_token",
    });
    if (!isAuthenticated || !userId) {
      throw new HttpError(401, "Silakan login terlebih dahulu");
    }

    const clerkUser = await clerkClient.users.getUser(userId);
    const verifiedEmails = clerkUser.emailAddresses
      .filter((email) => email.verification?.status === "verified")
      .map((email) => email.emailAddress.trim().toLowerCase());

    let worker = await prisma.worker.findUnique({
      where: { clerkUserId: userId },
    });
    if (worker && !verifiedEmails.includes(worker.email.toLowerCase())) {
      throw new HttpError(403, "Akun belum terdaftar sebagai worker");
    }
    if (!worker) {
      for (const email of verifiedEmails) {
        worker = await prisma.worker.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });
        if (worker) break;
      }
    }

    if (!worker) {
      throw new HttpError(403, "Akun belum terdaftar sebagai worker");
    }
    if (worker.clerkUserId && worker.clerkUserId !== userId) {
      throw new HttpError(403, "Akun belum terdaftar sebagai worker");
    }

    if (!worker.clerkUserId) {
      const linked = await prisma.worker.updateMany({
        where: { id: worker.id, clerkUserId: null },
        data: { clerkUserId: userId },
      });
      if (linked.count === 0) {
        worker = await prisma.worker.findUnique({ where: { id: worker.id } });
      } else {
        worker = { ...worker, clerkUserId: userId };
      }
      if (!worker || worker.clerkUserId !== userId) {
        throw new HttpError(403, "Akun belum terdaftar sebagai worker");
      }
    }

    request.worker = worker;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin: RequestHandler = (request, _response, next) => {
  if (request.worker?.role !== Role.ADMIN) {
    next(new HttpError(403, "Anda tidak memiliki akses untuk aksi ini"));
    return;
  }
  next();
};

export const requireWorkerRole: RequestHandler = (
  request,
  _response,
  next,
) => {
  if (request.worker?.role !== Role.WORKER) {
    next(new HttpError(403, "Anda tidak memiliki akses untuk aksi ini"));
    return;
  }
  next();
};
