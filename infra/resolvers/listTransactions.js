import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Query',
    index: 'AllTransactionsIndex',
    query: {
      expression: 'entity_type = :et',
      expressionValues: { ':et': util.dynamodb.toDynamoDB('TRANSACTION') }
    },
    scanIndexForward: false,
    limit: ctx.args.limit || 20,
    nextToken: ctx.args.nextToken || null
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return {
    items: ctx.result.items,
    nextToken: ctx.result.nextToken
  };
}
