// Subscription resolver — fires automatically when notifyTransaction mutation runs.
// Uses NoneDataSource; no data source call needed.

export function request(ctx) {
  return {
    payload: null
  };
}

export function response(ctx) {
  return ctx.result;
}
