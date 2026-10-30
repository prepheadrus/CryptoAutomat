# 🚀 CryptoAutomat

![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg)
![Architecture](https://img.shields.io/badge/Architecture-Event--Driven%20%7C%20Clean%20%7C%20DDD-purple.svg)
![Status](https://img.shields.io/badge/Status-Production--Ready-success.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

**CryptoAutomat** is an enterprise-grade, high-performance algorithmic cryptocurrency trading engine designed for 24/7 continuous operation. It features multi-timeframe (MTF) trend confluence, machine learning-based signal confirmation, dynamic risk & capital management, and a modern real-time web dashboard.

---

## 🌟 Key Features

- **⚡ Event-Driven & Clean Architecture:** Domain-Driven Design (DDD) with decoupled core services, asynchronous messaging via an internal Event Bus, and non-blocking asynchronous I/O.
- **🛡️ Advanced Risk & Capital Management:**
  - Dynamic ATR-based Stop-Loss and Take-Profit with Trailing ATR Stop capabilities.
  - System-level protection via **Circuit Breaker** (halting on API/feed anomalies) and **Kill Switch** (loss limit guardrails).
  - Volatility-adjusted and ML confidence-weighted Dynamic Position Sizing.
- **🧠 Machine Learning Integration (ML Engine):**
  - XGBoost and k-NN powered trend & momentum confirmation layers.
  - Model Drift detection and Walk-Forward Optimization (WFO) to mitigate overfitting.
- **📊 Multi-Timeframe (MTF) Analysis:**
  - Golden-ratio higher-timeframe (HTF) trend filtering to prevent counter-trend entries during adverse market regimes.
- **🎛️ No-Code Strategy Builder & Strategy Lab:**
  - Intuitive web interface to define indicators, build logical entry/exit rules, and run instant backtests without writing code.
- **🖥️ Live Web Dashboard:**
  - Integrated with TradingView Lightweight Charts for real-time candlestick rendering.
  - Live order tracking, open positions, balance breakdowns, and performance analytics.
- **💾 High-Throughput Data Infrastructure:**
  - Local Parquet Data Lake & Superalgos-inspired flat storage with SQLite for ACID-compliant trade journaling.

---

## 🏗️ System Architecture

```
CryptoAutomat/
├── api/                  # FastAPI Web API (Routers, Schemas, Services)
│   ├── routers/          # Endpoint controllers (bot, data, ml, strategy, trades)
│   ├── schemas/          # Pydantic data schemas
│   └── services/         # Business logic layer
├── core/                 # Core Trading Engine
│   ├── bot/              # Bot lifecycle & process management
│   ├── diagnostics/      # Event tracing and system telemetry
│   ├── risk/             # Dynamic risk engine and rule sets
│   ├── trading/          # Order and position state managers
│   ├── exchange.py       # Asynchronous CCXT exchange client (Binance)
│   ├── paper.py          # Paper trading simulation engine
│   └── wfo_engine.py     # Walk-Forward Optimization runner
├── data/                 # Data Layer
│   ├── indicators/       # Technical indicators (Trend, Momentum, Volatility, Volume)
│   ├── storage/          # Parquet Data Lake storage implementation
│   └── database.py       # Async SQLite database interface
├── frontend/             # Responsive Web Dashboard (HTML5, Vanilla JS, CSS3, Charts)
├── ml/                   # Machine Learning Pipeline (Training, Inference, Drift)
├── models/               # Model architectures (XGBoost, k-NN)
├── strategy/             # Trading Strategies & Strategy Builder engine
├── tests/                # Automated Unit and End-to-End (E2E) Test Suite
├── config.example.yaml   # Configuration template
└── main.py               # Main application entry point
```

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.10+** (Tested on Python 3.10, 3.11, 3.12)
- **Git**
- *(Optional)* Binance API credentials for live execution

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/prepheadrus/CryptoAutomat.git
cd CryptoAutomat
```

---

### Step 2: Automated or Manual Setup

#### Option A: Automated Setup (Recommended)

- **Windows:**
  Double-click `setup.bat` or run:
  ```cmd
  setup.bat
  ```
- **Linux/macOS:**
  ```bash
  chmod +x setup.sh
  ./setup.sh
  ```

#### Option B: Manual Setup

1. **Create and activate a virtual environment:**
   ```bash
   python -m venv venv
   # Windows (CMD):
   venv\Scripts\activate.bat
   # Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   # Linux/macOS:
   source venv/bin/activate
   ```

2. **Install project dependencies:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

3. **Initialize configuration files:**
   - On Windows:
     ```cmd
     copy config.example.yaml config.yaml
     copy .env.example .env
     ```
   - On Linux / macOS:
     ```bash
     cp config.example.yaml config.yaml
     cp .env.example .env
     ```

---

### Step 3: Run the Application

```bash
python main.py
```

- **Web Dashboard:** Open [http://localhost:3000](http://localhost:3000) in your web browser.
- **Interactive Swagger API Docs:** Open [http://localhost:3000/docs](http://localhost:3000/docs).
- **System Health Check:** Open [http://localhost:3000/api/v1/health](http://localhost:3000/api/v1/health).

*(Note: The default port is `3000`. You can change it at any time by setting the `PORT` environment variable).*

---

## 🧪 Verification & Critical Tests

To verify that the execution engine, concurrency protections, and double-close prevention mechanisms are functioning properly:

```bash
python run_tests.py
```

All race-condition and zombie-position prevention tests should output `PASSED`.

---

## 🔒 Security

- Sensitive API credentials stored in `.env` are encrypted at rest using **Fernet (AES-128-CBC)** via `core/security.py`.
- Encryption keys (`.secret.key`), `.env`, and local database files are excluded from version control by default.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
