import { api } from "../lib/api.js";

/** Execute the real (simulated) tutorial buy of the house listing. */
export async function simulationBuy(quantity: string): Promise<void> {
  await api.post("/api/orders", {
    side: "BUY",
    symbol: "AADIDEV",
    quantity,
    clientRequestId: crypto.randomUUID(),
  });
}
