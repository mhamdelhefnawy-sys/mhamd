import "dotenv/config";
import { app } from "./app";
import { prisma } from "./lib/prisma";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// A single unhandled error must not take down the whole API silently. Log it
// with full context, then exit so a process manager (pm2/systemd/Docker
// restart policy) restarts into a clean state rather than limping along with
// possibly-corrupted in-memory state.
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled promise rejection:", reason);
  process.exit(1);
});

const server = app.listen(PORT, () => {
  console.log(`Construction Cost Control API listening on port ${PORT}`);
});

// Finishes in-flight requests and closes the DB pool cleanly on deploys/restarts
// instead of dropping connections mid-request.
function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Force-exit if graceful shutdown hangs (e.g. a request never completes).
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
