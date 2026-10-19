import "dotenv/config";
import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import express, { type RequestHandler } from "express";
import bookingsRouter from "./routes/bookings.js";
import roomsRouter from "./routes/rooms.js";
import slotsRouter from "./routes/slots.js";
import workersRouter from "./routes/workers.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { sendSuccess } from "./lib/responses.js";

const app = express();
const frontendOrigin = process.env["FRONTEND_ORIGIN"]?.trim();
const clerkAuth = clerkMiddleware();

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, origin === undefined || origin === frontendOrigin);
    },
    credentials: true,
  }),
);

app.get("/health", (_request, response) => {
  sendSuccess(response, 200, "OK", { status: "ok" });
});

const clerkSessionOrUnauthorized: RequestHandler = (
  request,
  response,
  next,
) => {
  const isApiRoute =
    /^\/(workers|rooms|slots|bookings)(\/|$)/.test(request.path);
  if (!isApiRoute) {
    next();
    return;
  }

  const hasBearerToken = request
    .get("authorization")
    ?.startsWith("Bearer ");
  const hasSessionCookie = request
    .get("cookie")
    ?.split(";")
    .some((cookie) => cookie.trim().startsWith("__session="));

  if (!hasBearerToken && !hasSessionCookie) {
    response.status(401).json({
      success: false,
      message: "Silakan login terlebih dahulu",
    });
    return;
  }

  clerkAuth(request, response, next);
};

app.use(clerkSessionOrUnauthorized);
app.use(express.json());
app.use("/workers", workersRouter);
app.use("/rooms", roomsRouter);
app.use("/slots", slotsRouter);
app.use("/bookings", bookingsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
