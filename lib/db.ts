import { sql } from '@vercel/postgres';

export async function initializeDatabase() {
  try {
    // Create guests table (removed party_size - now calculated from group)
    await sql`
      CREATE TABLE IF NOT EXISTS guests (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        notes TEXT,
        is_ghost BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create groups table
    await sql`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        lead_guest_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create group_memberships table (links guests to groups)
    await sql`
      CREATE TABLE IF NOT EXISTS group_memberships (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL,
        guest_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_id, guest_id)
      )
    `;

    // Create tables table
    await sql`
      CREATE TABLE IF NOT EXISTS tables (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        capacity INTEGER NOT NULL DEFAULT 6,
        x INTEGER DEFAULT 250,
        y INTEGER DEFAULT 200,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create assignments table
    await sql`
      CREATE TABLE IF NOT EXISTS assignments (
        id SERIAL PRIMARY KEY,
        guest_id INTEGER NOT NULL,
        table_id INTEGER NOT NULL,
        day VARCHAR(10) NOT NULL,
        service_id INTEGER NOT NULL,
        seats INTEGER DEFAULT 1,
        party_size_override INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guest_id, table_id, day, service_id)
      )
    `;

    // Keep old group_members table for migration, but we'll phase it out
    await sql`
      CREATE TABLE IF NOT EXISTS group_members (
        id SERIAL PRIMARY KEY,
        main_guest_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create member_arrivals table for individual arrival tracking
    await sql`
      CREATE TABLE IF NOT EXISTS member_arrivals (
        id SERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL,
        day VARCHAR(10) NOT NULL,
        arrived BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(member_id, day)
      )
    `;

    // Migration: Add party_size_override column if it doesn't exist
    try {
      await sql`
        ALTER TABLE assignments 
        ADD COLUMN IF NOT EXISTS party_size_override INTEGER
      `;
    } catch (error) {
      // Column might already exist, ignore error
    }

    // Migration: Add is_ghost column to guests table
    try {
      await sql`
        ALTER TABLE guests 
        ADD COLUMN IF NOT EXISTS is_ghost BOOLEAN DEFAULT false
      `;
    } catch (error) {
      // Column might already exist, ignore error
    }

    // Migration: Add party_size column for backward compatibility
    try {
      await sql`
        ALTER TABLE guests 
        ADD COLUMN IF NOT EXISTS party_size INTEGER DEFAULT 1
      `;
    } catch (error) {
      // Column might already exist, ignore error
    }

    // Migration: Add is_manually_added column to guests table
    try {
      await sql`
        ALTER TABLE guests 
        ADD COLUMN IF NOT EXISTS is_manually_added BOOLEAN DEFAULT false
      `;
    } catch (error) {
      // Column might already exist, ignore error
    }

    // Create arrivals table
    await sql`
      CREATE TABLE IF NOT EXISTS arrivals (
        id SERIAL PRIMARY KEY,
        guest_id INTEGER NOT NULL,
        day VARCHAR(10) NOT NULL,
        arrived BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guest_id, day)
      )
    `;

    // Create blocked_tables table
    await sql`
      CREATE TABLE IF NOT EXISTS blocked_tables (
        id SERIAL PRIMARY KEY,
        table_id INTEGER NOT NULL,
        day VARCHAR(10) NOT NULL,
        service_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(table_id, day, service_id)
      )
    `;

    // Create departures table
    await sql`
      CREATE TABLE IF NOT EXISTS departures (
        id SERIAL PRIMARY KEY,
        guest_id INTEGER NOT NULL,
        day VARCHAR(10) NOT NULL,
        service_id INTEGER NOT NULL,
        departed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guest_id, day, service_id)
      )
    `;

    return { success: true };
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

export { sql };
