// Updated App.tsx
import React, { useEffect } from 'react';
import WalletConnection from './components/WalletConnection';
import MultiAssetPoolStats from './components/MultiAssetPoolStats';
import MultiAssetLendingInterface from './components/MultiAssetLendingInterface';
import MultiAssetBorrowingInterface from './components/MultiAssetBorrowingInterface';
import { useWeb3 } from './hooks/useWeb3';
import { ThemeProvider } from './contexts/ThemeContext';

function AppContent() {
  const { isConnected, isConnecting, checkConnection } = useWeb3();

  // Check connection status on app load
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Show loading state while checking connection
  if (isConnecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Checking wallet connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      <WalletConnection />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Force re-render based on isConnected state */}
        {isConnected === false ? (
          // Not connected view - Project Introduction
          <div className="flex items-center justify-center min-h-[70vh]">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              {/* Hero Section */}
              <div className="space-y-6">
                <div className="flex justify-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 dark:from-blue-500 dark:to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
                
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                  Multi-Asset DeFi Protocol
                </h1>
                
                <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
                  A next-generation decentralized finance platform enabling seamless lending, borrowing, and yield farming across multiple assets
                </p>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
                <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Multi-Asset Lending</h3>
                  <p className="text-gray-600 dark:text-gray-400">Supply ETH, USDC, and other assets to earn competitive yields with dynamic interest rates</p>
                </div>

                <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Flexible Borrowing</h3>
                  <p className="text-gray-600 dark:text-gray-400">Borrow against your collateral with optimized loan-to-value ratios and competitive rates</p>
                </div>

                <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mb-4 mx-auto">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Secure Protocol</h3>
                  <p className="text-gray-600 dark:text-gray-400">Built with security-first principles, audited smart contracts, and decentralized governance</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">USD 10M+</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total Value Locked</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">5+</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Supported Assets</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">24/7</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Protocol Uptime</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400">0%</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Protocol Fees</div>
                </div>
              </div>

              {/* Network Info */}
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg mt-12">
                <div className="flex items-center justify-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                    <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Deployed on Arbitrum Sepolia</span>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-center max-w-2xl mx-auto">
                  Experience fast, low-cost transactions on Arbitrum's Layer 2 scaling solution. Connect your wallet to start lending, borrowing, and earning yield.
                </p>
              </div>

              {/* CTA */}
              <div className="mt-12">
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                  Ready to get started? Connect your wallet to access the protocol.
                </p>
                <div className="flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Connected view
          <div className="space-y-8">
            <MultiAssetPoolStats />
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                <MultiAssetLendingInterface />
              </div>
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                <MultiAssetBorrowingInterface />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;

