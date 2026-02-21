import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Scan',
    limit: 1000
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);

  const items = ctx.result.items || [];
  const totalCount = items.length;

  if (totalCount === 0) {
    return {
      totalCount: 0,
      totalVolume: 0.0,
      fraudRate: 0.0,
      avgRiskScore: 0,
      avgLatencyMs: 0
    };
  }

  let totalVolume = 0;
  let fraudCount = 0;
  let riskSum = 0;
  let latencySum = 0;

  for (const item of items) {
    totalVolume += parseFloat(item.amount) || 0;
    if (item.fraudFlag) fraudCount++;
    riskSum += parseInt(item.riskScore) || 0;
    latencySum += parseInt(item.processingLatencyMs) || 0;
  }

  return {
    totalCount,
    totalVolume: Math.round(totalVolume * 100) / 100,
    fraudRate: Math.round((fraudCount / totalCount) * 10000) / 100,
    avgRiskScore: Math.round(riskSum / totalCount),
    avgLatencyMs: Math.round(latencySum / totalCount)
  };
}
