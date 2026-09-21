import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/debug-fetch")({
  server: {
    handlers: {
      GET: async () => {
        const UA =
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";
        const stooq = await fetch("https://stooq.com/q/d/l/?s=aapl.us&i=d", {
          headers: { "User-Agent": UA },
        });
        const stooqBody = (await stooq.text()).slice(-200);
        const echo = { stooq: stooq.status, stooqBody };
        const y = await fetch(
          "https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=1y&interval=1d",
          { headers: { "User-Agent": UA, Accept: "application/json" } },
        );
        return new Response(
          JSON.stringify({ echo, yahoo: y.status, body: (await y.text()).slice(0, 300) }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
