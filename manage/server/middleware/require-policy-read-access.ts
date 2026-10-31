import type { RequestHandler } from "express";
import { adminCredentials } from "../services/admin-credentials.service";

function parseBasicCredentials(
  authorization: string,
): { username: string; password: string } | null {
  const match = authorization.match(/^Basic\s+([A-Za-z0-9+/]+={0,2})$/i);
  if (!match || match[1].length > 4096) return null;

  const decoded = Buffer.from(match[1], "base64");
  if (
    decoded.toString("base64").replace(/=+$/, "") !==
    match[1].replace(/=+$/, "")
  )
    return null;

  const separator = decoded.indexOf(":");
  if (separator < 1) return null;

  const username = decoded.subarray(0, separator).toString("utf8");
  const password = decoded.subarray(separator + 1).toString("utf8");
  if (!username || !password || username.length > 100 || password.length > 256)
    return null;

  return { username, password };
}

function rejectBasic(response: Parameters<RequestHandler>[1]): void {
  response.setHeader(
    "WWW-Authenticate",
    'Basic realm="Insurance policies", charset="UTF-8"',
  );
  response
    .status(401)
    .json({ message: "Valid Management credentials required" });
}

/** Allows either the existing Management session or Basic auth for this read-only feed. */
export const requirePolicyReadAccess: RequestHandler = (
  request,
  response,
  next,
) => {
  const authorization = request.get("authorization");
  if (!authorization || !/^Basic(?:\s|$)/i.test(authorization)) {
    void adminCredentials
      .isSessionValid(
        request.session?.admin,
        request.session?.adminCredentialVersion,
      )
      .then((sessionValid) => {
        if (sessionValid) {
          request.user = { name: request.session!.admin! };
          next();
          return;
        }
        rejectBasic(response);
      })
      .catch(next);
    return;
  }

  const credentials = parseBasicCredentials(authorization);
  if (!credentials) {
    rejectBasic(response);
    return;
  }

  void adminCredentials
    .authenticate(credentials.username, credentials.password)
    .then((account) => {
      if (!account) {
        rejectBasic(response);
        return;
      }
      request.user = { name: account.username };
      next();
    })
    .catch(next);
};
