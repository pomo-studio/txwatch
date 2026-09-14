# TxWatch AppSync Failover Drill - 2026-02-23

## Scope

- Objective: validate operator cutover path for AppSync endpoints (primary -> DR -> primary).
- Environment: production txwatch endpoints from `config/infra-outputs.json`.
- Auth mode used for drill: API key from `app_config.value.appsync.{api_key_id,dr_api_key_id}` value suffix (`da2-*`).

## Drill sequence

1. Baseline on primary endpoint.
2. Cutover to DR endpoint.
3. Roll back to primary endpoint.

Health probe used:

```graphql
query Health { __typename }
```

## Results (health probe)

- `baseline_primary`: PASS, `200`, `0.087270s`
- `cutover_dr`: PASS, `200`, `0.395420s`
- `rollback_primary`: PASS, `200`, `0.086517s`

Conclusion: endpoint-level failover path is operational and rollback-safe.

## Important finding (authorization gap)

Business read operations are currently not API-key authorized:

- `listTransactions` via API key -> GraphQL `Unauthorized`
- `getStats` via API key -> GraphQL `Unauthorized`

This mattered because `app/server/api/txfeed.get.ts` expects API key auth for server-side feed queries.

## Corrective action applied

- Updated `infra/schema.graphql` auth directives to explicitly allow API key/IAM/Cognito on read-query path:
  - `Query.listTransactions`
  - `Query.getStats`
  - `TransactionConnection` type
  - `Stats` type
- Terraform apply run: `run-gKjSYphBu91auQcN` (`applied`).

## Results (business-query gate after fix)

Probe used:

```graphql
query Drill($limit:Int){ listTransactions(limit:$limit){ items{ transactionId processingRegion createdAt } nextToken } }
```

- `baseline_primary`: PASS, `200`, `0.174312s`, `count=3`, `firstRegion=us-east-1`
- `cutover_dr`: PASS, `200`, `0.440226s`, `count=0`, `firstRegion=n/a`
- `rollback_primary`: PASS, `200`, `0.150620s`, `count=3`, `firstRegion=us-east-1`

Interpretation:

- Query authorization is fixed (no GraphQL `Unauthorized` after cutover).
- DR endpoint availability is verified.
- DR data parity is not guaranteed in current txwatch topology (expected at this stage; no cross-region transaction replication in place).

## Follow-up execution (same session)

### Attempt A: direct Lambda dual-write to DR DynamoDB

- Implemented dual-write logic in enricher Lambda and deployed (`run-bSVbrewpvCRkBcpX`, `run-Vwv14fTMuiSvt6ay`, both `applied`).
- Outcome: DR query counts remained `0` across repeated drill windows.

### Attempt B: global-table read parity

- Tried moving DR read path to a DynamoDB global-table replica.
- Initial apply failed due Terraform role permission gap while managing replica PITR:
  - `dynamodb:UpdateContinuousBackups` denied in `us-west-2`.
  - Evidence: errored run `run-T8HJ4Qqw9sX5DR7S`.
- Subsequent config realignment completed with stream setting fix and new run applied (`run-Cw95eLbwvFDTcpy9`).

### Attempt C: DR AppSync mutation replication

- Added `replicateTransaction` mutation (`@aws_iam`) and DR resolver (`infra/resolvers/replicateTransaction.js`) writing to `txwatch-transactions-dr`.
- Updated enricher to call DR AppSync mutation after primary notify.
- Deployment included in applied run `run-Cw95eLbwvFDTcpy9`.
- Outcome: DR endpoint stays healthy, but business-query drill still reports `count=0` on DR.

## Current status

- **Confirmed good**: endpoint cutover + rollback health checks.
- **Confirmed good**: API-key authorization for server-side read queries.
- **Resolved in-session**: DR data parity now observable via `listTransactions`.

Root cause discovered:

- `infra/lambda/enricher/index.js` had DR replication logic, but deployed Lambda still used stale `infra/lambda/enricher/bundle.js`.
- Bundle was rebuilt from source and deployed.

Deployment run:

- `run-d6EjAdZYLJjvMsYY` (`applied`) — refreshed enricher bundle with DR replication logic.

Post-fix parity verification:

- `baseline_primary`: PASS, `200`, `0.136384s`, `count=5`, `firstTx=56e99954-2f53-4fa0-9ff7-02937b6c1433`
- `cutover_dr`: PASS, `200`, `0.305775s`, `count=1`, `firstTx=56e99954-2f53-4fa0-9ff7-02937b6c1433`
- `rollback_primary`: PASS, `200`, `0.153834s`, `count=5`, `firstTx=56e99954-2f53-4fa0-9ff7-02937b6c1433`

Interpretation:

- DR endpoint is healthy.
- DR query auth is healthy.
- DR data parity path is operational (same transaction ID visible in DR).

Reference business query gate:

```graphql
query Drill($limit:Int){ listTransactions(limit:$limit){ items{ transactionId } nextToken } }
```
