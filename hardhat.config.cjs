// hardhat.config.js
// Updated: Sunday, April 13, 2025 at 9:26 AM MST (Phoenix, AZ)

require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config(); // Loads environment variables from .env file

// Retrieve environment variables - ensure they are set in your .env file!
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0xkey"; // Use a placeholder if not set, but deployment will fail
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ""; // Optional: for contract verification

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28", // Matches the version you specified
  networks: {
    // Configuration for the local Hardhat Network node
    localhost: {
      url: "http://127.0.0.1:8545", // Default URL for `npx hardhat node`
      chainId: 1337, // Default chain ID for Hardhat Network
      // No specific accounts needed here usually, Hardhat Node provides them
    },
    // Configuration for the Sepolia test network
    sepolia: {
      url: SEPOLIA_RPC_URL, // Loaded from .env file
      accounts: PRIVATE_KEY !== "0xkey" ? [PRIVATE_KEY] : [], // Loaded from .env file
      chainId: 11155111, // Chain ID for Sepolia
    },
    // You can add configurations for other networks like mainnet here
    // mainnet: { ... }
  },
  etherscan: {
    // Optional: Configure Etherscan API key for contract verification
    // Run: npx hardhat verify --network sepolia YOUR_CONTRACT_ADDRESS
    apiKey: ETHERSCAN_API_KEY, // Loaded from .env file
  },
  // Hardhat Ignition specific settings (usually defaults are fine)
  ignition: {
    // Optional settings for Ignition can go here if needed
  }
};