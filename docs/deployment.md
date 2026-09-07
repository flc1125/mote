# Deployment operations

[简体中文](zh-CN/deployment.md)

This guide is for maintainers operating the checked-in Access deployment workflows. Complete the [environment setup](self-hosting.md#deployment-automation) first. Workflow availability does not mean an environment is approved for production.

## Choose an entry

- **Deploy**: in GitHub Actions, select the workflow on `main`, choose the environment, and provide `main`, a stable `vX.Y.Z` tag, or a full main-history SHA. Leave `write_smoke=false` unless a permanent public test publication is explicitly intended.
- **Release**: a pushed stable version tag deploys production and runs read smoke checks before npm publication and GitHub Release finalization. Prerelease tags are rejected. Confirm the tag, package version, changelog and environment readiness before pushing; never use a production-triggering tag for a rehearsal.

Both paths require reviewed target configuration, pre-existing infrastructure, environment credentials and an enabled deployment gate. A historical SHA must still satisfy current source and configuration checks; it is not an unrestricted rollback mechanism.

## Validate a rollout

Treat the source commit SHA as the deployment identity across the production Workers. After an automated rollout, record each Worker's build, resulting version and source SHA. Do not accept the rollout until `mote-api` and `mote-viewer` both match the expected SHA and the health, authentication, publishing and anonymous-read checks pass.

The Workers deploy independently, so a temporary mixed-version window is expected. Changes that cross the API, CLI or Viewer boundary must remain backward compatible until both production Workers converge on the same commit.

## Inspect a failed run

Open the failed job and download its result artifacts. Keep the run ID, attempt, target SHA, manifest digest and component versions. Deployment results use `mote-deploy-result-<run-id>-<attempt>`; npm and Release results have separate artifacts. Never publish credentials or private document URLs in incident reports.

| Result                                                         | Required action                                                                                                                     |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Failure before upload                                          | Correct the prerequisite; do not assume a missing checkpoint proves nothing changed. Inspect the failed stage.                      |
| Viewer succeeded, API failed                                   | Inspect both current versions and the checkpoint. No automatic rollback occurs; mixed versions may remain active.                   |
| Both uploads succeeded, read smoke failed                      | Treat deployment as unaccepted. Check service responses and edge challenges; do not bypass authentication or mark smoke successful. |
| Upload or write outcome is `unknown`                           | Investigate before taking another action. A timeout can follow a successful write; do not blindly repeat it.                        |
| `STALE_RETRY`, `EXTERNAL_DEPLOYMENT_DRIFT` or `SUPERSEDED_RUN` | Stop the old run. Review the newer deployment and choose a new, approved action.                                                    |

## Rerun safely

After resolving a known failure, use **Re-run all jobs** on the original run. Recovery requires its original checkpoint, SHA and artifact digest; deleting artifacts or starting a new run is not equivalent. Successful components are skipped only after current versions match the checkpoint. Unknown uploads block recovery even if a version marker matches.

Release finalization requires fresh deployment evidence from the same attempt. Do not rerun only the npm or Release job. Existing identical publication results are reconciled; conflicting bytes or identity stop the workflow rather than being overwritten. An uncertain write smoke is not automatically repeated.

## Concurrency and manual recovery

Manual and tag deployments share an environment concurrency group (`mote-production` for production), with `cancel-in-progress=false`. This protects the active workflow; do not assume every pending run is guaranteed execution or ordering. Avoid concurrent out-of-band deployments, which bypass that lock.

For a manual rollback, obtain approval for the exact environment, Worker versions and configuration. Preserve the checkpoint's `beforeVersion` and `afterVersion` values, independently inspect current versions, and check API/Viewer compatibility before restoring either component. Version restoration is separate from DNS, routes, bindings, secrets and Access-policy recovery; review those explicitly. Do not remove Access protection while a publishing endpoint remains reachable.

Worker rollback does not restore or delete R2 data. After any approved recovery, verify both health endpoints, anonymous publish rejection and an existing document with its assets before declaring recovery complete. Verify real publishing separately when authorized. Keep the deployment gate disabled while unresolved failures are under investigation.
