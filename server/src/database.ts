/**
 * SQLite Database Module
 * Handles user PKP wallets, trades, and balances
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Database path from env or default
const DB_PATH =
  process.env.DATABASE_PATH || path.join(__dirname, "../data/whispers.db");

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL"); // Better performance with concurrent access

/**
 * Initialize database schema
 */
export function initializeDatabase(): void {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pkp_address TEXT UNIQUE NOT NULL,
      pkp_public_key TEXT NOT NULL,
      pkp_token_id TEXT NOT NULL,
      auth_method TEXT NOT NULL,
      auth_value TEXT,
      jwt TEXT NOT NULL,
      jwt_expires_at INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      last_login_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Trades table
  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      market_id TEXT NOT NULL,
      token_id TEXT NOT NULL,
      side TEXT NOT NULL,
      amount REAL NOT NULL,
      price REAL NOT NULL,
      shares REAL NOT NULL,
      order_id TEXT,
      tx_hash TEXT,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Wallet balances table
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_balances (
      user_id INTEGER PRIMARY KEY,
      usdc_balance TEXT DEFAULT '0',
      pol_balance TEXT DEFAULT '0',
      last_updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_pkp_address ON users(pkp_address);
    CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
  `);

  console.log("[Database] Schema initialized successfully");
}

/**
 * User data types
 */
export interface User {
  id: number;
  pkp_address: string;
  pkp_public_key: string;
  pkp_token_id: string;
  auth_method: string;
  auth_value?: string;
  jwt: string;
  jwt_expires_at: number;
  created_at: number;
  last_login_at: number;
}

export interface CreateUserParams {
  pkpAddress: string;
  pkpPublicKey: string;
  pkpTokenId: string;
  authMethod: string;
  authValue?: string;
  jwt: string;
  jwtExpiresAt: number;
}

export interface Trade {
  id: number;
  user_id: number;
  market_id: string;
  token_id: string;
  side: "BUY" | "SELL";
  amount: number;
  price: number;
  shares: number;
  order_id?: string;
  tx_hash?: string;
  status: "pending" | "confirmed" | "failed";
  error_message?: string;
  created_at: number;
}

export interface CreateTradeParams {
  userId: number;
  marketId: string;
  tokenId: string;
  side: "BUY" | "SELL";
  amount: number;
  price: number;
  shares: number;
}

export interface WalletBalance {
  user_id: number;
  usdc_balance: string;
  pol_balance: string;
  last_updated_at: number;
}

/**
 * User operations
 */
export const UserDB = {
  /**
   * Create or update user from Vincent JWT
   */
  upsertUser(params: CreateUserParams): User {
    const stmt = db.prepare(`
      INSERT INTO users (
        pkp_address, pkp_public_key, pkp_token_id, 
        auth_method, auth_value, jwt, jwt_expires_at,
        last_login_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
      ON CONFLICT(pkp_address) DO UPDATE SET
        jwt = excluded.jwt,
        jwt_expires_at = excluded.jwt_expires_at,
        last_login_at = strftime('%s', 'now')
      RETURNING *
    `);

    return stmt.get(
      params.pkpAddress,
      params.pkpPublicKey,
      params.pkpTokenId,
      params.authMethod,
      params.authValue || null,
      params.jwt,
      params.jwtExpiresAt
    ) as User;
  },

  /**
   * Get user by PKP address
   */
  getByPkpAddress(pkpAddress: string): User | undefined {
    const stmt = db.prepare("SELECT * FROM users WHERE pkp_address = ?");
    return stmt.get(pkpAddress) as User | undefined;
  },

  /**
   * Get user by ID
   */
  getById(userId: number): User | undefined {
    const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
    return stmt.get(userId) as User | undefined;
  },

  /**
   * Update user JWT
   */
  updateJwt(pkpAddress: string, jwt: string, expiresAt: number): void {
    const stmt = db.prepare(`
      UPDATE users 
      SET jwt = ?, jwt_expires_at = ?, last_login_at = strftime('%s', 'now')
      WHERE pkp_address = ?
    `);
    stmt.run(jwt, expiresAt, pkpAddress);
  },

  /**
   * Check if JWT is expired
   */
  isJwtExpired(user: User): boolean {
    const now = Math.floor(Date.now() / 1000);
    return user.jwt_expires_at <= now;
  },

  /**
   * Get all users
   */
  getAll(): User[] {
    const stmt = db.prepare("SELECT * FROM users ORDER BY created_at DESC");
    return stmt.all() as User[];
  },
};

/**
 * Trade operations
 */
export const TradeDB = {
  /**
   * Create a new trade
   */
  create(params: CreateTradeParams): Trade {
    const stmt = db.prepare(`
      INSERT INTO trades (
        user_id, market_id, token_id, side, 
        amount, price, shares, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      RETURNING *
    `);

    return stmt.get(
      params.userId,
      params.marketId,
      params.tokenId,
      params.side,
      params.amount,
      params.price,
      params.shares
    ) as Trade;
  },

  /**
   * Update trade with order ID
   */
  updateOrderId(tradeId: number, orderId: string): void {
    const stmt = db.prepare(`
      UPDATE trades 
      SET order_id = ?, status = 'confirmed'
      WHERE id = ?
    `);
    stmt.run(orderId, tradeId);
  },

  /**
   * Update trade with transaction hash
   */
  updateTxHash(tradeId: number, txHash: string): void {
    const stmt = db.prepare(`
      UPDATE trades 
      SET tx_hash = ?, status = 'confirmed'
      WHERE id = ?
    `);
    stmt.run(txHash, tradeId);
  },

  /**
   * Mark trade as failed
   */
  markFailed(tradeId: number, errorMessage: string): void {
    const stmt = db.prepare(`
      UPDATE trades 
      SET status = 'failed', error_message = ?
      WHERE id = ?
    `);
    stmt.run(errorMessage, tradeId);
  },

  /**
   * Get trade by ID
   */
  getById(tradeId: number): Trade | undefined {
    const stmt = db.prepare("SELECT * FROM trades WHERE id = ?");
    return stmt.get(tradeId) as Trade | undefined;
  },

  /**
   * Get all trades for a user
   */
  getByUserId(userId: number, limit = 100): Trade[] {
    const stmt = db.prepare(`
      SELECT * FROM trades 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(userId, limit) as Trade[];
  },

  /**
   * Get pending trades
   */
  getPending(userId: number): Trade[] {
    const stmt = db.prepare(`
      SELECT * FROM trades 
      WHERE user_id = ? AND status = 'pending'
      ORDER BY created_at DESC
    `);
    return stmt.all(userId) as Trade[];
  },
};

/**
 * Wallet balance operations
 */
export const BalanceDB = {
  /**
   * Update wallet balances
   */
  update(
    userId: number,
    usdcBalance: string,
    polBalance: string
  ): WalletBalance {
    const stmt = db.prepare(`
      INSERT INTO wallet_balances (user_id, usdc_balance, pol_balance, last_updated_at)
      VALUES (?, ?, ?, strftime('%s', 'now'))
      ON CONFLICT(user_id) DO UPDATE SET
        usdc_balance = excluded.usdc_balance,
        pol_balance = excluded.pol_balance,
        last_updated_at = strftime('%s', 'now')
      RETURNING *
    `);

    return stmt.get(userId, usdcBalance, polBalance) as WalletBalance;
  },

  /**
   * Get wallet balances for user
   */
  get(userId: number): WalletBalance | undefined {
    const stmt = db.prepare("SELECT * FROM wallet_balances WHERE user_id = ?");
    return stmt.get(userId) as WalletBalance | undefined;
  },

  /**
   * Check if balances are stale (older than 5 minutes)
   */
  isStale(balance: WalletBalance | undefined): boolean {
    if (!balance) return true;
    const now = Math.floor(Date.now() / 1000);
    const FIVE_MINUTES = 5 * 60;
    return now - balance.last_updated_at > FIVE_MINUTES;
  },
};

/**
 * Close database connection
 */
export function closeDatabase(): void {
  db.close();
  console.log("[Database] Connection closed");
}

/**
 * Get database instance for advanced queries
 */
export function getDatabase(): Database.Database {
  return db;
}

// Initialize on import
initializeDatabase();
