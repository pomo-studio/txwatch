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

## Results

- `baseline_primary`: PASS, `200`, `0.087270s`
- `cutover_dr`: PASS, `200`, `0.395420s`
- `rollback_primary`: PASS, `200`, `0.086517s`

Conclusion: endpoint-level failover path is operational and rollback-safe.

## Important finding (authorization gap)

Business read operations are currently not API-key authorized:

- `listTransactions` via API key -> GraphQL `Unauthorized`
- `getStats` via API key -> GraphQL `Unauthorized`

This matters because `app/server/api/txfeed.get.ts` currently expects API key auth for server-side feed queries.

## Next corrective action

Choose one and keep contract explicit:

1. Authorize read queries for API key in schema/resolver auth policy (most aligned with current server route design).
2. Move `/api/txfeed` server query path from API key to IAM-signed request.

After correction, rerun this same drill with a business query gate:

```graphql
query Drill($limit:Int){ listTransactions(limit:$limit){ items{ transactionId } nextToken } }
```
