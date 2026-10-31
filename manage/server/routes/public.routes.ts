import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { createCallBackResult, renewPolicyByNumber } from "../domain/business";

export const publicRouter = Router();

function requireCallBackApiBasicAuth(
  request: import("express").Request,
  response: import("express").Response,
  next: import("express").NextFunction,
) {
  const configuredUsername = process.env.CALLBACK_API_USERNAME || "";
  const configuredPassword = process.env.CALLBACK_API_PASSWORD || "";
  const authorization = request.get("Authorization") || "";
  const match = authorization.match(/^Basic\s+([A-Za-z0-9+/]+=*)$/i);
  let authenticated = false;
  if (configuredUsername && configuredPassword && match) {
    try {
      const decoded = Buffer.from(match[1], "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator >= 0) {
        const username = Buffer.from(decoded.slice(0, separator));
        const password = Buffer.from(decoded.slice(separator + 1));
        const expectedUsername = Buffer.from(configuredUsername);
        const expectedPassword = Buffer.from(configuredPassword);
        authenticated =
          username.length === expectedUsername.length &&
          password.length === expectedPassword.length &&
          timingSafeEqual(username, expectedUsername) &&
          timingSafeEqual(password, expectedPassword);
      }
    } catch {
      authenticated = false;
    }
  }
  if (!authenticated) {
    response.setHeader(
      "WWW-Authenticate",
      'Basic realm="Call Back Result API"',
    );
    response.status(401).json({ message: "Basic authentication required" });
    return;
  }
  next();
}

const renewalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
publicRouter.post(
  "/policies/renew",
  renewalLimiter,
  async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.json(await renewPolicyByNumber(request.body, "public-api"));
  },
);

const callBackResultLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
publicRouter.post(
  "/call-back-results",
  requireCallBackApiBasicAuth,
  callBackResultLimiter,
  async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const result = await createCallBackResult(request.body);
    response.status(result.created ? 201 : 200).json(result.item);
  },
);
