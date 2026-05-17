/**
 * Gate module exports
 */

export { type BaselineGateConfig, BaselineGates } from './baseline-gates.js';
export {
  CIIntegration,
  type GitHubActionsOutput,
  type JUnitReport,
  type PRCommentData,
} from './ci-integration.js';
export { GateEngine } from './engine.js';
export { type ThresholdGateConfig, ThresholdGates } from './threshold-gates.js';
