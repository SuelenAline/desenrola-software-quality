import { loadEnvFile } from "node:process";
import { createRequire } from "node:module";
loadEnvFile("../backend/.env");
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error("Os testes usam somente um banco local.");
const require = createRequire(
  new URL("../../backend/package.json", import.meta.url),
);
const { NestFactory } = require("@nestjs/core");
const { AppModule } = await import("../../backend/dist/app.module.js");
const { configureApp } = await import("../../backend/dist/configure-app.js");
const app = await NestFactory.create(AppModule, { logger: ["error"] });
configureApp(app);
await app.listen(3101, "127.0.0.1");
