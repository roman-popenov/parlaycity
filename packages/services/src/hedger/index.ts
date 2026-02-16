import { Router } from "express";
import type { ExposureReport, HedgeAction } from "@parlaycity/shared";

// In-memory state
const hedgeActions: HedgeAction[] = [];
const exposureByLeg = new Map<number, bigint>();
let ticketCount = 0;

export interface IHedgeAdapter {
  hedge(ticketId: number, legId: number, amount: bigint): Promise<HedgeAction>;
}

/** Mock adapter that just logs and returns a simulated result */
class MockHedgeAdapter implements IHedgeAdapter {
  async hedge(ticketId: number, legId: number, amount: bigint): Promise<HedgeAction> {
    const action: HedgeAction = {
      ticketId,
      legId,
      amount: amount.toString(),
      action: "hedge",
      status: "simulated",
      timestamp: Math.floor(Date.now() / 1000),
    };
    console.log(`[Hedger] Simulated hedge: ticket=${ticketId} leg=${legId} amount=${amount}`);
    return action;
  }
}

const adapter: IHedgeAdapter = new MockHedgeAdapter();
const router = Router();

/** GET /exposure - current exposure report */
router.get("/", (_req, res) => {
  let totalExposure = 0n;
  const byLeg: Record<number, string> = {};
  for (const [legId, amount] of exposureByLeg.entries()) {
    totalExposure += amount;
    byLeg[legId] = amount.toString();
  }

  const report: ExposureReport = {
    totalExposure: totalExposure.toString(),
    ticketCount,
    byLeg,
    hedgeActions,
  };
  res.json(report);
});

/** POST /exposure/hedge/:ticketId - simulate a hedge for a ticket */
router.post("/hedge/:ticketId", async (req, res) => {
  const ticketId = parseInt(req.params.ticketId, 10);
  const { legId, amount } = req.body as { legId: number; amount: string };

  if (!legId || !amount) {
    return res.status(400).json({ error: "legId and amount are required" });
  }

  const amountBigInt = BigInt(amount);
  const action = await adapter.hedge(ticketId, legId, amountBigInt);

  // Track exposure
  const current = exposureByLeg.get(legId) ?? 0n;
  exposureByLeg.set(legId, current + amountBigInt);
  ticketCount++;
  hedgeActions.push(action);

  return res.json(action);
});

export default router;
