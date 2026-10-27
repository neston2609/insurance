import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  createAgentCallbackByPolicyNumber,
  renewPolicyByNumber,
  updateAgentCallbackStatusByKeys,
} from "../domain/business";

export const publicRouter = Router();

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

const agentCallbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
publicRouter.post(
  "/agent-callbacks",
  agentCallbackLimiter,
  async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response
      .status(201)
      .json(
        await createAgentCallbackByPolicyNumber(request.body, "public-api"),
      );
  },
);

publicRouter.post(
  "/agent-callbacks/status",
  agentCallbackLimiter,
  async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.json(
      await updateAgentCallbackStatusByKeys(request.body, "public-api"),
    );
  },
);
