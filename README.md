# Proof of Restrain - Blockchain Self-Discipline Platform

A blockchain-based platform for creating accountability contracts with real financial stakes.

## ��� Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MetaMask wallet
- Alchemy account (for blockchain RPC)

## ��� Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/riddhi-rathi/proof-of-restrain.git
cd proof-of-restrain
```

### 2. Environment Setup

Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Edit `.env` and add your actual keys:
- **Alchemy API**: Get from https://www.alchemy.com/
- **Private Key**: From MetaMask (Settings > Security & Privacy)
- **OpenAI/Anthropic**: Get API keys if using AI features

### 3. Install Dependencies

**Root (Smart Contracts):**
```bash
npm install
```

**Frontend:**
```bash
cd proof-of-restrain
npm install
cd ..
```

### 4. Run the Application

**Start Frontend:**
```bash
cd proof-of-restrain
npm run dev
```

The app will be available at `http://localhost:5173`

## ���️ Project Structure
```
├── backend/              # Backend API
├── contracts/            # Smart contracts (Solidity)
├── proof-of-restrain/    # Frontend (React + Vite)
├── scripts/              # Deployment scripts
└── test/                 # Contract tests
```

## ��� Smart Contract Deployment
```bash
# Compile contracts
npx hardhat compile

# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia
```

## ��� Troubleshooting

**"Module not found" errors:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Also in frontend
cd proof-of-restrain
rm -rf node_modules package-lock.json
npm install
```

**MetaMask issues:**
- Switch to Sepolia testnet
- Get test ETH: https://sepoliafaucet.com/

## ��� Environment Variables

Required in `.env`:
- `PRIVATE_KEY` - Your wallet private key
- `ALCHEMY_API_KEY` - Alchemy RPC key
- `VITE_CONTRACT_ADDRESS` - Deployed contract address
- `VITE_OPENAI_API_KEY` - OpenAI API key (optional)

## ��� Deployed Links

- **Frontend**: https://funny-banoffee-691c2b.netlify.app/
- **Smart Contract**: Deployment to Sepolia testnet pending

## ��� License

MIT
