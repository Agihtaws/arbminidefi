// Updated useWeb3.ts - Fix the disconnectWallet function
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { 
  MULTI_ASSET_CONTRACT_ADDRESS, 
  MULTI_ASSET_ABI, 
  USDC_TOKEN_ADDRESS,
  USDC_ABI,
  ARBITRUM_SEPOLIA 
} from '../contracts/config';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const useWeb3 = () => {
  const [account, setAccount] = useState<string>('');
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [multiAssetContract, setMultiAssetContract] = useState<ethers.Contract | null>(null);
  const [usdcContract, setUsdcContract] = useState<ethers.Contract | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [ethBalance, setEthBalance] = useState<string>('0');
  const [usdcBalance, setUsdcBalance] = useState<string>('0');

  // Initialize contracts
  const initializeContracts = useCallback(async (web3Provider: ethers.providers.Web3Provider, signerInstance: ethers.Signer) => {
    try {
      const multiAssetInstance = new ethers.Contract(MULTI_ASSET_CONTRACT_ADDRESS, MULTI_ASSET_ABI, signerInstance);
      const usdcInstance = new ethers.Contract(USDC_TOKEN_ADDRESS, USDC_ABI, signerInstance);

      setMultiAssetContract(multiAssetInstance);
      setUsdcContract(usdcInstance);
      
      return { multiAssetInstance, usdcInstance };
    } catch (error) {
      console.error('Error initializing contracts:', error);
      return { multiAssetInstance: null, usdcInstance: null };
    }
  }, []);

  // Refresh balances
  const refreshBalances = useCallback(async () => {
    if (!provider || !account || !usdcContract) return;

    try {
      const ethBal = await provider.getBalance(account);
      const usdcBal = await usdcContract.balanceOf(account);
      
      setEthBalance(ethers.utils.formatEther(ethBal));
      setUsdcBalance(ethers.utils.formatUnits(usdcBal, 6));
    } catch (error) {
      console.error('Error refreshing balances:', error);
    }
  }, [provider, account, usdcContract]);

  // Complete connection setup
  const completeConnection = useCallback(async (web3Provider: ethers.providers.Web3Provider, address: string) => {
    try {
      const signerInstance = web3Provider.getSigner();
      
      setProvider(web3Provider);
      setSigner(signerInstance);
      setAccount(address);
      setIsConnected(true);
      
      // Store connection state
      localStorage.setItem('walletConnected', 'true');
      localStorage.setItem('walletAddress', address);
      
      // Initialize contracts
      const { multiAssetInstance, usdcInstance } = await initializeContracts(web3Provider, signerInstance);
      
      // Get balances if contracts initialized successfully
      if (usdcInstance) {
        const ethBal = await web3Provider.getBalance(address);
        const usdcBal = await usdcInstance.balanceOf(address);
        
        setEthBalance(ethers.utils.formatEther(ethBal));
        setUsdcBalance(ethers.utils.formatUnits(usdcBal, 6));
      }
      
      console.log('Connection completed successfully:', address);
    } catch (error) {
      console.error('Error completing connection:', error);
      throw error;
    }
  }, [initializeContracts]);

  // Reset all state to initial values
  const resetState = useCallback(() => {
    setAccount('');
    setProvider(null);
    setSigner(null);
    setMultiAssetContract(null);
    setUsdcContract(null);
    setEthBalance('0');
    setUsdcBalance('0');
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  // Check if wallet was previously connected
  const checkConnection = useCallback(async () => {
    if (!window.ethereum) return;

    try {
      setIsConnecting(true);
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await web3Provider.listAccounts();
      
      if (accounts.length > 0) {
        const address = accounts[0];
        
        // Check if we're on the correct network
        const network = await web3Provider.getNetwork();
        if (network.chainId !== parseInt(ARBITRUM_SEPOLIA.chainId, 16)) {
          console.log('Wrong network, switching to Arbitrum Sepolia');
          await switchToArbitrumSepolia();
          // Re-check after network switch
          const updatedProvider = new ethers.providers.Web3Provider(window.ethereum);
          const updatedNetwork = await updatedProvider.getNetwork();
          if (updatedNetwork.chainId === parseInt(ARBITRUM_SEPOLIA.chainId, 16)) {
            await completeConnection(updatedProvider, address);
          }
          return;
        }
        
        await completeConnection(web3Provider, address);
      } else {
        // Clear stored connection state if no accounts
        localStorage.removeItem('walletConnected');
        localStorage.removeItem('walletAddress');
        resetState();
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      localStorage.removeItem('walletConnected');
      localStorage.removeItem('walletAddress');
      resetState();
    } finally {
      setIsConnecting(false);
    }
  }, [completeConnection, resetState]);

  // Switch to Arbitrum Sepolia network
  const switchToArbitrumSepolia = async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARBITRUM_SEPOLIA.chainId }],
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [ARBITRUM_SEPOLIA],
          });
        } catch (addError) {
          console.error('Error adding Arbitrum Sepolia network:', addError);
          throw addError;
        }
      } else {
        console.error('Error switching to Arbitrum Sepolia:', switchError);
        throw switchError;
      }
    }
  };

  // Connect wallet function
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('MetaMask is required to use this application. Please install MetaMask and try again.');
      return;
    }

    try {
      setIsConnecting(true);
      
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts.length === 0) {
        throw new Error('No accounts returned from MetaMask');
      }
      
      // Switch to Arbitrum Sepolia
      await switchToArbitrumSepolia();

      // Wait a bit for network switch to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const address = accounts[0];
      
      // Verify network after switch
      const network = await web3Provider.getNetwork();
      if (network.chainId !== parseInt(ARBITRUM_SEPOLIA.chainId, 16)) {
        throw new Error('Failed to switch to Arbitrum Sepolia network');
      }
      
      await completeConnection(web3Provider, address);
      
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      
      // Clear connection state on error
      localStorage.removeItem('walletConnected');
      localStorage.removeItem('walletAddress');
      resetState();
      
      if (error.code === 4001) {
        alert('Please connect to MetaMask to continue.');
      } else if (error.code === 4902) {
        alert('Please add Arbitrum Sepolia network to MetaMask.');
      } else {
        alert('Failed to connect wallet. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect wallet function - FIXED
  const disconnectWallet = useCallback(() => {
    console.log('Disconnecting wallet...');
    
    // Clear stored connection state FIRST
    localStorage.removeItem('walletConnected');
    localStorage.removeItem('walletAddress');
    
    // Reset all state
    resetState();
    
    console.log('Wallet disconnected successfully');
  }, [resetState]);

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      console.log('Accounts changed:', accounts);
      
      if (accounts.length === 0) {
        // User disconnected wallet
        disconnectWallet();
      } else if (accounts[0] !== account && accounts[0]) {
        // User switched accounts
        try {
          setIsConnecting(true);
          const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
          await completeConnection(web3Provider, accounts[0]);
        } catch (error) {
          console.error('Error handling account change:', error);
          disconnectWallet();
        } finally {
          setIsConnecting(false);
        }
      }
    };

    const handleChainChanged = async (chainId: string) => {
      console.log('Chain changed:', chainId);
      
      // Check if switched to correct network
      if (parseInt(chainId, 16) === parseInt(ARBITRUM_SEPOLIA.chainId, 16)) {
        // Reconnect if on correct network
        if (localStorage.getItem('walletConnected') === 'true') {
          setTimeout(() => {
            checkConnection();
          }, 1000);
        }
      } else {
        // Wrong network - show warning but don't disconnect
        console.warn('Please switch to Arbitrum Sepolia network');
      }
    };

    const handleDisconnect = (error: any) => {
      console.log('Wallet disconnected:', error);
      disconnectWallet();
    };

    // Add event listeners
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('disconnect', handleDisconnect);

    // Cleanup function
    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('disconnect', handleDisconnect);
      }
    };
  }, [account, disconnectWallet, checkConnection, completeConnection]);

  // Check connection on component mount - FIXED
  useEffect(() => {
    const wasConnected = localStorage.getItem('walletConnected') === 'true';
    
    if (wasConnected && window.ethereum) {
      checkConnection();
    } else {
      // Ensure we start with disconnected state if no stored connection
      resetState();
    }
  }, [checkConnection, resetState]);

  // Auto-refresh balances
  useEffect(() => {
    if (isConnected && account && provider && usdcContract) {
      // Initial balance fetch
      refreshBalances();
      
      // Set up interval for periodic refresh
      const interval = setInterval(() => {
        refreshBalances();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isConnected, account, provider, usdcContract, refreshBalances]);

  return {
    // State
    account,
    provider,
    signer,
    multiAssetContract,
    usdcContract,
    ethBalance,
    usdcBalance,
    isConnecting,
    isConnected,
    
    // Functions
    connectWallet,
    disconnectWallet,
    refreshBalances,
    checkConnection,
    switchToArbitrumSepolia,
  };
};

