import "@nomiclabs/hardhat-waffle";
import "solidity-coverage";
import "hardhat-spdx-license-identifier";
import "hardhat-gas-reporter";
import "@nomiclabs/hardhat-etherscan";

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

export default {
  etherscan: {
    apiKey: "E4I32GBN6RGT3153SFHMQM69EVFGT6ZIX1",
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    gasPrice: 100,
  },
  spdxLicenseIdentifier: {
    overwrite: false,
    runOnCompile: true,
  },
  solidity: {
    compilers :[
      {
        version: "0.6.12",
        settings: {
          optimizer : {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.5.17",
        settings: {
          optimizer : {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  mocha: {
    timeout: 6000000000000
  },
  networks: {
    hardhat: {
      gas: 10000000,
      accounts: {
        accountsBalance: "10000000000000000000000000"
      },
      allowUnlimitedContractSize: true,
      timeout: 6000000000000,
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/90dtUWHmLmwbYpvIeC53UpAICALKyoIu",
        blockNumber: 13726251
      }
    },
    coverage: {
      url: 'http://localhost:8555'
    }
  }
};

