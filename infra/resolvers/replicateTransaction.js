import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const input = ctx.args.input;

  return {
    operation: 'PutItem',
    key: {
      PK: util.dynamodb.toDynamoDB(`TX#${input.transactionId}`),
      SK: util.dynamodb.toDynamoDB(input.createdAt)
    },
    attributeValues: util.dynamodb.toMapValues({
      entity_type: 'TRANSACTION',
      ...input
    })
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return ctx.args.input;
}
