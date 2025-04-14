// SPDX-License-Identifier: MIT
// Contract for Project IDX Ping Emitter Example (April 13, 2025)
pragma solidity ^0.8.28; // Use a recent stable version, compatible with hardhat-toolbox

// Import Hardhat console for debugging (optional)
import "hardhat/console.sol";

contract PingEmitter {

    // Structure to hold ping information
    struct Ping {
        address pinger;    // The address of the user who sent the ping
        string message;    // The message content
        uint256 timestamp; // The Unix timestamp when the ping was recorded
    }

    // Array to store all pings chronologically
    Ping[] public allPings;

    // Event to notify off-chain applications (like your Firebase app) about new pings
    // Indexing 'pinger' allows filtering events by sender address efficiently
    event NewPing(
        address indexed pinger,
        string message,
        uint256 timestamp
    );

    // Function for users to submit a new ping
    function ping(string memory _message) public {
        // Basic input validation: ensure message is not empty
        require(bytes(_message).length > 0, "PingEmitter: Message cannot be empty.");

        // Optional: Log message details to Hardhat console during testing
        // console.log("New ping from %s with message '%s'", msg.sender, _message);

        // Create a new Ping struct in memory
        Ping memory newPing = Ping({
            pinger: msg.sender, // The address calling this function
            message: _message,  // The message passed as argument
            timestamp: block.timestamp // The timestamp of the current block
        });

        // Add the new ping to the storage array
        allPings.push(newPing);

        // Emit the NewPing event with the details
        emit NewPing(msg.sender, _message, block.timestamp);
    }

    // Function to retrieve all pings stored in the contract
    // 'view' indicates it doesn't modify contract state (no gas cost for calls, only for reads)
    function getAllPings() public view returns (Ping[] memory) {
        return allPings;
    }

    // Function to get the total number of pings
    function getTotalPings() public view returns (uint256) {
        return allPings.length;
    }
}