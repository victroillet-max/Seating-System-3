import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const result = await sql`
      SELECT table_id as "tableId", day, service_id as "serviceId"
      FROM blocked_tables
    `;
    
    // Convert to the format expected by the frontend
    const blocked: Record<string, boolean> = {};
    for (const row of result.rows) {
      const key = `${row.day}-${row.serviceId}-${row.tableId}`;
      blocked[key] = true;
    }
    
    return NextResponse.json(blocked);
  } catch (error) {
    console.error('Get blocked tables error:', error);
    return NextResponse.json({ error: 'Failed to fetch blocked tables' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tableId, day, serviceId, blocked } = body;
    
    if (blocked) {
      // Add to blocked tables
      await sql`
        INSERT INTO blocked_tables (table_id, day, service_id)
        VALUES (${tableId}, ${day}, ${serviceId})
        ON CONFLICT (table_id, day, service_id) DO NOTHING
      `;
    } else {
      // Remove from blocked tables
      await sql`
        DELETE FROM blocked_tables 
        WHERE table_id = ${tableId} AND day = ${day} AND service_id = ${serviceId}
      `;
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update blocked table error:', error);
    return NextResponse.json({ error: 'Failed to update blocked table' }, { status: 500 });
  }
}
