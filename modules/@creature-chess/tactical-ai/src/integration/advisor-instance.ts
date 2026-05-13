import { PositioningAdvisor } from "../positioning-advisor/advisor";

let sharedAdvisor: PositioningAdvisor | null = null;
let initPromise: Promise<void> | null = null;

export const getPositioningAdvisor = async (): Promise<PositioningAdvisor> => {
  if (sharedAdvisor && sharedAdvisor.isReady()) {
    return sharedAdvisor;
  }

  if (initPromise) {
    await initPromise;
    return sharedAdvisor!;
  }

  const modelPath = process.env.RL_MODEL_PATH || "training/models/final";
  sharedAdvisor = new PositioningAdvisor();

  initPromise = sharedAdvisor.loadModel(modelPath).catch((err) => {
    console.warn("[TacticalAI] Failed to load RL model:", err.message);
    sharedAdvisor = null;
    initPromise = null;
    throw err;
  });

  await initPromise;
  console.log("[TacticalAI] Positioning Advisor ready");
  return sharedAdvisor;
};
