import { database } from "../src/lib/db";
import { deliver } from "../src/lib/delivery";
console.log(await deliver(await database()));
process.exit(0);
