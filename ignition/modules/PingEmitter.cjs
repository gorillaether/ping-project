// File: ignition/modules/PingEmitter.js
// Date: Sunday, April 13, 2025
const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

// The unique identifier for this deployment module.
// Hardhat Ignition uses this to track deployment state.
const PING_EMITTER_MODULE_ID = "PingEmitterModule";

module.exports = buildModule(PING_EMITTER_MODULE_ID, (m) => {
  // Log a message during the deployment process (optional)
  console.log("Starting deployment for PingEmitter contract...");

  // Use the module builder 'm' to define the contract deployment.
  // 'm.contract()' takes the contract name ("PingEmitter") as the first argument.
  // Since PingEmitter's constructor takes no arguments, the second argument is an empty array [].
  const pingEmitter = m.contract("PingEmitter", []);

  console.log("PingEmitter deployment definition complete.");

  // Return an object containing the deployed contract instance variable.
  // This allows other Ignition modules (if you had them) to depend on the
  // deployment of PingEmitter. For a single contract deployment, it confirms setup.
  return { pingEmitter };
});