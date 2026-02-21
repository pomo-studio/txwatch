// Mutation resolver using NoneDataSource.
// The enricher Lambda calls this via AWS_IAM auth after writing to DynamoDB.
// AppSync automatically fires the onTransactionAdded subscription.

export function request(ctx) {
  return {
    payload: ctx.args.input
  };
}

export function response(ctx) {
  return ctx.result;
}
