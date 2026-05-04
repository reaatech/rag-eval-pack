/**
 * Gate module exports
 */

export { GateEngine } from './engine.js';
export { ThresholdGates, type ThresholdGateConfig } from './threshold-gates.js';
export { BaselineGates, type BaselineGateConfig } from './baseline-gates.js';
export {
  CIIntegration,
  type GitHubActionsOutput,
  type JUnitReport,
  type PRCommentData,
} from './ci-integration.js';
