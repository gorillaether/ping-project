import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// Material-UI Components
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack'; // For simplified layout spacing
import CircularProgress from '@mui/material/CircularProgress'; // For loading indicator

// --- Configuration ---
// PASTE YOUR DEPLOYED CONTRACT ADDRESS HERE:
const contractAddress = "0x1c178D16BE81E36825199C3BbF44328462855dA7"; // <--- PASTE ADDRESS HERE (e.g., "0x...")

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
]; // <--- ENSURE YOUR ABI IS CORRECTLY PASTED HERE

// Target Network Details (Sepolia)
const targetNetworkId = '0xaa36a7'; // Chain ID for Sepolia (11155111 in hex)
const targetNetworkName = 'Sepolia Testnet';
const targetNetworkDecimalId = 11155111;
// --- End Configuration ---

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
    const [pings, setPings] = useState([]); // Stores { pinger, message, timestamp, ensName }
    const [loadingPings, setLoadingPings] = useState(false);
    const [txStatus, setTxStatus] = useState(''); // User feedback messages
    const [pinging, setPinging] = useState(false); // Disable button during tx

    // --- Helper Functions ---

    // Determine Alert severity based on status message content
    const getAlertSeverity = (status) => {
        if (!status) return 'info'; // Handle empty status
        const lowerStatus = status.toLowerCase();
        if (lowerStatus.includes('error') || lowerStatus.includes('fail') || lowerStatus.includes('wrong') || lowerStatus.includes('please switch') || lowerStatus.includes('rejected')) {
            return 'error';
        }
        if (lowerStatus.includes('success') || lowerStatus.includes('confirmed') || lowerStatus.includes('loaded') || lowerStatus.includes('received')) {
            return 'success';
        }
        if (lowerStatus.includes('sending') || lowerStatus.includes('waiting') || lowerStatus.includes('fetching') || lowerStatus.includes('initializing')) {
            return 'info';
        }
        return 'info'; // Default
    };

    // --- Core Logic Functions ---

    // Fetch Pings (including ENS resolution) - Memoized with useCallback
    const fetchPings = useCallback(async (activeContract, activeProvider) => {
        // Added explicit checks for activeContract/Provider passed as args
        if (!activeContract || !activeProvider) {
            console.warn("fetchPings called without active contract or provider.");
            // Decide if you want to clear or keep old pings when contract/provider unavailable
            // setPings([]); // Optional: Clear pings
            return;
        }

        setLoadingPings(true);
        // Avoid overwriting critical error messages with "fetching" message
        if (!txStatus || !getAlertSeverity(txStatus) === 'error') {
             setTxStatus('Fetching pings...');
        }

        try {
            // Check if the function exists on the contract instance
            if (typeof activeContract.getAllPings !== 'function') {
                throw new Error("Contract ABI might be incorrect or contract not fully initialized. 'getAllPings' function not found.");
            }
            const fetchedPingsRaw = await activeContract.getAllPings();

            if (!Array.isArray(fetchedPingsRaw)) {
                 throw new Error("getAllPings did not return an array.");
            }

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
                    // Basic check for valid address format before lookup
                    if (ethers.isAddress(rawPing.pinger)) {
                        // Use the passed activeProvider for lookup
                        ensName = await activeProvider.lookupAddress(rawPing.pinger);
                    }
                } catch (ensError) {
                    console.warn(`ENS lookup failed for ${rawPing.pinger}:`, ensError);
                    ensName = null; // Non-critical error
                }
                return {
                    pinger: rawPing.pinger,
                    message: rawPing.message,
                    // Ensure timestamp is treated as BigInt before converting
                    timestamp: new Date(Number(ethers.toBigInt(rawPing.timestamp)) * 1000),
                    ensName: ensName || null // Ensure it's null if lookup fails or returns empty
                };
            });

            const enrichedPings = await Promise.all(enrichedPingsPromises);

            setPings(enrichedPings.slice().reverse()); // Show newest first (use slice to avoid mutating original if needed elsewhere)
            setTxStatus(enrichedPings.length > 0 ? `${enrichedPings.length} pings loaded.` : 'No pings found yet.');

        } catch (error) {
            console.error("Error during fetchPings:", error);
            setTxStatus(`Error fetching pings: ${error.message || 'Unknown error'}`);
            setPings([]); // Clear pings on error
        } finally {
            setLoadingPings(false);
        }
    }, [txStatus]); // Dependency: txStatus to avoid overwriting errors (consider removing if causing issues)

    // Check Network and Initialize Contract - Memoized with useCallback
    const checkNetwork = useCallback(async (currentProvider, currentSigner) => {
         // Explicitly check for provider presence
         if (!currentProvider) {
             setTxStatus("Provider not available for network check.");
             setIsCorrectNetwork(false);
             setContract(null);
             setNetwork(null);
             return false;
         }

         try {
             const currentNetwork = await currentProvider.getNetwork();
             setNetwork(currentNetwork); // Update network state

             if (!currentNetwork || typeof currentNetwork.chainId === 'undefined') {
                setIsCorrectNetwork(false);
                setContract(null);
                setTxStatus('Network undetectable.');
                return false; // Indicate failure
            }

            const currentChainId = currentNetwork.chainId;
            // Convert target hex ID string to BigInt for comparison
            const targetChainIdBigInt = ethers.toBigInt(targetNetworkId);

            const isOnTarget = currentChainId === targetChainIdBigInt;
            setIsCorrectNetwork(isOnTarget);

            if (isOnTarget) {
                // Only initialize contract if also on the correct network AND signer is available
                if (currentSigner) {
                    setTxStatus('Connected to Sepolia. Initializing contract...');
                    try {
                        // Validate Address and ABI before creating instance
                        if (!contractAddress || !ethers.isAddress(contractAddress) || contractAddress === "YOUR_DEPLOYED_CONTRACT_ADDRESS_HERE") {
                            throw new Error("Contract Address is missing, invalid, or still the placeholder value.");
                        }
                         if (!contractABI || !Array.isArray(contractABI) || contractABI.length === 0) {
                            throw new Error("Contract ABI is missing or empty.");
                        }

                        const contractInstance = new ethers.Contract(contractAddress, contractABI, currentSigner);
                        setContract(contractInstance);
                        // Fetch pings immediately after successful contract init
                        // Pass the newly created instances directly
                        await fetchPings(contractInstance, currentProvider);
                        return true; // Indicate success
                    } catch (error) {
                        console.error("Error initializing contract:", error);
                        setTxStatus(`Error initializing contract: ${error.message}`);
                        setContract(null); // Nullify contract on error
                        return false; // Indicate failure
                    }
                } else {
                    // Correct network, but signer isn't ready (might happen briefly)
                    setTxStatus("Connected to Sepolia, waiting for signer to initialize contract...");
                    setContract(null);
                    return false; // Signer not ready
                }
            } else {
                // Wrong network
                setContract(null); // Nullify contract
                setPings([]); // Clear pings
                setTxStatus(`Please switch Metamask to ${targetNetworkName} (Chain ID: ${targetNetworkDecimalId})`);
                return false; // Indicate wrong network
            }
         } catch (networkError) {
            console.error("Error getting network details:", networkError);
            setTxStatus(`Error checking network: ${networkError.message}`);
            setIsCorrectNetwork(false);
            setContract(null);
            setNetwork(null);
            return false;
         }
    }, [fetchPings]); // Dependencies: fetchPings

    // Connect Wallet Function (Corrected Scope & Initialization Order)
    const connectWallet = async () => {
        // Reset states for clean connection attempt
        setTxStatus('Connecting...');
        setIsConnected(false);
        setIsCorrectNetwork(false);
        setAccount(null);
        setSigner(null);
        setProvider(null);
        setContract(null);
        setNetwork(null);
        setPings([]);

        if (typeof window.ethereum === 'undefined') {
            setTxStatus("Metamask not detected! Please install Metamask.");
            alert('Please install Metamask!');
            return;
        }

        try {
            // Create provider instance
            const web3Provider = new ethers.BrowserProvider(window.ethereum, 'any'); // 'any' helps listen for network changes

            // Request accounts first
            const accounts = await web3Provider.send("eth_requestAccounts", []);

            if (!accounts || accounts.length === 0) {
                setTxStatus('Connection rejected or no accounts approved.');
                return; // Exit if no accounts approved
            }
            const userAddress = accounts[0];
            setAccount(userAddress); // Set account state

            // Get Signer AFTER accounts are approved
            const fetchedSigner = await web3Provider.getSigner();
            setSigner(fetchedSigner); // Set signer state

            // Set provider state AFTER successful connection
            setProvider(web3Provider);

            // Set connected flag AFTER essential states are set
            setIsConnected(true);

            // Check network and initialize contract AFTER provider and signer are set
            // Pass the instances directly to avoid stale state issues
            await checkNetwork(web3Provider, fetchedSigner);

            // Update status after checks are done (checkNetwork sets its own status)
            // setTxStatus('Wallet connected successfully.'); // Optional: can rely on checkNetwork status

        } catch (error) {
            console.error("Wallet connection error:", error);
            if (error.code === 4001) { // EIP-1193 user rejected request error
                 setTxStatus('Connection request rejected by user.');
            } else {
                 setTxStatus(`Error connecting wallet: ${error.message || 'Unknown error'}`);
            }
            // Ensure cleanup on error
            setIsConnected(false);
            setAccount(null);
            setSigner(null);
            setProvider(null);
            setContract(null);
            setNetwork(null);
        }
     }; // End connectWallet

    // Send Ping Function
    const sendPing = async () => {
        // Check all prerequisites
        if (!contract) {
             setTxStatus("Contract not initialized. Cannot send ping.");
             return;
        }
         if (!signer) {
             setTxStatus("Wallet signer not available. Cannot send ping.");
             return;
         }
        if (!isCorrectNetwork) {
            setTxStatus(`Cannot send ping: Please connect to ${targetNetworkName}.`);
            return;
        }
        if (!message.trim()) {
            setTxStatus("Please enter a message to send.");
            return;
        }

        setPinging(true);
        setTxStatus('Sending ping... Please confirm in Metamask.');

        try {
            // Verify the ping function exists on the contract instance
            if (typeof contract.ping !== 'function') {
                throw new Error("Contract ABI might be incorrect or contract instance invalid. 'ping' function not found.");
            }

            // Estimate gas (optional but recommended)
            // const estimatedGas = await contract.ping.estimateGas(message);
            // console.log("Estimated Gas:", estimatedGas.toString());

            // Send transaction
            const tx = await contract.ping(message);
            // const tx = await contract.ping(message, { gasLimit: estimatedGas }); // If using estimate

            setTxStatus(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);

            // Wait for 1 confirmation
            const receipt = await tx.wait(1);

            setTxStatus(`Ping successful! Confirmed in block ${receipt.blockNumber}. Tx: ${receipt.hash}`);
             // Clear message only on success
            setMessage('');

            // Optionally clear the success message after a delay
            setTimeout(() => {
                setTxStatus(currentStatus =>
                    (currentStatus && currentStatus.startsWith('Ping successful!')) ? '' : currentStatus
                );
            }, 7000); // Increased delay

            // Event listener should trigger fetchPings, but can call manually if needed
            // await fetchPings(contract, provider);

        } catch (error) {
            console.error("Error sending ping:", error);
            const userRejected = error.code === 4001 || (error.info?.error?.code === 4001) || (error.message && error.message.toLowerCase().includes('user rejected'));
            // Try to extract revert reason
            let reason = error.reason;
            if (!reason && error.data?.message) {
                reason = error.data.message;
            }
            if (!reason && error.info?.error?.message) {
                 reason = error.info.error.message;
            }
            if (!reason && userRejected) {
                reason = 'Transaction rejected by user.';
            }
            if (!reason) {
                 reason = error.message || 'Unknown error occurred.';
            }

            setTxStatus(`Error sending ping: ${reason}`);
        } finally {
            setPinging(false); // Re-enable button
        }
    }; // End sendPing

    // --- Effect Hooks ---

    // Effect: Check network and initialize contract when provider/signer/account potentially change
    // This effect primarily relies on connectWallet to set up provider/signer initially.
    // It serves as a backup check if states change independently.
    useEffect(() => {
        if (provider && signer && account) {
            // Re-check network status if dependencies change after initial connection
            checkNetwork(provider, signer);
        } else {
            // If essential components are missing, ensure disconnected state
            setIsConnected(false);
            setIsCorrectNetwork(false);
            setContract(null);
            // setTxStatus("Wallet disconnected or not fully initialized."); // Avoid setting status here if connectWallet handles it
        }
        // Add checkNetwork as dependency since it's memoized and depends on fetchPings
    }, [provider, signer, account, checkNetwork]);

    // Effect: Set up Contract Event Listener
    useEffect(() => {
        let eventListener;

        // Only set up listener if contract, provider exist and we are on the correct network
        if (contract && provider && isCorrectNetwork && typeof contract.on === 'function') {
             console.log("Setting up NewPing event listener...");

             eventListener = (pinger, msg, timestamp, event) => {
                 console.log("NewPing event received:", { pinger, msg, timestamp, event });
                 // Provide user feedback
                 setTxStatus(`New ping received from ${pinger.substring(0,6)}...! Refreshing list...`);
                 // Refresh the ping list using the current contract and provider instances
                 fetchPings(contract, provider);
                 // Optionally clear the "received" message after a delay
                 setTimeout(() => {
                     setTxStatus(currentStatus =>
                         (currentStatus && currentStatus.startsWith('New ping received')) ? '' : currentStatus
                     );
                 }, 7000); // Increased delay
             };

             try {
                 contract.on("NewPing", eventListener);
             } catch (error) {
                  console.error("Error attaching NewPing listener:", error);
                  setTxStatus(`Error setting up listener: ${error.message}`);
             }

            // Cleanup function: remove listener when component unmounts or dependencies change
            return () => {
                if (contract && typeof contract.off === 'function' && eventListener) {
                    try {
                         console.log("Removing NewPing event listener...");
                         contract.off("NewPing", eventListener);
                    } catch (cleanupError) {
                         console.error("Error cleaning up NewPing listener:", cleanupError);
                    }
                }
            };
        } else {
             console.log("Conditions not met for setting up event listener.");
             // No listener to set up or clean up if conditions aren't met
             return undefined; // Explicitly return undefined for clarity
        }
    // Dependencies: Re-run if contract, provider, network status, or fetchPings change
    }, [contract, provider, isCorrectNetwork, fetchPings]);

    // Effect: Handle Wallet's Account/Network Changes detected by Metamask
    useEffect(() => {
        // Ensure window.ethereum exists and has the 'on' method
        if (window.ethereum && typeof window.ethereum.on === 'function') {

            const handleAccountsChanged = (accounts) => {
                console.log('Metamask accountsChanged detected:', accounts);
                if (accounts.length === 0) {
                     // User disconnected wallet through Metamask UI
                     setTxStatus("Wallet disconnected. Please connect again.");
                     // Reset all relevant state
                     setIsConnected(false);
                     setIsCorrectNetwork(false);
                     setAccount(null);
                     setSigner(null);
                     setProvider(null);
                     setContract(null);
                     setNetwork(null);
                     setPings([]);
                } else if (accounts[0].toLowerCase() !== account?.toLowerCase()) {
                    // Account switched - treat like a new connection
                    setTxStatus("Account switched. Reconnecting...");
                    // Re-run the connection logic to get the new signer and check network
                    connectWallet();
                }
                // If account is the same, do nothing
            };

            const handleChainChanged = (_chainId) => {
                 console.log('Metamask chainChanged detected:', _chainId);
                 setTxStatus(`Network changed to ${_chainId}. Reloading application state...`);
                 // Simple approach: Re-run connection logic to get new provider/signer info & check network
                 // This assumes connectWallet handles resetting state correctly.
                 // Alternatively, window.location.reload() forces a full app reload. Choose based on desired UX.
                 connectWallet();
                 // window.location.reload(); // Use this if connectWallet doesn't fully reset everything needed
            };

            // Subscribe to events
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);

            // Cleanup function: Remove listeners when component unmounts
            return () => {
                if (window.ethereum.removeListener) {
                     console.log("Removing Metamask event listeners...");
                     window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                     window.ethereum.removeListener('chainChanged', handleChainChanged);
                }
            };
        } else {
             console.warn("window.ethereum not available for event listeners.");
             return undefined; // No listeners to clean up
        }
    }, [account]); // Dependency: re-run setup if account changes (for comparison in handleAccountsChanged)

    // --- JSX Rendering ---
    return (
        <>
            <CssBaseline /> {/* Apply MUI's baseline styles */}
            <Container maxWidth="md" sx={{ pt: 3, pb: 3 }}> {/* Add padding top/bottom */}
                <Stack spacing={3}> {/* Main vertical stack for layout */}

                    <Typography variant="h4" component="h1" gutterBottom align="center">
                        PingEmitter dApp ({targetNetworkName})
                    </Typography>

                    {/* --- Connection Status Section --- */}
                    <Paper elevation={2} sx={{ p: 2 }}>
                        {!isConnected ? (
                            <Box sx={{ textAlign: 'center' }}>
                                <Button variant="contained" color="primary" onClick={connectWallet}>
                                    Connect Wallet
                                </Button>
                                <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                                    Please connect your Metamask wallet.
                                </Typography>
                            </Box>
                        ) : (
                            <Stack spacing={1}>
                                <Typography variant="body1" component="div">
                                    Status:
                                    <Typography component="span"
                                        sx={{
                                            fontWeight: 'bold',
                                            color: isCorrectNetwork ? 'success.main' : 'error.main',
                                            ml: 0.5
                                        }}
                                    >
                                        {isCorrectNetwork ? `Connected to ${targetNetworkName}` : `WRONG NETWORK! Please switch to ${targetNetworkName}.`}
                                    </Typography>
                                </Typography>
                                <Typography variant="body2" sx={{ wordWrap: 'break-word' }}>
                                    Wallet Address: {account ? (
                                        <Link href={`https://sepolia.etherscan.io/address/${account}`} target="_blank" rel="noopener noreferrer" title="View on Sepolia Etherscan">
                                            {account}
                                        </Link>
                                    ) : (
                                        'N/A'
                                    )}
                                </Typography>
                                <Typography variant="caption" display="block" sx={{ color: 'text.secondary' }}>
                                    Current Network: {network ? `${network.name || 'Unknown'} (ID: ${network.chainId})` : 'N/A'}
                                </Typography>
                            </Stack>
                        )}
                    </Paper>
                    {/* --- End Connection Status Section --- */}

                    {/* --- Transaction/Status Message Display --- */}
                    {txStatus && (
                        <Alert severity={getAlertSeverity(txStatus)} sx={{ mt: 2, wordBreak: 'break-word' }}>
                            {txStatus}
                        </Alert>
                    )}
                    {/* --- End Status Message Display --- */}

                    {/* --- Interaction Section (Render only if connected and on correct network) --- */}
                    {isConnected && isCorrectNetwork && contract && (
                        <Box sx={{ mt: 2 }}>
                             <Stack spacing={3}>

                                {/* --- Send Ping Section --- */}
                                <Paper elevation={1} sx={{ p: 2 }}>
                                    <Typography variant="h6" component="h2" gutterBottom>
                                        Send Ping
                                    </Typography>
                                    <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }} alignItems="center">
                                        <TextField
                                            fullWidth
                                            label="Your Message"
                                            variant="outlined"
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            disabled={pinging} // Disable input while pinging
                                            size="small"
                                            sx={{ flexGrow: 1 }} // Allow text field to grow
                                        />
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            onClick={sendPing}
                                            disabled={pinging || !message.trim()} // Disable if pinging or message is empty/whitespace
                                            sx={{ minWidth: 120, flexShrink: 0 }} // Prevent button from shrinking too much
                                        >
                                            {pinging ? <CircularProgress size={24} color="inherit" /> : 'Send Ping'}
                                        </Button>
                                    </Stack>
                                </Paper>
                                {/* --- End Send Ping Section --- */}

                                {/* --- Activity Log Section --- */}
                                <Paper elevation={1} sx={{ p: 2 }}>
                                    <Stack spacing={2}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                            <Typography variant="h6" component="h2">
                                                Activity Log
                                            </Typography>
                                            <Button
                                                variant="outlined"
                                                onClick={() => fetchPings(contract, provider)} // Pass current instances
                                                disabled={loadingPings || !contract || !provider}
                                                size="small"
                                            >
                                                {loadingPings ? <CircularProgress size={20} /> : 'Refresh Pings'}
                                            </Button>
                                        </Box>

                                        <Box sx={{
                                            maxHeight: '400px', // Limit height
                                            overflowY: 'auto',  // Enable vertical scroll
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            p: 1,
                                            borderRadius: 1
                                        }}>
                                            {loadingPings && (
                                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                                                    <CircularProgress />
                                                </Box>
                                            )}
                                            {!loadingPings && pings.length === 0 && (
                                                <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                                                    No pings found yet. Send the first one!
                                                </Typography>
                                            )}
                                            {!loadingPings && pings.length > 0 && (
                                                <Stack spacing={1.5}>
                                                    {pings.map((ping, index) => (
                                                        // Added more robust key using tx hash or index if available, fallback needed
                                                        <Paper key={`${ping.pinger}-${ping.timestamp.getTime()}-${index}`} variant="outlined" sx={{ p: 1.5 }}>
                                                            <Typography variant="body2" sx={{ wordWrap: 'break-word', mb: 0.5 }}>
                                                                <strong>From:</strong>{' '}
                                                                <Link href={`https://sepolia.etherscan.io/address/${ping.pinger}`} target="_blank" rel="noopener noreferrer" title={`View ${ping.pinger} on Etherscan`}>
                                                                    {ping.ensName ?
                                                                        // Show ENS name and truncated address
                                                                        `${ping.ensName} (${ping.pinger.substring(0, 6)}...${ping.pinger.substring(ping.pinger.length - 4)})`
                                                                        : // Show only truncated address if no ENS name
                                                                        `${ping.pinger.substring(0, 6)}...${ping.pinger.substring(ping.pinger.length - 4)}`
                                                                    }
                                                                </Link>
                                                            </Typography>
                                                            <Typography variant="body1" sx={{ wordWrap: 'break-word', mb: 0.5 }}>
                                                                "{ping.message}"
                                                            </Typography>
                                                            <Typography variant="caption" display="block" sx={{ color: 'text.secondary', textAlign: 'right' }}>
                                                                {ping.timestamp.toLocaleString()} {/* Use locale-specific time format */}
                                                            </Typography>
                                                        </Paper>
                                                    ))}
                                                </Stack>
                                            )}
                                        </Box>
                                    </Stack>
                                </Paper>
                                {/* --- End Activity Log Section --- */}

                            </Stack> {/* End Inner Stack */}
                        </Box>
                    )}

                    {/* Message shown if connected BUT on wrong network OR contract not ready */}
                     {isConnected && (!isCorrectNetwork || !contract) && (
                         <Alert severity={!isCorrectNetwork ? "warning" : "info"} sx={{ mt: 2 }}>
                            {!isCorrectNetwork ? `Please switch Metamask to the ${targetNetworkName} network.` : "Initializing contract interface..."}
                         </Alert>
                     )}

                </Stack> {/* End Main Vertical Stack */}
            </Container>
        </>
    ); // End return
} // End App function

export default App; // Export component