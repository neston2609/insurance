import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publicRouter } from "./routes/public.routes";
import { initializeBusinessData } from "./domain/store";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);
const host =
  process.env.HOST ||
  (process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0");

app.disable("x-powered-by");
app.set("trust proxy", "loopback");

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "insurance-demo",
    time: new Date().toISOString(),
  });
});

app.use("/api/public", publicRouter);
app.use("/api", (_request, response) =>
  response.status(404).json({ message: "API endpoint not found" }),
);

app.use(["/manage", "/genesys"], (_request, response) => {
  response.status(404).send("Page not found");
});

if (process.env.NODE_ENV === "production") {
  const clientDir = path.resolve(__dirname, "..", "dist", "client");
  app.use(express.static(clientDir));
  app.use((_request, response) => {
    response.sendFile(path.join(clientDir, "index.html"));
  });
}

app.use(
  (
    error: Error & { status?: number },
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        message: error.issues[0]?.message || "Invalid input",
        issues: error.issues,
      });
      return;
    }
    const status = error.status ?? 500;
    if (status >= 500) console.error(error);
    response.status(status).json({
      message: status >= 500 ? "Unexpected server error" : error.message,
    });
  },
);

await initializeBusinessData();

app.listen(port, host, () => {
  console.log(`demo listening on ${host}:${port}`);
});
