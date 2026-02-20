// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ZGInferenceResult {
  content: string;
  model: string;
  provider: string;
  verified: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface CachedBroker {
  broker: any; // ZGComputeNetworkBroker (loaded dynamically to avoid CJS/ESM issues)
  providerAddress: string;
  model: string;
}

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

let cached: CachedBroker | null = null;
let initInFlight: Promise<CachedBroker | null> | null = null;

const ZG_RPC = "https://evmrpc-testnet.0g.ai";
const PREFERRED_MODELS = ["qwen-2.5-7b-instruct"];
const LEDGER_MIN_A0GI = 4;

// ---------------------------------------------------------------------------
// Broker init (lazy, cached)
// ---------------------------------------------------------------------------

export async function getZGBroker(): Promise<CachedBroker | null> {
  if (cached) return cached;
  // Deduplicate concurrent init calls
  if (initInFlight) return initInFlight;

  const key = process.env.ZG_PRIVATE_KEY;
  if (!key) {
    console.log("[0g-inference] ZG_PRIVATE_KEY not set, AI insight disabled");
    return null;
  }

  initInFlight = (async (): Promise<CachedBroker | null> => {
    try {
      // Dynamic imports to avoid CJS/ESM incompatibility in vitest
      const { ethers } = await import("ethers");
      const zgModule = await import("@0glabs/0g-serving-broker");
      const createBroker = zgModule.createZGComputeNetworkBroker ?? (zgModule as any).default?.createZGComputeNetworkBroker;
      if (!createBroker) throw new Error("Could not resolve createZGComputeNetworkBroker");

      const provider = new ethers.JsonRpcProvider(ZG_RPC);
      const wallet = new ethers.Wallet(key, provider);
      const broker = await createBroker(wallet);

      // Ensure ledger is funded
      try {
        await broker.ledger.getLedger();
      } catch {
        console.log("[0g-inference] No ledger found, adding", LEDGER_MIN_A0GI, "A0GI");
        await broker.ledger.addLedger(LEDGER_MIN_A0GI);
      }

      // Discover services (include unacknowledged so we can acknowledge)
      const services = await broker.inference.listService(0, 50, true);
      if (services.length === 0) {
        console.warn("[0g-inference] No services available on 0G network");
        return null;
      }

      // Pick best model: preferred first, then any available
      let chosen = services.find((s) =>
        PREFERRED_MODELS.some((m) => s.model.toLowerCase().includes(m))
      );
      if (!chosen) {
        chosen = services[0];
      }

      const providerAddress = chosen.provider;

      // Acknowledge provider signer (idempotent if already acknowledged)
      try {
        const acked = await broker.inference.acknowledged(providerAddress);
        if (!acked) {
          await broker.inference.acknowledgeProviderSigner(providerAddress);
          console.log("[0g-inference] Acknowledged provider", providerAddress);
        }
      } catch (e) {
        console.warn("[0g-inference] Acknowledge failed (may already be done):", (e as Error).message);
      }

      cached = { broker, providerAddress, model: chosen.model };
      console.log(`[0g-inference] Ready: model=${chosen.model} provider=${providerAddress}`);
      return cached;
    } catch (e) {
      console.error("[0g-inference] Init failed:", (e as Error).message);
      return null;
    } finally {
      initInFlight = null;
    }
  })();

  return initInFlight;
}

// ---------------------------------------------------------------------------
// Run inference
// ---------------------------------------------------------------------------

export async function runZGInference(prompt: string): Promise<ZGInferenceResult | null> {
  const ctx = await getZGBroker();
  if (!ctx) return null;

  const { broker, providerAddress } = ctx;

  try {
    const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
    const headers = await broker.inference.getRequestHeaders(providerAddress, prompt);

    const { OpenAI } = await import("openai");
    const openai = new OpenAI({
      baseURL: endpoint,
      apiKey: "",
      defaultHeaders: { ...headers } as Record<string, string>,
    });

    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 256,
    });

    const content = completion.choices[0]?.message?.content ?? "";

    // Verify response via 0G (returns boolean | null)
    let verified = false;
    try {
      const chatId = completion.id;
      const result = await broker.inference.processResponse(
        providerAddress,
        chatId,
        content,
      );
      verified = result === true;
    } catch (e) {
      console.warn("[0g-inference] Verification failed:", (e as Error).message);
    }

    return { content, model, provider: providerAddress, verified };
  } catch (e) {
    console.error("[0g-inference] Inference failed:", (e as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export function buildRiskPrompt(data: {
  legIds: number[];
  outcomes: string[];
  winProbability: number;
  kellyFraction: number;
  expectedValue: number;
  fairMultiplier: number;
  netMultiplier: number;
  edgeBps: number;
  warnings: string[];
  action: string;
  riskTolerance: string;
  stake: string;
}): string {
  return [
    "You are a concise sports betting risk analyst. Respond in 2-3 sentences max.",
    "",
    `Parlay: ${data.legIds.length} legs [${data.outcomes.join(", ")}]`,
    `Win probability: ${(data.winProbability * 100).toFixed(2)}%`,
    `Fair multiplier: ${data.fairMultiplier.toFixed(2)}x | Net multiplier: ${data.netMultiplier.toFixed(2)}x`,
    `Edge: ${data.edgeBps} bps | EV: ${data.expectedValue.toFixed(4)}`,
    `Kelly fraction: ${(data.kellyFraction * 100).toFixed(2)}% | Stake: ${data.stake} USDC`,
    `Risk tolerance: ${data.riskTolerance} | Action: ${data.action}`,
    data.warnings.length > 0 ? `Warnings: ${data.warnings.join("; ")}` : "",
    "",
    "Give a brief risk verdict: should the user proceed, reduce stake, or avoid? Why?",
  ]
    .filter(Boolean)
    .join("\n");
}
