import { parentPort, workerData } from "worker_threads";
import { BoardState } from "@shoki/board";
import { PieceModel } from "@creature-chess/models";

import { EnemyScenario } from "./scenario-generator";
import { testFormation } from "./win-rate-calculator";

type WorkerPayload = {
  myBoard: BoardState<PieceModel>;
  scenarios: EnemyScenario[];
  trialsPerScenario: number;
};

const { myBoard, scenarios, trialsPerScenario } = workerData as WorkerPayload;
const result = testFormation(myBoard, scenarios, trialsPerScenario);

parentPort?.postMessage(result);
