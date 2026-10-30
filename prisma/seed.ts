import { seedAll } from "../lib/seed/demo";
import { db } from "../lib/db";

seedAll()
  .then(async () => {
    const n = await db.request.count();
    console.log(`Seeded ${n} synthetic requests.`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
