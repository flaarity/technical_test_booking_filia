import { Router } from "express";
import { requireWorkerAccount } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { sendSuccess } from "../lib/responses.js";

const router = Router();

router.get("/me", requireWorkerAccount, (request, response, next) => {
  try {
    const worker = request.worker;
    if (!worker) throw new HttpError(401, "Silakan login terlebih dahulu");

    sendSuccess(response, 200, "OK", {
      workerCode: worker.workerCode,
      name: worker.name,
      email: worker.email,
      phone: worker.phone,
      position: worker.position,
      role: worker.role,
      photoUrl: worker.photoUrl,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
