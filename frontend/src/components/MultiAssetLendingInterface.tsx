import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../hooks/useWeb3';
import { useTheme } from '../contexts/ThemeContext';

interface MultiAssetLenderInfo {
  ethDepositAmount: string;
  usdcDepositAmount: string;
  ethCurrentInterest: string;
  usdcCurrentInterest: string;
  ethTotalBalance: string;
  usdcTotalBalance: string;
}

const MultiAssetLendingInterface: React.FC = () => {
  const { multiAssetContract, usdcContract, account, refreshBalances } = useWeb3();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'ETH' | 'USDC'>('ETH');
  const [ethDepositAmount, setEthDepositAmount] = useState('');
  const [usdcDepositAmount, setUsdcDepositAmount] = useState('');
  const [ethWithdrawAmount, setEthWithdrawAmount] = useState('');
  const [usdcWithdrawAmount, setUsdcWithdrawAmount] = useState('');
  const [lenderInfo, setLenderInfo] = useState<MultiAssetLenderInfo>({
    ethDepositAmount: '0',
    usdcDepositAmount: '0',
    ethCurrentInterest: '0',
    usdcCurrentInterest: '0',
    ethTotalBalance: '0',
    usdcTotalBalance: '0'
  });
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [usdcAllowance, setUsdcAllowance] = useState('0');

  // Balance and liquidity states
  const [userEthBalance, setUserEthBalance] = useState('0');
  const [userUsdcBalance, setUserUsdcBalance] = useState('0');
  const [poolEthLiquidity, setPoolEthLiquidity] = useState('0');
  const [poolUsdcLiquidity, setPoolUsdcLiquidity] = useState('0');

  // Transaction status state
  const [transactionStatus, setTransactionStatus] = useState<{
    type: 'idle' | 'pending' | 'success' | 'error';
    title: string;
    message: string;
    txHash?: string;
  }>({
    type: 'idle',
    title: '',
    message: ''
  });

  // Fetch user balances and pool liquidity
  const fetchBalancesAndLiquidity = async () => {
    if (!multiAssetContract || !account) return;
    
    try {
      // Get user balances
      const ethBalance = await multiAssetContract.provider.getBalance(account);
      setUserEthBalance(ethers.utils.formatEther(ethBalance));
      
      if (usdcContract) {
        const usdcBalance = await usdcContract.balanceOf(account);
        setUserUsdcBalance(ethers.utils.formatUnits(usdcBalance, 6));
      }
      
      // Get pool liquidity
      const poolEthBalance = await multiAssetContract.provider.getBalance(multiAssetContract.address);
      setPoolEthLiquidity(ethers.utils.formatEther(poolEthBalance));
      
      if (usdcContract) {
        const poolUsdcBalance = await usdcContract.balanceOf(multiAssetContract.address);
        setPoolUsdcLiquidity(ethers.utils.formatUnits(poolUsdcBalance, 6));
      }
    } catch (error) {
      console.error('Error fetching balances and liquidity:', error);
    }
  };

  // Validation functions
  const validateDepositTransaction = (amount: string, assetType: 'ETH' | 'USDC') => {
    if (!amount || parseFloat(amount) <= 0) {
      return { isValid: false, message: 'Please enter a valid deposit amount' };
    }

    const depositValue = parseFloat(amount);
    const userBalance = assetType === 'ETH' ? parseFloat(userEthBalance) : parseFloat(userUsdcBalance);

    if (depositValue > userBalance) {
      return { 
        isValid: false, 
        message: `Insufficient ${assetType} balance. You have ${userBalance.toFixed(assetType === 'ETH' ? 6 : 2)} ${assetType}, trying to deposit ${depositValue.toFixed(assetType === 'ETH' ? 6 : 2)} ${assetType}` 
      };
    }

    return { isValid: true, message: '' };
  };

  const validateWithdrawTransaction = (amount: string, assetType: 'ETH' | 'USDC') => {
    if (!amount || parseFloat(amount) <= 0) {
      return { isValid: false, message: 'Please enter a valid withdrawal amount' };
    }

    const withdrawValue = parseFloat(amount);
    const availableBalance = assetType === 'ETH' ? parseFloat(lenderInfo.ethTotalBalance) : parseFloat(lenderInfo.usdcTotalBalance);

    if (withdrawValue > availableBalance) {
      return { 
        isValid: false, 
        message: `Insufficient deposited balance. You have ${availableBalance.toFixed(assetType === 'ETH' ? 6 : 2)} ${assetType} available, trying to withdraw ${withdrawValue.toFixed(assetType === 'ETH' ? 6 : 2)} ${assetType}` 
      };
    }

    // Check pool liquidity for withdrawal with buffer
    const poolLiquidity = assetType === 'ETH' ? parseFloat(poolEthLiquidity) : parseFloat(poolUsdcLiquidity);
    const requiredBuffer = assetType === 'ETH' ? 0.03 : 30; // 0.03 ETH or 30 USDC buffer
    const availableLiquidity = poolLiquidity - requiredBuffer;

    if (withdrawValue > availableLiquidity) {
      return { 
        isValid: false, 
        message: `Insufficient pool liquidity. Pool has ${poolLiquidity.toFixed(assetType === 'ETH' ? 6 : 2)} ${assetType} total, but ${requiredBuffer.toFixed(assetType === 'ETH' ? 6 : 2)} ${assetType} must remain as buffer. Available for withdrawal: ${Math.max(0, availableLiquidity).toFixed(assetType === 'ETH' ? 6 : 2)} ${assetType}` 
      };
    }

    return { isValid: true, message: '' };
  };

  const fetchLenderInfo = async () => {
    if (!multiAssetContract || !account) return;
    
    try {
      const info = await multiAssetContract.getMultiAssetLenderInfo(account);
      setLenderInfo({
        ethDepositAmount: ethers.utils.formatEther(info.ethDepositAmount),
        usdcDepositAmount: ethers.utils.formatUnits(info.usdcDepositAmount, 6),
        ethCurrentInterest: ethers.utils.formatEther(info.ethCurrentInterest),
        usdcCurrentInterest: ethers.utils.formatUnits(info.usdcCurrentInterest, 6),
        ethTotalBalance: ethers.utils.formatEther(info.ethTotalBalance),
        usdcTotalBalance: ethers.utils.formatUnits(info.usdcTotalBalance, 6)
      });
    } catch (error) {
      console.error('Error fetching multi-asset lender info:', error);
    }
  };

  const checkUsdcAllowance = async () => {
    if (!usdcContract || !account) return;
    
    try {
      const allowance = await usdcContract.allowance(account, multiAssetContract?.address);
      setUsdcAllowance(ethers.utils.formatUnits(allowance, 6));
    } catch (error) {
      console.error('Error checking USDC allowance:', error);
    }
  };

  const approveUsdc = async (amount: string) => {
    if (!usdcContract) return false;
    
    try {
      setLoading(true);
      const tx = await usdcContract.approve(
        multiAssetContract?.address,
        ethers.utils.parseUnits(amount, 6)
      );
      setTxHash(tx.hash);
      
      setTransactionStatus({
        type: 'pending',
        title: 'USDC Approval Pending',
        message: 'Approving USDC for deposit...'
      });
      
      await tx.wait();
      await checkUsdcAllowance();
      
      setTransactionStatus({
        type: 'success',
        title: 'USDC Approved',
        message: `Successfully approved ${amount} USDC for deposit`,
        txHash: tx.hash
      });
      
      return true;
    } catch (error: any) {
      console.error('USDC approval error:', error);
      setTransactionStatus({
        type: 'error',
        title: 'USDC Approval Failed',
        message: error.reason || error.message || 'Transaction failed'
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleEthDeposit = async () => {
    if (!multiAssetContract || !ethDepositAmount) return;
    
    // Validate deposit amount before proceeding
    const validation = validateDepositTransaction(ethDepositAmount, 'ETH');
    if (!validation.isValid) {
      setTransactionStatus({
        type: 'error',
        title: 'Deposit Validation Failed',
        message: validation.message
      });
      return;
    }
    
    setLoading(true);
    setTxHash('');
    
    try {
      setTransactionStatus({
        type: 'pending',
        title: 'ETH Deposit Pending',
        message: `Depositing ${ethDepositAmount} ETH...`
      });
      
      const tx = await multiAssetContract.depositEth({
        value: ethers.utils.parseEther(ethDepositAmount)
      });
      
      setTxHash(tx.hash);
      await tx.wait();
      
      setEthDepositAmount('');
      await fetchLenderInfo();
      await fetchBalancesAndLiquidity();
      await refreshBalances();
      
      setTransactionStatus({
        type: 'success',
        title: 'ETH Deposit Successful!',
        message: `You deposited ${ethDepositAmount} ETH and are now earning 5% APY`,
        txHash: tx.hash
      });
      
    } catch (error: any) {
      console.error('ETH deposit error:', error);
      setTransactionStatus({
        type: 'error',
        title: 'ETH Deposit Failed',
        message: error.reason || error.message || 'Transaction failed'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUsdcDeposit = async () => {
    if (!multiAssetContract || !usdcDepositAmount) return;
    
    // Validate deposit amount before proceeding
    const validation = validateDepositTransaction(usdcDepositAmount, 'USDC');
    if (!validation.isValid) {
      setTransactionStatus({
        type: 'error',
        title: 'Deposit Validation Failed',
        message: validation.message
      });
      return;
    }
    
    const amount = parseFloat(usdcDepositAmount);
    const allowanceAmount = parseFloat(usdcAllowance);
    
    // Check if approval is needed
    if (allowanceAmount < amount) {
      const approved = await approveUsdc(usdcDepositAmount);
      if (!approved) return;
    }
    
    setLoading(true);
    setTxHash('');
    
    try {
      setTransactionStatus({
        type: 'pending',
        title: 'USDC Deposit Pending',
        message: `Depositing ${usdcDepositAmount} USDC...`
      });
      
      const tx = await multiAssetContract.depositUsdc(
        ethers.utils.parseUnits(usdcDepositAmount, 6)
      );
      
      setTxHash(tx.hash);
      await tx.wait();
      
      setUsdcDepositAmount('');
      await fetchLenderInfo();
      await fetchBalancesAndLiquidity();
      await refreshBalances();
      await checkUsdcAllowance();
      
      setTransactionStatus({
        type: 'success',
        title: 'USDC Deposit Successful!',
        message: `You deposited ${usdcDepositAmount} USDC and are now earning 4% APY`,
        txHash: tx.hash
      });
      
    } catch (error: any) {
      console.error('USDC deposit error:', error);
      setTransactionStatus({
        type: 'error',
        title: 'USDC Deposit Failed',
        message: error.reason || error.message || 'Transaction failed'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEthWithdraw = async () => {
    if (!multiAssetContract || !ethWithdrawAmount) return;
    
    // Validate withdraw amount before proceeding
    const validation = validateWithdrawTransaction(ethWithdrawAmount, 'ETH');
    if (!validation.isValid) {
      setTransactionStatus({
        type: 'error',
        title: 'Withdrawal Validation Failed',
        message: validation.message
      });
      return;
    }
    
    setLoading(true);
    setTxHash('');
    
    try {
      setTransactionStatus({
        type: 'pending',
        title: 'ETH Withdrawal Pending',
        message: `Withdrawing ${ethWithdrawAmount} ETH...`
      });
      
      const tx = await multiAssetContract.withdrawEth(
        ethers.utils.parseEther(ethWithdrawAmount)
      );
      
      setTxHash(tx.hash);
      await tx.wait();
      
      setEthWithdrawAmount('');
      await fetchLenderInfo();
      await fetchBalancesAndLiquidity();
      await refreshBalances();
      
      setTransactionStatus({
        type: 'success',
        title: 'ETH Withdrawal Successful!',
        message: `You withdrew ${ethWithdrawAmount} ETH including earned interest`,
        txHash: tx.hash
      });
      
    } catch (error: any) {
      console.error('ETH withdraw error:', error);
      setTransactionStatus({
        type: 'error',
        title: 'ETH Withdrawal Failed',
        message: error.reason || error.message || 'Transaction failed'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUsdcWithdraw = async () => {
    if (!multiAssetContract || !usdcWithdrawAmount) return;
    
    // Validate withdraw amount before proceeding
    const validation = validateWithdrawTransaction(usdcWithdrawAmount, 'USDC');
    if (!validation.isValid) {
      setTransactionStatus({
        type: 'error',
        title: 'Withdrawal Validation Failed',
        message: validation.message
      });
      return;
    }
    
    setLoading(true);
    setTxHash('');
    
    try {
      setTransactionStatus({
        type: 'pending',
        title: 'USDC Withdrawal Pending',
        message: `Withdrawing ${usdcWithdrawAmount} USDC...`
      });
      
      const tx = await multiAssetContract.withdrawUsdc(
        ethers.utils.parseUnits(usdcWithdrawAmount, 6)
      );
      
      setTxHash(tx.hash);
      await tx.wait();
      
      setUsdcWithdrawAmount('');
      await fetchLenderInfo();
      await fetchBalancesAndLiquidity();
      await refreshBalances();
      
      setTransactionStatus({
        type: 'success',
        title: 'USDC Withdrawal Successful!',
        message: `You withdrew ${usdcWithdrawAmount} USDC including earned interest`,
        txHash: tx.hash
      });
      
    } catch (error: any) {
      console.error('USDC withdraw error:', error);
      setTransactionStatus({
        type: 'error',
        title: 'USDC Withdrawal Failed',
        message: error.reason || error.message || 'Transaction failed'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLenderInfo();
    checkUsdcAllowance();
    fetchBalancesAndLiquidity();
    const interval = setInterval(() => {
      fetchLenderInfo();
      checkUsdcAllowance();
      fetchBalancesAndLiquidity();
    }, 15000);
    return () => clearInterval(interval);
  }, [multiAssetContract, account]);

  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-8 transition-colors duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-700 dark:from-green-500 dark:to-emerald-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Multi-Asset Lending</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Earn interest on your crypto assets</p>
          </div>
        </div>
        
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1 shadow-inner">
          <button
            onClick={() => setActiveTab('ETH')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 \${
              activeTab === 'ETH'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
              </svg>
              <span>ETH (5% APY)</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('USDC')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 \${
              activeTab === 'USDC'
                ? 'bg-white dark:bg-gray-600 text-green-600 dark:text-green-400 shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-600 dark:bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">$</span>
              </div>
              <span>USDC (4% APY)</span>
            </div>
          </button>
        </div>
      </div>

      {/* Balance and Liquidity Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Your Balances
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">ETH Balance:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">{parseFloat(userEthBalance).toFixed(6)} ETH</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">USDC Balance:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">{parseFloat(userUsdcBalance).toFixed(2)} USDC</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4">
          <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-3 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 7.172V5L8 4z" />
            </svg>
            Pool Liquidity
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-600 dark:text-blue-400">Available ETH:</span>
              <span className="ml-2 font-medium text-blue-800 dark:text-blue-200">{parseFloat(poolEthLiquidity).toFixed(6)} ETH</span>
            </div>
            <div>
              <span className="text-blue-600 dark:text-blue-400">Available USDC:</span>
              <span className="ml-2 font-medium text-blue-800 dark:text-blue-200">{parseFloat(poolUsdcLiquidity).toFixed(2)} USDC</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pool Buffer Information */}
      <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4 mb-8 border border-amber-200 dark:border-amber-700/50">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-amber-800 dark:text-amber-300">
            <strong>Pool Liquidity Buffer:</strong> The protocol maintains a buffer of 0.03 ETH and 30 USDC in the pool to ensure sufficient liquidity for all users. This amount is reserved and cannot be withdrawn.
            <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
              <div>Available for ETH withdrawal: <span className="font-medium">{Math.max(0, parseFloat(poolEthLiquidity) - 0.03).toFixed(6)} ETH</span></div>
              <div>Available for USDC withdrawal: <span className="font-medium">{Math.max(0, parseFloat(poolUsdcLiquidity) - 30).toFixed(2)} USDC</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Inline Transaction Status */}
      {transactionStatus.type !== 'idle' && (
        <div className={`rounded-2xl p-6 mb-8 border-2 \${
          transactionStatus.type === 'pending' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700/50' :
          transactionStatus.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700/50' :
          transactionStatus.type === 'error' ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700/50' :
          'bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700/50'
        }`}>
          <div className="flex items-start">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-4 flex-shrink-0 \${
              transactionStatus.type === 'pending' ? 'bg-blue-600 dark:bg-blue-500' :
              transactionStatus.type === 'success' ? 'bg-green-600 dark:bg-green-500' :
              transactionStatus.type === 'error' ? 'bg-red-600 dark:bg-red-500' :
              'bg-gray-600 dark:bg-gray-500'
            }`}>
              {transactionStatus.type === 'pending' && (
                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {transactionStatus.type === 'success' && (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {transactionStatus.type === 'error' && (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <h4 className={`font-semibold mb-2 \${
                transactionStatus.type === 'pending' ? 'text-blue-800 dark:text-blue-300' :
                transactionStatus.type === 'success' ? 'text-green-800 dark:text-green-300' :
                transactionStatus.type === 'error' ? 'text-red-800 dark:text-red-300' :
                'text-gray-800 dark:text-gray-300'
              }`}>
                {transactionStatus.title}
              </h4>
              <p className={`text-sm \${
                transactionStatus.type === 'pending' ? 'text-blue-700 dark:text-blue-400' :
                transactionStatus.type === 'success' ? 'text-green-700 dark:text-green-400' :
                transactionStatus.type === 'error' ? 'text-red-700 dark:text-red-400' :
                'text-gray-700 dark:text-gray-400'
              }`}>
                {transactionStatus.message}
              </p>
              
              {transactionStatus.txHash && (
                <div className="mt-3">
                  <a
                    href={`https://sepolia.arbiscan.io/tx/${transactionStatus.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
                      transactionStatus.type === 'success' 
                        ? 'bg-green-100 dark:bg-green-900/50 hover:bg-green-200 dark:hover:bg-green-800/50 text-green-700 dark:text-green-300'
                        : 'bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View on Arbiscan
                  </a>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setTransactionStatus({ type: 'idle', title: '', message: '' })}
              className="flex-shrink-0 w-6 h-6 rounded-lg bg-white/70 dark:bg-gray-700/70 hover:bg-white dark:hover:bg-gray-600 flex items-center justify-center transition-colors duration-200 text-gray-500 dark:text-gray-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Portfolio Overview */}
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800/50 dark:to-blue-900/20 rounded-2xl p-6 mb-8 border border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-400 dark:to-indigo-500 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Your Multi-Asset Portfolio</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl p-4 border border-blue-200/50 dark:border-blue-700/50">
            <div className="flex items-center mb-3">
              <svg className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
              </svg>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">ETH Position</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Principal:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{parseFloat(lenderInfo.ethDepositAmount).toFixed(6)} ETH</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Interest:</span>
                <span className="font-semibold text-green-600 dark:text-green-400">+{parseFloat(lenderInfo.ethCurrentInterest).toFixed(6)} ETH</span>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Balance:</span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{parseFloat(lenderInfo.ethTotalBalance).toFixed(6)} ETH</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl p-4 border border-green-200/50 dark:border-green-700/50">
            <div className="flex items-center mb-3">
              <div className="w-5 h-5 mr-2 bg-green-600 dark:bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">$</span>
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">USDC Position</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Principal:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{parseFloat(lenderInfo.usdcDepositAmount).toFixed(2)} USDC</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Interest:</span>
                <span className="font-semibold text-green-600 dark:text-green-400">+{parseFloat(lenderInfo.usdcCurrentInterest).toFixed(2)} USDC</span>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Balance:</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">{parseFloat(lenderInfo.usdcTotalBalance).toFixed(2)} USDC</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ETH Tab */}
      {activeTab === 'ETH' && (
        <div className="space-y-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Deposit ETH Amount
            </label>
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
              <input
                type="number"
                step="0.000001"
                placeholder="0.0"
                value={ethDepositAmount}
                onChange={(e) => setEthDepositAmount(e.target.value)}
                className="input-field flex-1"
                disabled={loading}
              />
              <button
                onClick={handleEthDeposit}
                disabled={
                  loading || 
                  !ethDepositAmount || 
                  parseFloat(ethDepositAmount) <= 0 ||
                  !validateDepositTransaction(ethDepositAmount, 'ETH').isValid
                }
                className="btn-primary px-8 flex items-center justify-center min-w-[140px]"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Depositing...
                  </>
                ) : (
                  'Deposit ETH'
                )}
              </button>
            </div>
            
            {/* Real-time validation for ETH deposit */}
            {ethDepositAmount && (
              (() => {
                const validation = validateDepositTransaction(ethDepositAmount, 'ETH');
                if (!validation.isValid) {
                  return (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 rounded-lg">
                      <div className="flex items-center text-sm text-red-600 dark:text-red-400">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {validation.message}
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700/50 rounded-lg">
                    <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Ready to deposit! You have sufficient ETH balance.
                    </div>
                  </div>
                );
              })()
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Withdraw ETH Amount
            </label>
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
              <input
                type="number"
                step="0.000001"
                placeholder="0.0"
                value={ethWithdrawAmount}
                onChange={(e) => setEthWithdrawAmount(e.target.value)}
                className="input-field flex-1"
                disabled={loading}
              />
              <button
                onClick={() => {
                  const poolLiquidity = parseFloat(poolEthLiquidity);
                  const requiredBuffer = 0.03;
                  const availableLiquidity = poolLiquidity - requiredBuffer;
                  const userBalance = parseFloat(lenderInfo.ethTotalBalance);
                  const maxWithdrawable = Math.min(userBalance, Math.max(0, availableLiquidity));
                  setEthWithdrawAmount(maxWithdrawable.toFixed(6));
                }}
                disabled={loading || parseFloat(lenderInfo.ethTotalBalance) <= 0}
                className="btn-secondary px-6"
              >
                Max
              </button>
              <button
                onClick={handleEthWithdraw}
                disabled={
                  loading || 
                  !ethWithdrawAmount || 
                  parseFloat(ethWithdrawAmount) <= 0 ||
                  !validateWithdrawTransaction(ethWithdrawAmount, 'ETH').isValid
                }
                className="btn-primary px-8 flex items-center justify-center min-w-[140px]"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Withdrawing...
                  </>
                ) : (
                  'Withdraw ETH'
                )}
              </button>
            </div>
            
            {/* Real-time validation for ETH withdrawal */}
            {ethWithdrawAmount && (
              (() => {
                const validation = validateWithdrawTransaction(ethWithdrawAmount, 'ETH');
                if (!validation.isValid) {
                  return (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 rounded-lg">
                      <div className="flex items-center text-sm text-red-600 dark:text-red-400">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {validation.message}
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700/50 rounded-lg">
                    <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Ready to withdraw! Pool has sufficient liquidity.
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* USDC Tab */}
      {activeTab === 'USDC' && (
        <div className="space-y-8">
          {parseFloat(usdcAllowance) < parseFloat(usdcDepositAmount || '0') && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 rounded-xl p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <strong>Approval Required:</strong> You need to approve USDC spending before depositing.
                  <br />
                  Current allowance: {parseFloat(usdcAllowance).toFixed(2)} USDC
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Deposit USDC Amount
            </label>
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={usdcDepositAmount}
                onChange={(e) => setUsdcDepositAmount(e.target.value)}
                className="input-field flex-1"
                disabled={loading}
              />
              <button
                onClick={handleUsdcDeposit}
                disabled={
                  loading || 
                  !usdcDepositAmount || 
                  parseFloat(usdcDepositAmount) <= 0 ||
                  !validateDepositTransaction(usdcDepositAmount, 'USDC').isValid
                }
                className="btn-primary px-8 flex items-center justify-center min-w-[140px]"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  'Deposit USDC'
                )}
              </button>
            </div>
            
            {/* Real-time validation for USDC deposit */}
            {usdcDepositAmount && (
              (() => {
                const validation = validateDepositTransaction(usdcDepositAmount, 'USDC');
                if (!validation.isValid) {
                  return (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 rounded-lg">
                      <div className="flex items-center text-sm text-red-600 dark:text-red-400">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {validation.message}
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700/50 rounded-lg">
                    <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Ready to deposit! You have sufficient USDC balance.
                    </div>
                  </div>
                );
              })()
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Withdraw USDC Amount
            </label>
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={usdcWithdrawAmount}
                onChange={(e) => setUsdcWithdrawAmount(e.target.value)}
                className="input-field flex-1"
                disabled={loading}
              />
              <button
                onClick={() => {
                  const poolLiquidity = parseFloat(poolUsdcLiquidity);
                  const requiredBuffer = 30; // 30 USDC buffer
                  const availableLiquidity = poolLiquidity - requiredBuffer;
                  const userBalance = parseFloat(lenderInfo.usdcTotalBalance);
                  const maxWithdrawable = Math.min(userBalance, Math.max(0, availableLiquidity));
                  setUsdcWithdrawAmount(maxWithdrawable.toFixed(2));
                }}
                disabled={loading || parseFloat(lenderInfo.usdcTotalBalance) <= 0}
                className="btn-secondary px-6"
              >
                Max
              </button>
              <button
                onClick={handleUsdcWithdraw}
                disabled={
                  loading || 
                  !usdcWithdrawAmount || 
                  parseFloat(usdcWithdrawAmount) <= 0 ||
                  !validateWithdrawTransaction(usdcWithdrawAmount, 'USDC').isValid
                }
                className="btn-primary px-8 flex items-center justify-center min-w-[140px]"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Withdrawing...
                  </>
                ) : (
                  'Withdraw USDC'
                )}
              </button>
            </div>
            
            {/* Real-time validation for USDC withdrawal */}
            {usdcWithdrawAmount && (
              (() => {
                const validation = validateWithdrawTransaction(usdcWithdrawAmount, 'USDC');
                if (!validation.isValid) {
                  return (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 rounded-lg">
                      <div className="flex items-center text-sm text-red-600 dark:text-red-400">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {validation.message}
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700/50 rounded-lg">
                    <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Ready to withdraw! Pool has sufficient liquidity.
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* Transaction Hash Display (Legacy - can be removed since we have inline status) */}
      {txHash && !transactionStatus.txHash && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/50 rounded-xl p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800 dark:text-blue-300">
              Transaction submitted: 
              <a 
                href={`https://sepolia.arbiscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 underline hover:text-blue-900 dark:hover:text-blue-200 font-medium"
              >
                View on Arbiscan
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiAssetLendingInterface;
