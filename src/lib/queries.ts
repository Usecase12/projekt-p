import { queryOptions } from "@tanstack/react-query";

import { getDashboard, getHistory, getStock } from "./market.functions";

export const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => getDashboard(),
  staleTime: 5 * 60 * 1000,
});

export const stockQuery = (symbol: string) =>
  queryOptions({
    queryKey: ["stock", symbol],
    queryFn: () => getStock({ data: { symbol } }),
    staleTime: 5 * 60 * 1000,
  });

export const historyQuery = (symbol?: string) =>
  queryOptions({
    queryKey: ["history", symbol ?? "all"],
    queryFn: () => getHistory({ data: { symbol } }),
    staleTime: 60 * 1000,
  });
