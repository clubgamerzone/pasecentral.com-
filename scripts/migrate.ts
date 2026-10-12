import { database, migrate } from "../src/lib/db";
await migrate(await database());
console.log("Migraciones aplicadas.");
process.exit(0);
