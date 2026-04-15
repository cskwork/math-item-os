import("./helpers/db.ts")
  .then(() => {
    console.error("GUARD FAILED — import succeeded for non-test DB");
    process.exit(1);
  })
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("_test")) {
      console.log("GUARD OK: " + msg.slice(0, 120));
      process.exit(0);
    }
    console.error("GUARD UNEXPECTED: " + msg);
    process.exit(2);
  });
