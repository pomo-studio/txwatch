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

## Next corrective action

Choose one and keep contract explicit:

1. Authorize read queries for API key in schema/resolver auth policy (most aligned with current server route design).
2. Move `/api/txfeed` server query path from API key to IAM-signed request.

Next iteration for stronger HA behavior:

- Add primary -> DR transaction replication (or event replay) and re-run this drill with minimum DR record-count threshold.

Reference business query gate used post-fix:

```graphql
query Drill($limit:Int){ listTransactions(limit:$limit){ items{ transactionId } nextToken } }
```
