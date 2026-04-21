# 📊 Advertising-Analyzer

A powerful dashboard for analyzing Amazon advertising and Merch on Demand data. This tool allows you to import Amazon reports (CSV/XLSX) and visualize your performance metrics in a centralized, glassmorphic interface.


## ✨ Features

- **Multi-Report Support**: Import and analyze Merch on Demand Sales, Sponsored Products (SP), and Sponsored Brands (SB) reports.
- **Dynamic Profiles**: Save different views and data sets as profiles to switch between them easily.
- **Privacy Mode**: Quickly hide sensitive ASIN and financial data for safe sharing or public viewing.
- **Customizable UI**: Adjust column visibility and configuration through a dedicated settings modal.
- **SQLite Backend**: Local, high-performance data storage for immediate access without cloud dependencies.
- **Responsive Design**: Modern, glassmorphic UI built with Vanilla CSS and React.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 22.0.0 or higher is required.
- **npm**: Usually comes with Node.js.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/foreigner-ops/advertising-analyze-dashboard
   cd advertising-analyze-dashboard
   ```

2. **Configure the client API base**:
   ```bash
   cp client/.env.example client/.env
   ```
   Edit `client/.env` if your API is not running at `http://localhost:3001`.

3. **Automated Setup**:
   The project includes a convenient setup script that installs all dependencies for both the frontend and backend:
   ```bash
   npm run setup
   ```

### Usage

To start both the server and the client concurrently, simply run:

```bash
npm start
```

- **Frontend**: Accessible at `http://localhost:5173` (standard Vite port) or as configured.
- **Backend API**: Runs on `http://localhost:3001`.
- **Client API base**: Controlled with `VITE_API_BASE_URL` in `client/.env`.

## 📥 Importing Data

Go to the **Import** tab to upload your Amazon reports:

1. **Merch Sales Rep**: Your Merch on Demand sales report (CSV/XLSX).
2. **SP Prod Rep**: Sponsored Products product reports.
3. **SB Camp Rep**: Sponsored Brands campaign reports.

Once uploaded, the system will process the rows and create a new timestamped profile for your data.

## 🛠 Tech Stack

- **Frontend**: React, Lucide-React, Vite
- **Backend**: Node.js, Express, SQLite3
- **Styling**: Vanilla CSS (Modern Design System)
- **Utilities**: `csv-parser`, `xlsx`, `concurrently`

## 📂 Project Structure

- `/client`: React frontend source code and components.
- `/server`: Node.js backend, API routes, and CSV processing logic.
- `analyzer.db`: The SQLite database (generated on first run).
- `package.json`: Main project configuration and workspace scripts.

---


**Credits**: The original Google spreadsheet script that inspired this dashboard was created by **Mark Shaggy**.
