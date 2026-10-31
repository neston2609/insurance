import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { adminCredentials } from "../services/admin-credentials.service";
import { createCallBackResult, renewPolicyByNumber } from "../domain/business";

export const publicRouter = Router();

async function requireCallBackApiBasicAuth(
  request: import("express").Request,
  response: import("express").Response,
  next: import("express").NextFunction,
): Promise<void> {
  const authorization = request.get("Authorization") || "";
  const match = authorization.match(/^Basic\s+([A-Za-z0-9+/]+=*)$/i);
  let account;
  if (match && match[1].length <= 4096) {
    const encoded = match[1];
    const decoded = Buffer.from(encoded, "base64");
    if (
      decoded.toString("base64").replace(/=+$/, "") ===
      encoded.replace(/=+$/, "")
    ) {
      const separator = decoded.indexOf(":");
      if (separator > 0) {
        const username = decoded.subarray(0, separator).toString("utf8");
        const password = decoded.subarray(separator + 1).toString("utf8");
        if (username.length <= 100 && password.length <= 256)
          account = await adminCredentials.authenticate(username, password);
      }
    }
  }
  if (!account) {
    response.setHeader(
      "WWW-Authenticate",
      'Basic realm="Call Back Result API"',
    );
    response.status(401).json({ message: "Basic authentication required" });
    return;
  }
  request.user = { name: account.username };
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
