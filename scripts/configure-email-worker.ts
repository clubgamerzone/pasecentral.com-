import { database, type Tx } from "../src/lib/db";
import { demoMode, required } from "../src/lib/config";
import { execFileSync } from "node:child_process";

async function verifyApiBoundary() {
  const endpoint = `${required("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/http_request_queue?select=id&limit=0`;
  const key = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  let status: number, code: string;
  if (process.platform === "win32") {
    // Credentials stay in process env, not argv; use the working Windows HTTP client.
    const output = execFileSync(
      "pwsh.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$r=Invoke-WebRequest -Uri $env:PASE_API_PROBE_URL -Headers @{apikey=$env:PASE_API_PROBE_KEY;'Accept-Profile'='net'} -SkipHttpErrorCheck -TimeoutSec 20; $b=$r.Content|ConvertFrom-Json; @{status=$r.StatusCode;code=$b.code}|ConvertTo-Json -Compress",
      ],
      {
        env: {
          ...process.env,
          PASE_API_PROBE_URL: endpoint,
          PASE_API_PROBE_KEY: key,
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    ({ status, code } = JSON.parse(output));
  } else {
    const response = await fetch(endpoint, {
      headers: { apikey: key, "Accept-Profile": "net" },
      signal: AbortSignal.timeout(20000),
    });
    status = response.status;
    code = (await response.json()).code;
  }
  if (status !== 406 || code !== "PGRST106")
    throw new Error("El esquema net debe quedar fuera del Data API.");
}

// Cloud operation, not a core migration: pg_net/pg_cron are unavailable in PGlite.
async function main() {
  if (demoMode() || process.env.APP_ENVIRONMENT !== "staging")
    throw new Error("Requiere Supabase staging conectado.");
  const target = new URL(process.argv[2] ?? "");
  if (
    target.protocol !== "https:" ||
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    target.pathname !== "/"
  )
    throw new Error("Indica el origen HTTPS de la aplicación.");
  if (!process.argv.includes("--apply"))
    throw new Error("Requiere --apply para configurar el scheduler.");
  const workerToken = required("WORKER_SECRET");
  await verifyApiBoundary();
  const db = await database();
  const permissions = (
    await db.query(
      "SELECT has_table_privilege('authenticated','vault.decrypted_secrets','SELECT') OR has_table_privilege('anon','vault.decrypted_secrets','SELECT') AS exposed",
    )
  ).rows[0];
  if (permissions.exposed)
    throw new Error("Vault no puede ser accesible al cliente.");
  await db.query("CREATE EXTENSION IF NOT EXISTS pg_cron");
  await db.query(
    "CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions",
  );
  // Managed pg_net grants cannot be revoked by postgres. Keep net out of Data API
  // and public SQL wrappers, and allow SQL LOGIN only to trusted services.
  const clientLogins = (
    await db.query(
      "SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') AND rolcanlogin",
    )
  ).rows;
  if (clientLogins.length)
    throw new Error("Los roles del cliente no deben tener LOGIN SQL.");
  await db.query("REVOKE ALL ON SCHEMA cron FROM PUBLIC,anon,authenticated");
  await db.query(
    "REVOKE ALL ON ALL TABLES IN SCHEMA cron FROM PUBLIC,anon,authenticated",
  );
  await db.query(
    "REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA cron FROM PUBLIC,anon,authenticated",
  );
  async function secret(tx: Tx, name: string, value: string) {
    const existing = (
      await tx.query("SELECT id FROM vault.secrets WHERE name=$1", [name])
    ).rows[0];
    if (existing)
      await tx.query("SELECT vault.update_secret($1,$2,$3,$4)", [
        existing.id,
        value,
        name,
        "Pase Central delivery worker",
      ]);
    else
      await tx.query("SELECT vault.create_secret($1,$2,$3)", [
        value,
        name,
        "Pase Central delivery worker",
      ]);
  }
  await db.transaction(async (tx) => {
    await secret(tx, "pasecentral_worker_url", `${target.origin}/api/worker`);
    await secret(tx, "pasecentral_worker_token", workerToken);
    const command = `SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='pasecentral_worker_url'),
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='pasecentral_worker_token')),
      body := '{}'::jsonb, timeout_milliseconds := 60000
    ) WHERE EXISTS (
      SELECT 1 FROM public.delivery_jobs
      WHERE (status IN ('pending','failed') AND next_attempt_at<=now() AND attempts<6)
         OR (status='processing' AND locked_at<now()-interval '10 minutes')
    )`;
    await tx.query("SELECT cron.schedule($1,$2,$3)", [
      "pasecentral-delivery",
      "* * * * *",
      command,
    ]);
    await tx.query(
      "SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='pasecentral-delivery'),active:=true)",
    );
  });
  const result = (
    await db.query(
      "SELECT jobname,schedule,active FROM cron.job WHERE jobname='pasecentral-delivery'",
    )
  ).rows[0];
  console.log(
    JSON.stringify({
      configured: true,
      ...result,
      tokenStoredInVault: true,
      requestsOnlyWhenJobsDue: true,
      netNotExposedThroughDataApi: true,
    }),
  );
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    // Never print connection URLs, parameters, SQL or credentials on a failure.
    console.error(
      "Configuración del worker fallida:",
      error instanceof Error ? error.name : "Error",
      (error as { code?: string }).code ?? "",
    );
    process.exit(1);
  });
