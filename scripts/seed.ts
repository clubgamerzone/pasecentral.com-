import { database } from "../src/lib/db";
import { seed } from "../src/lib/seed";
import { demoMode } from "../src/lib/config";
if (!demoMode()) throw new Error("Seed ficticio solo permitido en modo demo.");
await seed(await database());
console.log("Datos demo disponibles.");
process.exit(0);
