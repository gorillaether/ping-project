// File: src/App.jsx
// Full rewrite incorporating ENS lookup and debugging console.log
// Date: Sunday, April 13, 2025 at 11:18 AM MST (Phoenix, AZ)

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css'; // Make sure you have basic CSS, or remove this line

// --- Configuration ---
// PASTE YOUR DEPLOYED CONTRACT ADDRESS HERE:
const contractAddress = "0x1c178D16BE81E36825199C3BbF44328462855dA7"; // <--- PASTE ADDRESS HERE

// PASTE THE ABI ARRAY YOU COPIED FROM PingEmitter.json HERE:
// Ensure this starts with '[' and ends with ']' and ONLY contains the ABI array elements
const contractABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "pinger",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "message",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "NewPing",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "allPings",
    "outputs": [
      {
        "internalType": "address",
        "name": "pinger",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "message",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllPings",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "pinger",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "message",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          }
        ],
        "internalType": "struct PingEmitter.Ping[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalPings",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_message",
        "type": "string"
      }
    ],
    "name": "ping",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Target Network Details (Sepolia)
const targetNetworkId = '0xaa36a7'; // Chain ID for Sepolia (11155111 in hex)
const targetNetworkName = 'Sepolia Testnet';
const targetNetworkDecimalId = 11155111;

function App() {
    // --- State Variables ---
    const [account, setAccount] = useState(null);
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [contract, setContract] = useState(null);
    const [network, setNetwork] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
    const [message, setMessage] = useState('');
    const [pings, setPings] = useState([]); // Will store objects like { pinger, message, timestamp, ensName }
    const [loadingPings, setLoadingPings] = useState(false);
    const [txStatus, setTxStatus] = useState(''); // For user feedback
    const [pinging, setPinging] = useState(false); // To disable button during tx

    // --- Core Functions ---

    // Function to connect wallet
    const connectWallet = async () => {
        setTxStatus(''); // Clear previous status
        setIsCorrectNetwork(false); // Reset network status
        setContract(null); // Reset contract
        setNetwork(null); // Reset network
        setAccount(null);
        setSigner(null);
        setIsConnected(false);


        if (typeof window.ethereum !== 'undefined') {
            try {
                console.log("Attempting to connect wallet...");
                // Create provider
                const web3Provider = new ethers.BrowserProvider(window.ethereum);
                setProvider(web3Provider); // Set provider state early

                console.log("Requesting accounts...");
                const accounts = await web3Provider.send("eth_requestAccounts", []);

                if (accounts && accounts.length > 0) {
                    const userAddress = accounts[0];
                    console.log("Accounts received:", userAddress);
                    setAccount(userAddress); // Set account state
                    setIsConnected(true); // Now connected

                    console.log("Getting signer...");
                    const currentSigner = await web3Provider.getSigner();
                    setSigner(currentSigner); // Set signer state
                    console.log("Signer obtained.");

                    console.log("Getting network information...");
                    let currentNetwork = null;
                    try {
                        // Wait briefly in case Metamask needs a moment after connection
                        await new Promise(resolve => setTimeout(resolve, 100));
                        currentNetwork = await web3Provider.getNetwork();
                        console.log("Result of provider.getNetwork():", currentNetwork); // Log the result directly
                    } catch (networkError) {
                        console.error("Error fetching network:", networkError);
                        setTxStatus(`Error getting network: ${networkError.message}`);
                        return; // Stop if network fetch fails
                    }

                    if (currentNetwork) {
                        setNetwork(currentNetwork); // Set network state
                        //checkNetwork(currentNetwork); // Check if it's the correct one & init contract
                    } else {
                        console.error("provider.getNetwork() returned null or undefined.");
                        setTxStatus('Could not detect network info.');
                        setIsCorrectNetwork(false);
                    }

                } else {
                    console.log("No accounts received.");
                    setTxStatus('No accounts found/approved.');
                }

            } catch (error) {
                console.error("Error during connectWallet:", error);
                 setTxStatus(`Connection Error: ${error.message || 'Unknown error'}`);
                // Reset everything on error
                 setIsConnected(false);
                 setIsCorrectNetwork(false);
                 setAccount(null);
                 setSigner(null);
                 setProvider(null);
                 setContract(null);
                 setNetwork(null);
            }
        } else {
             setTxStatus("Metamask not detected! Please install Metamask.");
            alert('Please install Metamask!');
        }
    };

     // Function to check if on correct network and setup contract
    const checkNetwork = (currentNetwork) => {
        if (!currentNetwork || typeof currentNetwork.chainId === 'undefined') {
            console.log("checkNetwork called with invalid network object:", currentNetwork);
            setIsCorrectNetwork(false);
            setContract(null);
            setTxStatus('Network undetectable.');
            return;
        }

        const currentChainId = currentNetwork.chainId;
        const targetChainIdBigInt = ethers.toBigInt(targetNetworkId);
        console.log(`Checking network: Reported=${currentChainId}, Target=${targetChainIdBigInt}`);

        const isOnTarget = currentChainId === targetChainIdBigInt;
        console.log("Is on target network?", isOnTarget);
        setIsCorrectNetwork(isOnTarget);

        if (isOnTarget) {
             setTxStatus('Connected to Sepolia.'); // Clear previous errors
            // Initialize contract ONLY if we have a signer
            if (signer) {
                try {
                    // Check if ABI is provided
                    if (!contractABI || contractABI.length === 0) {
                        throw new Error("Contract ABI is missing or empty. Please paste it into App.jsx.");
                    }
                    // Check if address is provided
                    if (!contractAddress || !ethers.isAddress(contractAddress) || contractAddress === "YOUR_DEPLOYED_CONTRACT_ADDRESS") {
                         throw new Error("Contract Address is missing, invalid, or still the placeholder value. Please add it to App.jsx.");
                    }
                    const contractInstance = new ethers.Contract(contractAddress, contractABI, signer);
                    setContract(contractInstance); // Set contract state
                    console.log("Contract initialized");
                    // Fetch pings using the newly created instance and provider state
                    fetchPings(contractInstance, provider);
                } catch (error) {
                     console.error("Error initializing contract:", error);
                     setTxStatus(`Error initializing contract: ${error.message}`);
                     setContract(null); // Ensure contract is null if init fails
                }
            } else {
                console.warn("On correct network, but signer not available yet to initialize contract.");
                setTxStatus("Wallet connected, signer pending..."); // Indicate waiting state
                 setContract(null); // Ensure contract is null if signer isn't ready
            }
        } else {
            setContract(null); // Clear contract if network is wrong
            setTxStatus(`Please switch Metamask to ${targetNetworkName} (Chain ID: ${targetNetworkDecimalId})`);
        }
    };

    // Updated fetchPings to accept instances or use state, includes ENS lookup
    const fetchPings = async (activeContract = contract, activeProvider = provider) => {
         if (!activeContract) {
             console.log("Fetch pings skipped: Contract not available.");
             // setPings([]); // Keep existing pings if contract becomes temporarily unavailable? Or clear? Let's clear.
             setPings([]);
             return;
        }
         if (!activeProvider) {
            console.log("Fetch pings: Provider not available for ENS lookup. Fetching raw pings only.");
             try {
                 const fetchedPingsRaw = await activeContract.getAllPings();
                 const formattedPings = fetchedPingsRaw.map(p => ({
                     pinger: p.pinger,
                     message: p.message,
                     timestamp: new Date(Number(p.timestamp) * 1000),
                     ensName: null // No provider, so ENS is null
                 })).reverse();
                 setPings(formattedPings);
                 setTxStatus("Pings loaded (ENS lookup skipped - provider missing).");
             } catch (error) {
                  console.error("Error fetching raw pings:", error);
                  setTxStatus(`Error fetching pings: ${error.message}`);
                  setPings([]);
             }
            return;
        }

        setLoadingPings(true);
        // Set status only if not already showing a more important message from connection/tx
        if (!txStatus || txStatus.includes('loaded') || txStatus.includes('No pings')) {
            setTxStatus('Fetching pings and resolving ENS names...');
        }
        console.log("Fetching pings & resolving ENS...");
        try {
            if (typeof activeContract.getAllPings !== 'function') {
                throw new Error("Contract ABI might be incorrect or contract not fully initialized. 'getAllPings' not found.");
            }
            const fetchedPingsRaw = await activeContract.getAllPings();
            console.log("Raw pings fetched:", fetchedPingsRaw.length);

            if (fetchedPingsRaw.length === 0) {
                setPings([]);
                setTxStatus('No pings found yet.');
                setLoadingPings(false);
                return;
            }

            // Resolve ENS names concurrently
            const enrichedPingsPromises = fetchedPingsRaw.map(async (rawPing) => {
                let ensName = null;
                try {
                    if (ethers.isAddress(rawPing.pinger)) {
                        // Simpler lookup without timeout for now
                        ensName = await activeProvider.lookupAddress(rawPing.pinger);
                    }
                } catch (ensError) {
                    console.warn(`ENS lookup failed for ${rawPing.pinger}:`, ensError.message);
                    ensName = null;
                }
                return {
                    pinger: rawPing.pinger,
                    message: rawPing.message,
                    timestamp: new Date(Number(rawPing.timestamp) * 1000),
                    ensName: ensName
                };
            });

            const enrichedPings = await Promise.all(enrichedPingsPromises);

            setPings(enrichedPings.reverse()); // Show newest first
            setTxStatus(enrichedPings.length > 0 ? 'Pings loaded.' : 'No pings found yet.');
            console.log("Enriched pings with ENS:", enrichedPings);

        } catch (error) {
            console.error("Error during fetchPings:", error);
            setTxStatus(`Error fetching pings: ${error.message}`);
            setPings([]); // Clear pings on error
        } finally {
            setLoadingPings(false);
        }
    };

    // Function to send a ping
    const sendPing = async () => {
        // Use contract from state
        if (!contract || !signer || !isCorrectNetwork) {
            alert("Please ensure your wallet is connected to Sepolia first.");
            return;
        }
        if (!message.trim()) {
            alert("Please enter a message.");
            return;
        }

        setPinging(true);
        setTxStatus('Sending ping... Please confirm in Metamask.');
        console.log(`Sending ping with message: "${message}"`);

        try {
             if (typeof contract.ping !== 'function') {
                throw new Error("Contract ABI might be incorrect or contract not fully initialized. 'ping' function not found.");
            }
            const tx = await contract.ping(message);
            setTxStatus(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);
            const receipt = await tx.wait(1); // Wait for 1 confirmation
            console.log("Transaction confirmed:", receipt);
             // Set status briefly, event listener should trigger fetch
             setTxStatus(`Ping successful! Confirmed in block ${receipt.blockNumber}.`);
             setTimeout(() => { if(txStatus.startsWith('Ping successful!')) setTxStatus(''); }, 5000); // Clear status after 5s
            setMessage(''); // Clear input
        } catch (error) {
            console.error("Error sending ping:", error);
            const userRejected = error.code === 4001 || (error.message && error.message.includes('User rejected'));
            setTxStatus(`Error sending ping: ${userRejected ? 'Transaction rejected by user.' : error.message}`);
        } finally {
            setPinging(false);
        }
    };

    // --- Effect Hooks ---

    // Effect to check network and initialize contract when relevant states change
    // This runs after initial connection and also if account/signer/provider change later
    useEffect(() => {
        if (provider && account && signer) {
            console.log("Effect triggered: Checking network state due to provider/account/signer change.");
            provider.getNetwork().then(net => {
                if(net) {
                    setNetwork(net); // Update network state
                    checkNetwork(net); // Check network and init contract if correct
                } else {
                    console.error("Could not get network in useEffect for checking");
                    setTxStatus("Failed to get network details on update.");
                    setIsCorrectNetwork(false);
                    setContract(null);
                }
            }).catch(err => {
                console.error("Error getting network in useEffect for checking:", err);
                setTxStatus(`Error getting network details: ${err.message}`);
                setIsCorrectNetwork(false);
                setContract(null);
            });
        }
        // Clear contract if prerequisites are lost
        else if (!account || !signer || !provider) {
            console.log("Effect triggered: Clearing contract due to missing provider/account/signer.");
            setContract(null);
            setIsCorrectNetwork(false);
            setNetwork(null);
        }
    }, [signer, provider, account]); // Dependencies


    // Effect Hook for Contract Event Listener
    useEffect(() => {
        // Only setup listener if the contract instance is valid and ready
        if (contract && typeof contract.on === 'function' && isCorrectNetwork) {
             console.log("Setting up NewPing event listener on contract instance");
             const listener = (pinger, msg, timestamp, event) => {
                 console.log("NewPing event received via listener:", { pinger, msg, timestamp: Number(timestamp) });
                 setTxStatus('New ping received via event! Refreshing list...');
                 // Re-fetch all pings including ENS resolution
                 fetchPings(contract, provider); // Pass current contract/provider
                 // Clear status message after a delay, only if it hasn't been overwritten
                 setTimeout(() => { setTxStatus(currentStatus => currentStatus === 'New ping received via event! Refreshing list...' ? '' : currentStatus); }, 5000);
             };

             try {
                 contract.on("NewPing", listener);
                 console.log("Listening for NewPing events.");
             } catch (error) {
                  console.error("Error attaching NewPing listener:", error);
                  setTxStatus(`Error setting up listener: ${error.message}`);
             }

            // Cleanup function
            return () => {
                if (contract && typeof contract.off === 'function') {
                     console.log("Cleaning up NewPing event listener");
                    try {
                         contract.off("NewPing", listener);
                    } catch (cleanupError) {
                         console.error("Error cleaning up listener:", cleanupError);
                    }
                }
            };
        } else {
            // Optionally log why listener isn't setup
            // console.log("Event listener setup skipped: contract/isCorrectNetwork state not ready.", { contractReady: !!contract, isCorrectNetwork });
        }
    // Dependencies: Re-run when contract, signer, or network status changes.
    }, [contract, isCorrectNetwork, provider, signer]); // Added provider/signer here too


    // Effect Hook to handle Metamask account/network changes initiated by the user in Metamask
    useEffect(() => {
        if (window.ethereum && typeof window.ethereum.on === 'function') {
            const handleAccountsChanged = (accounts) => {
                console.log("Metamask accounts changed:", accounts);
                if (accounts.length === 0) {
                     console.log("Wallet disconnected via Metamask.");
                     // Reset all state
                     setAccount(null); setSigner(null); setContract(null);
                     setIsConnected(false); setIsCorrectNetwork(false);
                     setNetwork(null); setProvider(null); setPings([]);
                     setTxStatus("Wallet disconnected. Please connect.");
                } else if (accounts[0] !== account) { // If account changed
                     console.log("Account switched. Re-connecting...");
                    // Re-run connection logic for the new account
                    connectWallet();
                }
            };

            const handleChainChanged = (chainId) => {
                console.log("Metamask network changed to:", chainId);
                 // Reloading is the simplest way to ensure app state matches wallet state
                 window.location.reload();
            };

            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);
            console.log("Metamask event listeners added.");

            // Cleanup listeners
            return () => {
                if (typeof window.ethereum.removeListener === 'function') {
                     console.log("Cleaning up Metamask event listeners.");
                     window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                     window.ethereum.removeListener('chainChanged', handleChainChanged);
                }
            };
        } else {
             console.log("window.ethereum or window.ethereum.on not available for event listeners.");
        }
    }, [account, provider]); // Re-add listeners if provider changes, check against current account


    // --- JSX Rendering ---

    // Debugging log added here
    console.log("Rendering check:", { isConnected, isCorrectNetwork, contract: contract !== null });


    return (
        <div className="App" style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h1>Ping the Blockchain! (React Version)</h1>

            <div id="connection" style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ddd' }}>
                {!isConnected ? (
                    <button onClick={connectWallet}>Connect Wallet</button>
                ) : (
                    <button disabled>Wallet Connected</button>
                )}
                <p>Status: <span style={{ fontWeight: 'bold', color: isConnected ? (isCorrectNetwork ? 'green' : 'red') : 'grey' }}>
                    {isConnected ? (isCorrectNetwork ? 'Connected to Sepolia' : 'WRONG NETWORK!') : 'Not Connected'}
                  </span></p>
                <p>Wallet Address: {account || 'N/A'}</p>
                <p>Network: {network ? `${network.name || 'Unknown'} (ID: ${network.chainId})` : 'N/A'}</p>
            </div>

            {/* Display Transaction/Status Messages */}
            {txStatus && <p style={{ color: txStatus.toLowerCase().includes('error') || txStatus.includes('WRONG') || txStatus.includes('Please') || txStatus.includes('Fail') ? 'red' : 'green', marginTop: '10px', border: '1px solid lightgrey', padding: '5px', background: '#f8f8f8' }}>{txStatus}</p>}

             {/* Interaction Section - Show if connected to the correct network */}
             {isConnected && isCorrectNetwork && (
                <div id="interaction" style={{ marginTop: '20px' }}>
                    <hr />
                    {/* Only show Send Ping section if contract is also initialized */}
                    {contract ? (
                        <> {/* Use React Fragment */}
                        <h2>Send a Ping</h2>
                        <div>
                            <input
                                type="text"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Enter your message"
                                disabled={pinging}
                                style={{ marginRight: '10px', padding: '8px', minWidth: '300px' }}
                            />
                            <button onClick={sendPing} disabled={pinging || !message.trim()} style={{ padding: '8px 15px' }}>
                            {pinging ? 'Pinging...' : 'Send Ping'}
                            </button>
                        </div>
                        </>
                    ) : (
                        // Show a message if contract isn't ready yet but network is okay
                        <p style={{ fontStyle: 'italic', color: 'orange', marginTop: '20px' }}>Initializing contract interface...</p>
                    )}


                    <h2 style={{ marginTop: '30px' }}>Activity Log</h2>
                    {/* Fetch button only enabled if contract is ready */}
                    <button onClick={() => fetchPings()} disabled={loadingPings || !contract} style={{ padding: '8px 15px' }}>
                        {loadingPings ? 'Refreshing...' : 'Refresh Pings'}
                    </button>
                    <div id="pings" style={{ marginTop: '10px', maxHeight: '400px', overflowY: 'auto', border: '1px solid #eee', padding: '10px' }}>
                        {loadingPings && <p>Loading pings...</p>}
                        {!loadingPings && pings.length === 0 && <p>No pings found yet.</p>}
                        {!loadingPings && pings.map((ping, index) => (
                            <div key={`${ping.pinger}-${Number(ping.timestamp)}-${index}`} style={{ borderBottom: '1px dashed #ccc', marginBottom: '10px', padding: '10px 0', wordWrap: 'break-word' }}>
                                <p style={{ margin: '2px 0' }}>
                                    <strong>From:</strong>{' '}
                                    <a href={`https://sepolia.etherscan.io/address/${ping.pinger}`} target="_blank" rel="noopener noreferrer" title={ping.pinger}>
                                        {/* Conditionally display ENS name or fallback to address */}
                                        {ping.ensName ?
                                            `${ping.ensName} (${ping.pinger.substring(0, 6)}...${ping.pinger.substring(ping.pinger.length - 4)})`
                                            : ping.pinger
                                        }
                                    </a>
                                </p>
                                <p style={{ margin: '2px 0' }}><strong>Message:</strong> {ping.message}</p>
                                <p style={{ margin: '2px 0', fontSize: '0.9em', color: '#555' }}><strong>Time:</strong> {ping.timestamp.toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Show specific message if connected but on wrong network */}
            {isConnected && !isCorrectNetwork && network && (
                 <p style={{color: 'red', marginTop: '20px'}}>Please switch Metamask to the {targetNetworkName} network.</p>
             )}
        </div>
    );
}

export default App;