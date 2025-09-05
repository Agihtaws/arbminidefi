import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../hooks/useWeb3';
import { useTheme } from '../contexts/ThemeContext';
import { AssetType } from '../contracts/config';

const MultiAssetBorrowingInterface: React.FC = () => {
  const { multiAssetContract, usdcContract, account, refreshBalances } = useWeb3();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'ETH' | 'USDC'>('ETH');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [collateralType, setCollateralType] = useState<'ETH' | 'USDC'>('ETH');
  const [collateralAmount, setCollateralAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [usdcAllowance, setUsdcAllowance] = useState('0');
  const [ethPriceUsd, setEthPriceUsd] = useState(0);
  
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

  const [borrowerInfo, setBorrowerInfo] = useState({
    hasEthLoan: false,
    hasUsdcLoan: false,
    ethBorrowAmount: '0',
    usdcBorrowAmount: '0',
    ethCollateral: '0',
    usdcCollateral: '0',
    ethTotalOwed: '0',
    usdcTotalOwed: '0',
    healthFactor: '0'
  });

  // User limits state
  const [userLimits, setUserLimits] = useState({
    maxBorrowableEth: '0',
    maxBorrowableUsdc: '0',
    canBorrowEth: false,
    canBorrowUsdc: false
  });

  const COLLATERAL_RATIO = 1.5;

  const fetchEthPrice = async () => {
    if (!multiAssetContract) return;
    
    try {
      const price = await multiAssetContract.getEthPriceUsd();
      const priceInUsd = parseFloat(ethers.utils.formatUnits(price, 6));
      setEthPriceUsd(priceInUsd);
    } catch (error) {
      console.error('Error fetching ETH price:', error);
    }
  };

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

  // Fetch user limits
  const fetchUserLimits = async () => {
    if (!multiAssetContract || !account) return;
    
    try {
      const limits = await multiAssetContract.getUserLimits(account);
      setUserLimits({
        maxBorrowableEth: ethers.utils.formatEther(limits.maxBorrowableEth),
        maxBorrowableUsdc: ethers.utils.formatUnits(limits.maxBorrowableUsdc, 6),
        canBorrowEth: limits.canBorrowEth,
        canBorrowUsdc: limits.canBorrowUsdc
      });
    } catch (error) {
      console.error('Error fetching user limits:', error);
    }
  };

  // Comprehensive validation function
  const validateBorrowTransaction = (borrowAmount: string, collateralAmount: string, borrowAsset: 'ETH' | 'USDC', collateralAsset: 'ETH' | 'USDC') => {
    if (!borrowAmount || !collateralAmount) {
      return { isValid: false, message: 'Please enter borrow and collateral amounts' };
    }

    const borrowValue = parseFloat(borrowAmount);
    const collateralValue = parseFloat(collateralAmount);

    if (borrowValue <= 0 || collateralValue <= 0) {
      return { isValid: false, message: 'Amounts must be greater than 0' };
    }

    // Check if user has enough collateral
    const userCollateralBalance = collateralAsset === 'ETH' ? parseFloat(userEthBalance) : parseFloat(userUsdcBalance);
    if (collateralValue > userCollateralBalance) {
      return { 
        isValid: false, 
        message: `Insufficient ${collateralAsset} balance. You have ${userCollateralBalance.toFixed(collateralAsset === 'ETH' ? 6 : 2)} ${collateralAsset}, need ${collateralValue.toFixed(collateralAsset === 'ETH' ? 6 : 2)} ${collateralAsset}` 
      };
    }

    // Check pool liquidity for borrowing
    const poolLiquidity = borrowAsset === 'ETH' ? parseFloat(poolEthLiquidity) : parseFloat(poolUsdcLiquidity);
    if (borrowValue > poolLiquidity) {
      return { 
        isValid: false, 
        message: `Insufficient pool liquidity. Pool has ${poolLiquidity.toFixed(borrowAsset === 'ETH' ? 6 : 2)} ${borrowAsset}, you're trying to borrow ${borrowValue.toFixed(borrowAsset === 'ETH' ? 6 : 2)} ${borrowAsset}` 
      };
    }

    // Check borrowing limits
    const maxBorrowable = borrowAsset === 'ETH' ? parseFloat(userLimits.maxBorrowableEth) : parseFloat(userLimits.maxBorrowableUsdc);
    if (borrowValue > maxBorrowable) {
      return { 
        isValid: false, 
        message: `Amount exceeds maximum borrowable ${borrowAsset} (${maxBorrowable.toFixed(borrowAsset === 'ETH' ? 6 : 2)} ${borrowAsset} available)` 
      };
    }

    // Check if user can borrow this asset type
    const canBorrow = borrowAsset === 'ETH' ? userLimits.canBorrowEth : userLimits.canBorrowUsdc;
    if (!canBorrow) {
      return { 
        isValid: false, 
        message: borrowerInfo.hasEthLoan || borrowerInfo.hasUsdcLoan ? 'You already have an active loan' : `${borrowAsset} borrowing not available` 
      };
    }

    return { isValid: true, message: '' };
  };

  const calculateRequiredCollateral = (amount: string, borrowAsset: 'ETH' | 'USDC', collateralAsset: 'ETH' | 'USDC') => {
    if (!amount || ethPriceUsd === 0) return '0';
    const borrowValue = parseFloat(amount);
    
    if (borrowAsset === 'ETH' && collateralAsset === 'ETH') {
      const requiredCollateral = borrowValue * COLLATERAL_RATIO;
      return requiredCollateral.toFixed(6);
    }
    
    if (borrowAsset === 'ETH' && collateralAsset === 'USDC') {
      const ethValueInUsd = borrowValue * ethPriceUsd;
      const requiredUsdcCollateral = ethValueInUsd * COLLATERAL_RATIO;
      return requiredUsdcCollateral.toFixed(2);
    }
    
    if (borrowAsset === 'USDC' && collateralAsset === 'ETH') {
      const usdcValueInEth = borrowValue / ethPriceUsd;
      const requiredEthCollateral = usdcValueInEth * COLLATERAL_RATIO;
      return requiredEthCollateral.toFixed(6);
    }
    
    if (borrowAsset === 'USDC' && collateralAsset === 'USDC') {
      const requiredCollateral = borrowValue * COLLATERAL_RATIO;
      return requiredCollateral.toFixed(2);
    }
    
    return '0';
  };

  // Calculate max borrow from collateral
  const calculateMaxBorrowFromCollateral = (collateralAmount: string, collateralAsset: 'ETH' | 'USDC', borrowAsset: 'ETH' | 'USDC') => {
    if (!collateralAmount || ethPriceUsd === 0) return '0';
    const collateralValue = parseFloat(collateralAmount);
    
    if (collateralAsset === 'ETH' && borrowAsset === 'USDC') {
      const ethValueInUsd = collateralValue * ethPriceUsd;
      const maxBorrowableUsd = ethValueInUsd / COLLATERAL_RATIO;
      return maxBorrowableUsd.toFixed(2);
    }
    
    if (collateralAsset === 'USDC' && borrowAsset === 'ETH') {
      const maxBorrowableUsd = collateralValue / COLLATERAL_RATIO;
      const maxBorrowableEth = maxBorrowableUsd / ethPriceUsd;
      return maxBorrowableEth.toFixed(6);
    }
    
    if (collateralAsset === 'ETH' && borrowAsset === 'ETH') {
      const maxBorrowableEth = collateralValue / COLLATERAL_RATIO;
      return maxBorrowableEth.toFixed(6);
    }
    
    if (collateralAsset === 'USDC' && borrowAsset === 'USDC') {
      const maxBorrowableUsdc = collateralValue / COLLATERAL_RATIO;
      return maxBorrowableUsdc.toFixed(2);
    }
    
    return '0';
  };

  const handleBorrowAmountChange = (value: string) => {
    setBorrowAmount(value);
    const required = calculateRequiredCollateral(value, activeTab, collateralType);
    setCollateralAmount(required);
  };

  const handleCollateralTypeChange = (newCollateralType: 'ETH' | 'USDC') => {
    setCollateralType(newCollateralType);
    if (borrowAmount) {
      const required = calculateRequiredCollateral(borrowAmount, activeTab, newCollateralType);
      setCollateralAmount(required);
    }
  };

  const fetchBorrowerInfo = async () => {
    if (!multiAssetContract || !account) return;
    
    try {
      const info = await multiAssetContract.getBorrowerInfo(account);
      setBorrowerInfo({
        hasEthLoan: info.hasEthLoan,
        hasUsdcLoan: info.hasUsdcLoan,
        ethBorrowAmount: ethers.utils.formatEther(info.ethBorrowAmount),
        usdcBorrowAmount: ethers.utils.formatUnits(info.usdcBorrowAmount, 6),
        ethCollateral: ethers.utils.formatEther(info.ethCollateralAmount),
        usdcCollateral: ethers.utils.formatUnits(info.usdcCollateralAmount, 6),
        ethTotalOwed: ethers.utils.formatEther(info.ethTotalOwed),
        usdcTotalOwed: ethers.utils.formatUnits(info.usdcTotalOwed, 6),
        healthFactor: parseFloat(ethers.utils.formatUnits(info.healthFactor, 6)).toFixed(2)
      });
    } catch (error) {
      console.error('Error fetching borrower info:', error);
    }
  };

  const checkUsdcAllowance = async () => {
    if (!usdcContract || !account || !multiAssetContract) return;
    
    try {
      const allowance = await usdcContract.allowance(account, multiAssetContract.address);
      setUsdcAllowance(ethers.utils.formatUnits(allowance, 6));
    } catch (error) {
      console.error('Error checking USDC allowance:', error);
    }
  };

  const approveUsdc = async (amount: string) => {
    if (!usdcContract || !multiAssetContract) return false;
    
    try {
      setLoading(true);
      const approvalAmount = ethers.utils.parseUnits((parseFloat(amount) * 1.01).toFixed(6), 6);
      const tx = await usdcContract.approve(multiAssetContract.address, approvalAmount);
      setTxHash(tx.hash);
      
      setTransactionStatus({
        type: 'pending',
        title: 'USDC Approval Pending',
        message: 'Approving USDC for collateral usage...'
      });
      
      await tx.wait();
      
      setTransactionStatus({
        type: 'success',
        title: 'USDC Approved',
        message: `Successfully approved ${amount} USDC for collateral`,
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

  const handleRepayEth = async () => {
    if (!multiAssetContract || !borrowerInfo.hasEthLoan) return;
    
    setLoading(true);
    setTxHash('');
    
    try {
      const realTimeOwed = await multiAssetContract.getEthTotalOwed(account);
      const buffer = realTimeOwed.div(1000);
      const repayAmountWithBuffer = realTimeOwed.add(buffer);
      
      setTransactionStatus({
        type: 'pending',
        title: 'ETH Repayment Pending',
        message: `Repaying ${ethers.utils.formatEther(repayAmountWithBuffer)} ETH...`
      });
      
      const tx = await multiAssetContract.repayEth({
        value: repayAmountWithBuffer
      });
      
      setTxHash(tx.hash);
      await tx.wait();
      
      await fetchBorrowerInfo();
      await fetchUserLimits();
      await fetchBalancesAndLiquidity();
      await refreshBalances();
      
      setTransactionStatus({
        type: 'success',
        title: 'ETH Loan Repaid Successfully!',
        message: `You repaid ${ethers.utils.formatEther(repayAmountWithBuffer)} ETH`,
        txHash: tx.hash
      });
      
    } catch (error: any) {
      console.error('ETH repay error:', error);
      setTransactionStatus({
        type: 'error',
        title: 'ETH Repayment Failed',
        message: error.reason || error.message || 'Transaction failed'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRepayUsdc = async () => {
    if (!multiAssetContract || !borrowerInfo.hasUsdcLoan) return;
    
    setLoading(true);
    setTxHash('');
    
    try {
      const realTimeOwed = await multiAssetContract.getUsdcTotalOwed(account);
      const buffer = realTimeOwed.div(1000);
      const repayAmountWithBuffer = realTimeOwed.add(buffer);
      
      const repayAmountFormatted = ethers.utils.formatUnits(repayAmountWithBuffer, 6);
      const allowanceAmount = parseFloat(usdcAllowance);
      
      if (allowanceAmount < parseFloat(repayAmountFormatted)) {
        const approved = await approveUsdc(repayAmountFormatted);
        if (!approved) return;
        await checkUsdcAllowance();
      }
      
      setTransactionStatus({
        type: 'pending',
        title: 'USDC Repayment Pending',
        message: `Repaying ${repayAmountFormatted} USDC...`
      });
      
      const tx = await multiAssetContract.repayUsdc(repayAmountWithBuffer);
      
      setTxHash(tx.hash);
      await tx.wait();
      
      await fetchBorrowerInfo();
      await fetchUserLimits();
      await fetchBalancesAndLiquidity();
      await refreshBalances();
      
      setTransactionStatus({
        type: 'success',
        title: 'USDC Loan Repaid Successfully!',
        message: `You repaid ${repayAmountFormatted} USDC`,
        txHash: tx.hash
      });
      
    } catch (error: any) {
      console.error('USDC repay error:', error);
      setTransactionStatus({
        type: 'error',
        title: 'USDC Repayment Failed',
        message: error.reason || error.message || 'Transaction failed'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBorrowEth = async () => {
    if (!multiAssetContract || !borrowAmount || !collateralAmount) return;
    
    // Validate borrow amount before proceeding
    const validation = validateBorrowTransaction(borrowAmount, collateralAmount, 'ETH', collateralType);
    if (!validation.isValid) {
      setTransactionStatus({
        type: 'error',
        title: 'Borrow Validation Failed',
        message: validation.message
      });
      return;
    }
    
    setLoading(true);
    setTxHash('');
    
    try {
      setTransactionStatus({
        type: 'pending',
        title: 'ETH Borrow Pending',
        message: `Borrowing ${borrowAmount} ETH with ${collateralAmount} ${collateralType} collateral...`
      });
      
      let tx;
      
      if (collateralType === 'ETH') {
        tx = await multiAssetContract.borrowEth(
          ethers.utils.parseEther(borrowAmount),
          AssetType.ETH,
          0,
          { value: ethers.utils.parseEther(collateralAmount) }
        );
      } else {
        const allowanceAmount = parseFloat(usdcAllowance);
        const requiredAmount = parseFloat(collateralAmount);
        
        if (allowanceAmount < requiredAmount) {
          const approved = await approveUsdc(collateralAmount);
          if (!approved) return;
          await new Promise(resolve => setTimeout(resolve, 3000));
          await checkUsdcAllowance();
        }
        
        const exactCollateralAmount = ethers.utils.parseUnits(collateralAmount, 6);
        tx = await multiAssetContract.borrowEth(
          ethers.utils.parseEther(borrowAmount),
          AssetType.USDC,
          exactCollateralAmount
        );
      }
      
      setTxHash(tx.hash);
      await tx.wait();
      
      setBorrowAmount('');
      setCollateralAmount('');
      await fetchBorrowerInfo();
      await fetchUserLimits();
      await fetchBalancesAndLiquidity();
      await refreshBalances();
      
      setTransactionStatus({
        type: 'success',
        title: 'ETH Borrowed Successfully!',
        message: `You borrowed ${borrowAmount} ETH with ${collateralAmount} ${collateralType} collateral`,
        txHash: tx.hash
      });
      
    } catch (error: any) {
      console.error('ETH borrow error:', error);
      setTransactionStatus({
        type: 'error',
        title: 'ETH Borrow Failed',
        message: error.reason || error.message || 'Transaction failed'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBorrowUsdc = async () => {
    if (!multiAssetContract || !borrowAmount || !collateralAmount) return;
    
    // Validate borrow amount before proceeding
    const validation = validateBorrowTransaction(borrowAmount, collateralAmount, 'USDC', collateralType);
    if (!validation.isValid) {
      setTransactionStatus({
        type: 'error',
        title: 'Borrow Validation Failed',
        message: validation.message
      });
      return;
    }
    
    setLoading(true);
    setTxHash('');
    
    try {
      setTransactionStatus({
        type: 'pending',
        title: 'USDC Borrow Pending',
        message: `Borrowing ${borrowAmount} USDC with ${collateralAmount} ${collateralType} collateral...`
      });
      
      let tx;
      
      if (collateralType === 'ETH') {
        tx = await multiAssetContract.borrowUsdc(
          ethers.utils.parseUnits(borrowAmount, 6),
          AssetType.ETH,
          0,
          { value: ethers.utils.parseEther(collateralAmount) }
        );
      } else {
        const allowanceAmount = parseFloat(usdcAllowance);
        const requiredAmount = parseFloat(collateralAmount);
        
        if (allowanceAmount < requiredAmount) {
          const approved = await approveUsdc(collateralAmount);
          if (!approved) return;
          await new Promise(resolve => setTimeout(resolve, 3000));
          await checkUsdcAllowance();
        }
        
        const exactCollateralAmount = ethers.utils.parseUnits(collateralAmount, 6);
        tx = await multiAssetContract.borrowUsdc(
          ethers.utils.parseUnits(borrowAmount, 6),
          AssetType.USDC,
          exactCollateralAmount
        );
      }
      
      setTxHash(tx.hash);
      await tx.wait();
      
      setBorrowAmount('');
      setCollateralAmount('');
      await fetchBorrowerInfo();
      await fetchUserLimits();
      await fetchBalancesAndLiquidity();
      await refreshBalances();
      
      setTransactionStatus({
        type: 'success',
        title: 'USDC Borrowed Successfully!',
        message: `You borrowed ${borrowAmount} USDC with ${collateralAmount} ${collateralType} collateral`,
        txHash: tx.hash
      });
      
    } catch (error: any) {
      console.error('USDC borrow error:', error);
      setTransactionStatus({
        type: 'error',
        title: 'USDC Borrow Failed',
        message: error.reason || error.message || 'Transaction failed'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (multiAssetContract && account) {
      fetchEthPrice();
      checkUsdcAllowance();
      fetchBorrowerInfo();
      fetchUserLimits();
      fetchBalancesAndLiquidity();
      
      const interval = setInterval(() => {
        fetchEthPrice();
        checkUsdcAllowance();
        fetchBorrowerInfo();
        fetchUserLimits();
        fetchBalancesAndLiquidity();
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [multiAssetContract, account, usdcContract]);

  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-8 transition-colors duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-pink-700 dark:from-red-500 dark:to-pink-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Multi-Asset Borrowing</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Borrow against your crypto collateral</p>
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
              <span>Borrow ETH (8% APY)</span>
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
                <span className="text-white text-xs font-bold">\$</span>
              </div>
              <span>Borrow USDC (6% APY)</span>
            </div>
          </button>
        </div>
      </div>

      {/* Info Panel */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-700/50 rounded-2xl p-6 mb-8">
        <div className="flex items-start">
          <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <div className="font-semibold mb-2">Cross-Collateral Borrowing Information</div>
            <div className="space-y-1">
              <div><strong>Cross-Collateral:</strong> Use ETH as collateral to borrow USDC, or USDC as collateral to borrow ETH</div>
              <div><strong>Collateralization:</strong> 150% collateral required • <strong>Liquidation:</strong> Below 120% health factor</div>
              <div className="flex items-center">
                <strong>Current ETH Price:</strong> 
                <span className="ml-1">\${ethPriceUsd.toFixed(2)} USD (Live from Chainlink Oracle)</span>
                {ethPriceUsd > 0 && <span className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
              </div>
            </div>
          </div>
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

      {/* Active Loans */}
      {(borrowerInfo.hasEthLoan || borrowerInfo.hasUsdcLoan) && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-6 mb-8">
          <div className="flex items-center mb-6">
            <div className="w-8 h-8 bg-amber-600 dark:bg-amber-500 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-300">Your Active Loans</h3>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {borrowerInfo.hasEthLoan && (
              <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl p-6 border border-amber-200 dark:border-amber-700/50">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
                      </svg>
                      <span className="font-semibold text-gray-900 dark:text-white">ETH Loan</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                      {parseFloat(borrowerInfo.ethTotalOwed).toFixed(6)} ETH
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="text-gray-600 dark:text-gray-400">
                        Principal: {parseFloat(borrowerInfo.ethBorrowAmount).toFixed(6)} ETH
                      </div>
                      {parseFloat(borrowerInfo.ethTotalOwed) > parseFloat(borrowerInfo.ethBorrowAmount) && (
                        <div className="text-orange-600 dark:text-orange-400">
                          Interest: {(parseFloat(borrowerInfo.ethTotalOwed) - parseFloat(borrowerInfo.ethBorrowAmount)).toFixed(6)} ETH
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Health Factor</div>
                    <div className={`text-lg font-bold ${parseFloat(borrowerInfo.healthFactor) < 1.2 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {parseFloat(borrowerInfo.healthFactor).toFixed(2)}
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-medium">Collateral</div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">ETH:</span>
                      <span className="ml-1 font-medium text-gray-900 dark:text-white">{parseFloat(borrowerInfo.ethCollateral).toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">USDC:</span>
                      <span className="ml-1 font-medium text-gray-900 dark:text-white">{parseFloat(borrowerInfo.usdcCollateral).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={handleRepayEth}
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center"
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
                    `Repay ${parseFloat(borrowerInfo.ethTotalOwed).toFixed(6)} ETH`
                  )}
                </button>
              </div>
            )}
            
            {borrowerInfo.hasUsdcLoan && (
              <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl p-6 border border-amber-200 dark:border-amber-700/50">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center mb-2">
                      <div className="w-5 h-5 mr-2 bg-green-600 dark:bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">$</span>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white">USDC Loan</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                      {parseFloat(borrowerInfo.usdcTotalOwed).toFixed(2)} USDC
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="text-gray-600 dark:text-gray-400">
                        Principal: {parseFloat(borrowerInfo.usdcBorrowAmount).toFixed(2)} USDC
                      </div>
                      {parseFloat(borrowerInfo.usdcTotalOwed) > parseFloat(borrowerInfo.usdcBorrowAmount) && (
                        <div className="text-orange-600 dark:text-orange-400">
                          Interest: {(parseFloat(borrowerInfo.usdcTotalOwed) - parseFloat(borrowerInfo.usdcBorrowAmount)).toFixed(2)} USDC
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Health Factor</div>
                    <div className={`text-lg font-bold ${parseFloat(borrowerInfo.healthFactor) < 1.2 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {parseFloat(borrowerInfo.healthFactor).toFixed(2)}
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-medium">Collateral</div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">ETH:</span>
                      <span className="ml-1 font-medium text-gray-900 dark:text-white">{parseFloat(borrowerInfo.ethCollateral).toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">USDC:</span>
                      <span className="ml-1 font-medium text-gray-900 dark:text-white">{parseFloat(borrowerInfo.usdcCollateral).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {parseFloat(usdcAllowance) < parseFloat(borrowerInfo.usdcTotalOwed) && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 rounded-lg p-3 mb-4">
                    <div className="flex items-start">
                      <svg className="w-4 h-4 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="text-xs text-red-800 dark:text-red-300">
                        <strong>Approval Required:</strong> Approve USDC for repayment
                        <br />
                        Current allowance: {parseFloat(usdcAllowance).toFixed(2)} USDC
                      </div>
                    </div>
                  </div>
                )}
                
                <button 
                  onClick={handleRepayUsdc}
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center"
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
                    `Repay ${parseFloat(borrowerInfo.usdcTotalOwed).toFixed(2)} USDC`
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ETH Borrowing Tab */}
      {activeTab === 'ETH' && (
        <div className="space-y-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Borrow ETH Amount
            </label>
            <input
              type="number"
              step="0.000001"
              placeholder="0.0"
              value={borrowAmount}
              onChange={(e) => handleBorrowAmountChange(e.target.value)}
              className="input-field"
              disabled={loading}
            />
            
            {/* Real-time validation for borrow amount */}
            {borrowAmount && collateralAmount && (
              (() => {
                const validation = validateBorrowTransaction(borrowAmount, collateralAmount, 'ETH', collateralType);
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
                      Ready to borrow! You have sufficient {collateralType} balance and pool has enough liquidity.
                    </div>
                  </div>
                );
              })()
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Collateral Type
            </label>
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-6">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="collateralType"
                  value="ETH"
                  checked={collateralType === 'ETH'}
                  onChange={(e) => handleCollateralTypeChange(e.target.value as 'ETH' | 'USDC')}
                  className="mr-3 w-4 h-4 text-blue-600 dark:text-blue-400"
                />
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
                  </svg>
                  <span className="text-gray-700 dark:text-gray-300">ETH Collateral</span>
                </div>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="collateralType"
                  value="USDC"
                  checked={collateralType === 'USDC'}
                  onChange={(e) => handleCollateralTypeChange(e.target.value as 'ETH' | 'USDC')}
                  className="mr-3 w-4 h-4 text-green-600 dark:text-green-400"
                />
                <div className="flex items-center">
                  <div className="w-4 h-4 mr-2 bg-green-600 dark:bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">\$</span>
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">USDC Collateral</span>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Required Collateral ({collateralType}) - 150%
            </label>
            <input
              type="number"
              step={collateralType === 'ETH' ? '0.000001' : '0.01'}
              placeholder="0.0"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              className="input-field"
              disabled={loading}
            />
            
            {/* Show calculation when borrow amount is entered */}
            {collateralType === 'USDC' && borrowAmount && ethPriceUsd > 0 && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <strong>Calculation:</strong> {borrowAmount} ETH × \${ethPriceUsd.toFixed(2)} × 1.5 = {collateralAmount} USDC
              </div>
            )}
            
            {/* Show reverse calculation - how much you can borrow with current collateral */}
            {collateralAmount && parseFloat(collateralAmount) > 0 && ethPriceUsd > 0 && (
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 border border-blue-200 dark:border-blue-700/50">
                <div className="flex items-center mb-1">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <strong>Available to Borrow:</strong>
                </div>
                <div>
                  With {collateralAmount} {collateralType} collateral, you can borrow up to{' '}
                  <span className="font-semibold">{calculateMaxBorrowFromCollateral(collateralAmount, collateralType, 'ETH')} ETH</span>
                </div>
                {collateralType === 'USDC' && (
                  <div className="text-xs opacity-75 mt-1">
                    Calculation: {collateralAmount} USDC ÷ 1.5 ÷ \${ethPriceUsd.toFixed(2)} = {calculateMaxBorrowFromCollateral(collateralAmount, collateralType, 'ETH')} ETH
                  </div>
                )}
                {collateralType === 'ETH' && (
                  <div className="text-xs opacity-75 mt-1">
                    Calculation: {collateralAmount} ETH ÷ 1.5 = {calculateMaxBorrowFromCollateral(collateralAmount, collateralType, 'ETH')} ETH
                  </div>
                )}
              </div>
            )}

                        {/* Add button to set max borrowable amount */}
            {collateralAmount && parseFloat(collateralAmount) > 0 && ethPriceUsd > 0 && (
              <button
                type="button"
                onClick={() => {
                  const maxBorrow = calculateMaxBorrowFromCollateral(
                    collateralAmount, 
                    collateralType, 
                    'ETH'
                  );
                  setBorrowAmount(maxBorrow);
                }}
                className="mt-2 px-3 py-1.5 text-xs bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300 rounded-lg transition-colors duration-200"
              >
                Set Max Borrowable ({calculateMaxBorrowFromCollateral(collateralAmount, collateralType, 'ETH')} ETH)
              </button>
            )}
          </div>

          {collateralType === 'USDC' && parseFloat(usdcAllowance) < parseFloat(collateralAmount || '0') && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 rounded-xl p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <strong>Approval Required:</strong> You'll need to approve USDC for collateral usage.
                  <div className="mt-1 space-y-1">
                    <div>Current allowance: {parseFloat(usdcAllowance).toFixed(2)} USDC</div>
                    <div>Required: {collateralAmount} USDC</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleBorrowEth}
            disabled={
              loading || 
              !borrowAmount || 
              !collateralAmount || 
              parseFloat(borrowAmount) <= 0 ||
              !validateBorrowTransaction(borrowAmount, collateralAmount, 'ETH', collateralType).isValid
            }
            className="btn-primary w-full flex items-center justify-center min-h-[48px]"
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
              `Borrow ${borrowAmount || '0'} ETH with ${collateralAmount || '0'} ${collateralType}`
            )}
          </button>
        </div>
      )}

      {/* USDC Borrowing Tab */}
      {activeTab === 'USDC' && (
        <div className="space-y-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Borrow USDC Amount
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={borrowAmount}
              onChange={(e) => handleBorrowAmountChange(e.target.value)}
              className="input-field"
              disabled={loading}
            />
            
            {/* Real-time validation for USDC borrow amount */}
            {borrowAmount && collateralAmount && (
              (() => {
                const validation = validateBorrowTransaction(borrowAmount, collateralAmount, 'USDC', collateralType);
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
                      Ready to borrow! You have sufficient {collateralType} balance and pool has enough liquidity.
                    </div>
                  </div>
                );
              })()
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Collateral Type
            </label>
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-6">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="collateralTypeUsdc"
                  value="ETH"
                  checked={collateralType === 'ETH'}
                  onChange={(e) => handleCollateralTypeChange(e.target.value as 'ETH' | 'USDC')}
                  className="mr-3 w-4 h-4 text-blue-600 dark:text-blue-400"
                />
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
                  </svg>
                  <span className="text-gray-700 dark:text-gray-300">ETH Collateral</span>
                </div>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="collateralTypeUsdc"
                  value="USDC"
                  checked={collateralType === 'USDC'}
                  onChange={(e) => handleCollateralTypeChange(e.target.value as 'ETH' | 'USDC')}
                  className="mr-3 w-4 h-4 text-green-600 dark:text-green-400"
                />
                <div className="flex items-center">
                  <div className="w-4 h-4 mr-2 bg-green-600 dark:bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">$</span>
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">USDC Collateral</span>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Required Collateral ({collateralType}) - 150%
            </label>
            <input
              type="number"
              step={collateralType === 'ETH' ? '0.000001' : '0.01'}
              placeholder="0.0"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              className="input-field"
              disabled={loading}
            />
            
            {/* Show calculation when borrow amount is entered */}
            {collateralType === 'ETH' && borrowAmount && ethPriceUsd > 0 && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <strong>Calculation:</strong> {borrowAmount} USDC ÷ ${ethPriceUsd.toFixed(2)} × 1.5 = {collateralAmount} ETH
              </div>
            )}
            
            {/* Show reverse calculation - how much you can borrow with current collateral */}
            {collateralAmount && parseFloat(collateralAmount) > 0 && ethPriceUsd > 0 && (
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 border border-blue-200 dark:border-blue-700/50">
                <div className="flex items-center mb-1">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <strong>Available to Borrow:</strong>
                </div>
                <div>
                  With {collateralAmount} {collateralType} collateral, you can borrow up to{' '}
                  <span className="font-semibold">{calculateMaxBorrowFromCollateral(collateralAmount, collateralType, 'USDC')} USDC</span>
                </div>
                {collateralType === 'ETH' && (
                  <div className="text-xs opacity-75 mt-1">
                    Calculation: {collateralAmount} ETH × ${ethPriceUsd.toFixed(2)} ÷ 1.5 = {calculateMaxBorrowFromCollateral(collateralAmount, collateralType, 'USDC')} USDC
                  </div>
                )}
                {collateralType === 'USDC' && (
                  <div className="text-xs opacity-75 mt-1">
                    Calculation: {collateralAmount} USDC ÷ 1.5 = {calculateMaxBorrowFromCollateral(collateralAmount, collateralType, 'USDC')} USDC
                  </div>
                )}
              </div>
            )}

            {/* Add button to set max borrowable amount */}
            {collateralAmount && parseFloat(collateralAmount) > 0 && ethPriceUsd > 0 && (
              <button
                type="button"
                onClick={() => {
                  const maxBorrow = calculateMaxBorrowFromCollateral(
                    collateralAmount, 
                    collateralType, 
                    'USDC'
                  );
                  setBorrowAmount(maxBorrow);
                }}
                className="mt-2 px-3 py-1.5 text-xs bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300 rounded-lg transition-colors duration-200"
              >
                Set Max Borrowable ({calculateMaxBorrowFromCollateral(collateralAmount, collateralType, 'USDC')} USDC)
              </button>
            )}
          </div>

          {collateralType === 'USDC' && parseFloat(usdcAllowance) < parseFloat(collateralAmount || '0') && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 rounded-xl p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <strong>Approval Required:</strong> You'll need to approve USDC for collateral usage.
                  <div className="mt-1 space-y-1">
                    <div>Current allowance: {parseFloat(usdcAllowance).toFixed(2)} USDC</div>
                    <div>Required: {collateralAmount} USDC</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleBorrowUsdc}
            disabled={
              loading || 
              !borrowAmount || 
              !collateralAmount || 
              parseFloat(borrowAmount) <= 0 ||
              !validateBorrowTransaction(borrowAmount, collateralAmount, 'USDC', collateralType).isValid
            }
            className="btn-primary w-full flex items-center justify-center min-h-[48px]"
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
              `Borrow ${borrowAmount || '0'} USDC with ${collateralAmount || '0'} ${collateralType}`
            )}
          </button>
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

export default MultiAssetBorrowingInterface;
