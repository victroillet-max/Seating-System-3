import { NextResponse } from 'next/server';
import { initializeDatabase, sql } from '@/lib/db';

export async function POST() {
  try {
    await initializeDatabase();
    
    // Migration: Add seats column if it doesn't exist
    try {
      await sql`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS seats INTEGER DEFAULT 1`;
      
      // Migration: Drop old unique constraint and add new one
      await sql`
        DO $$ 
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'assignments_guest_id_day_service_id_key'
          ) THEN
            ALTER TABLE assignments DROP CONSTRAINT assignments_guest_id_day_service_id_key;
          END IF;
        END $$;
      `;
      
      // Add new unique constraint
      await sql`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'assignments_guest_id_table_id_day_service_id_key'
          ) THEN
            ALTER TABLE assignments ADD CONSTRAINT assignments_guest_id_table_id_day_service_id_key 
            UNIQUE (guest_id, table_id, day, service_id);
          END IF;
        END $$;
      `;
    } catch (migrationError) {
      console.log('Migration already applied or error:', migrationError);
    }
    
    // Check if tables exist and add default tables if empty
    const existingTables = await sql`SELECT COUNT(*) as count FROM tables`;
    
    if (parseInt(existingTables.rows[0].count) === 0) {
      // Insert default tables
      const defaultTables = [
        { name: 'Table 1', capacity: 8, x: 50, y: 50 },
        { name: 'Table 2', capacity: 8, x: 200, y: 50 },
        { name: 'Table 3', capacity: 6, x: 350, y: 50 },
        { name: 'Table 4', capacity: 6, x: 50, y: 200 },
        { name: 'Table 5', capacity: 10, x: 200, y: 200 },
        { name: 'Table 6', capacity: 10, x: 350, y: 200 },
        { name: 'Table 7', capacity: 4, x: 50, y: 350 },
        { name: 'Table 8', capacity: 4, x: 200, y: 350 },
      ];
      
      for (const table of defaultTables) {
        await sql`
          INSERT INTO tables (name, capacity, x, y)
          VALUES (${table.name}, ${table.capacity}, ${table.x}, ${table.y})
        `;
      }
    }
    
    return NextResponse.json({ success: true, message: 'Database initialized' });
  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json({ error: 'Failed to initialize database' }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
