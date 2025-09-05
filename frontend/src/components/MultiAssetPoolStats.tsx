import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../hooks/useWeb3';
import { useTheme } from '../contexts/ThemeContext';

interface MultiAssetPoolStats {
  ethTotalLiquidity: string;
  usdcTotalLiquidity: string;
  ethUtilizationRate: string;
  usdcUtilizationRate: string;
  ethLendRate: string;
  usdcLendRate: string;
  ethBorrowRate: string;
  usdcBorrowRate: string;
}

const MultiAssetPoolStats: React.FC = () => {
  const { multiAssetContract, provider } = useWeb3();
  const { isDark } = useTheme();
  const [stats, setStats] = useState<MultiAssetPoolStats>({
    ethTotalLiquidity: '0',
    usdcTotalLiquidity: '0',
    ethUtilizationRate: '0',
    usdcUtilizationRate: '0',
    ethLendRate: '0',
    usdcLendRate: '0',
    ethBorrowRate: '0',
    usdcBorrowRate: '0'
  });
  const [loading, setLoading] = useState(true);

  const fetchPoolStats = async () => {
    if (!multiAssetContract || !provider) return;
    
    try {
      const poolStats = await multiAssetContract.getMultiAssetPoolStats();
      setStats({
        ethTotalLiquidity: ethers.utils.formatEther(poolStats.ethTotalLiquidity),
        usdcTotalLiquidity: ethers.utils.formatUnits(poolStats.usdcTotalLiquidity, 6),
        ethUtilizationRate: (poolStats.ethUtilizationRate.toNumber() / 10000).toFixed(2),
        usdcUtilizationRate: (poolStats.usdcUtilizationRate.toNumber() / 10000).toFixed(2),
        ethLendRate: (poolStats.ethLendRate.toNumber() / 10000).toFixed(2),
        usdcLendRate: (poolStats.usdcLendRate.toNumber() / 10000).toFixed(2),
        ethBorrowRate: (poolStats.ethBorrowRate.toNumber() / 10000).toFixed(2),
        usdcBorrowRate: (poolStats.usdcBorrowRate.toNumber() / 10000).toFixed(2)
      });
    } catch (error) {
      console.error('Error fetching multi-asset pool stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoolStats();
    const interval = setInterval(fetchPoolStats, 15000);
    return () => clearInterval(interval);
  }, [multiAssetContract, provider]);

  if (loading) {
    return (
      <div className="space-y-8 mb-8">
        {/* ETH Pool Loading */}
        <div className="animate-pulse">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-xl mr-3"></div>
            <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-48"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-3"></div>
                <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
              </div>
            ))}
          </div>
        </div>
        
        {/* USDC Pool Loading */}
        <div className="animate-pulse">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-xl mr-3"></div>
            <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-48"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-3"></div>
                <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const StatCard = ({ title, value, type, icon }: { 
    title: string; 
    value: string; 
    type: 'liquidity' | 'utilization' | 'lending' | 'borrowing';
    icon?: React.ReactNode;
  }) => {
    const getColorClasses = () => {
      switch (type) {
        case 'liquidity':
          return 'text-gray-900 dark:text-white';
        case 'utilization':
          return 'text-blue-600 dark:text-blue-300';
        case 'lending':
          return 'text-green-600 dark:text-green-300';
        case 'borrowing':
          return 'text-red-500 dark:text-red-300';
        default:
          return 'text-gray-900 dark:text-white';
      }
    };

    const getBgClasses = () => {
      switch (type) {
        case 'liquidity':
          return 'bg-white/90 dark:bg-gray-800/90 border-gray-200 dark:border-gray-600';
        case 'utilization':
          return 'bg-blue-50/90 dark:bg-blue-900/40 border-blue-200 dark:border-blue-700';
        case 'lending':
          return 'bg-green-50/90 dark:bg-green-900/40 border-green-200 dark:border-green-700';
        case 'borrowing':
          return 'bg-red-50/90 dark:bg-red-900/40 border-red-200 dark:border-red-700';
        default:
          return 'bg-white/90 dark:bg-gray-800/90 border-gray-200 dark:border-gray-600';
      }
    };

    return (
      <div className={`${getBgClasses()} backdrop-blur-sm rounded-2xl p-6 border-2 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</div>
          {icon && <div className="opacity-70">{icon}</div>}
        </div>
        <div className={`text-2xl font-bold ${getColorClasses()}`}>
          {value}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 mb-8">
      {/* ETH Pool Stats */}
      <div>
        <div className="flex items-center mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 dark:from-blue-500 dark:to-indigo-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">ETH Pool Statistics</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Real-time Ethereum pool metrics</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Liquidity"
            value={`${parseFloat(stats.ethTotalLiquidity).toFixed(4)} ETH`}
            type="liquidity"
            icon={
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          <StatCard
            title="Utilization Rate"
            value={`${stats.ethUtilizationRate}%`}
            type="utilization"
            icon={
              <svg className="w-5 h-5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
          <StatCard
            title="Lending APY"
            value={`${stats.ethLendRate}%`}
            type="lending"
            icon={
              <svg className="w-5 h-5 text-green-500 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
          <StatCard
            title="Borrowing APY"
            value={`${stats.ethBorrowRate}%`}
            type="borrowing"
            icon={
              <svg className="w-5 h-5 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            }
          />
        </div>
      </div>

      {/* USDC Pool Stats */}
      <div>
        <div className="flex items-center mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-700 dark:from-green-500 dark:to-emerald-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
              <span className="text-green-600 text-sm font-bold">$</span>
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">USDC Pool Statistics</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Real-time USD Coin pool metrics</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Liquidity"
            value={`${parseFloat(stats.usdcTotalLiquidity).toFixed(2)} USDC`}
            type="liquidity"
            icon={
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          <StatCard
            title="Utilization Rate"
            value={`${stats.usdcUtilizationRate}%`}
            type="utilization"
            icon={
              <svg className="w-5 h-5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
          <StatCard
            title="Lending APY"
            value={`${stats.usdcLendRate}%`}
            type="lending"
            icon={
              <svg className="w-5 h-5 text-green-500 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
          <StatCard
            title="Borrowing APY"
            value={`${stats.usdcBorrowRate}%`}
            type="borrowing"
            icon={
              <svg className="w-5 h-5 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  );
};

export default MultiAssetPoolStats;
