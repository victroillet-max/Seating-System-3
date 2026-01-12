import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const result = await sql`
      SELECT guest_id as "guestId", table_id as "tableId", day, service_id as "serviceId", 
             COALESCE(seats, 1) as seats, party_size_override as "partySizeOverride"
      FROM assignments
    `;
    
    // Convert to the format expected by the frontend
    const assignments: Record<string, number[]> = {};
    const seatAllocations: Record<string, Record<number, number>> = {};
    const partySizeOverrides: Record<string, number> = {};
    
    for (const row of result.rows) {
      const key = `${row.day}-${row.serviceId}-${row.tableId}`;
      if (!assignments[key]) {
        assignments[key] = [];
      }
      // Add guest ID for each seat they occupy
      for (let i = 0; i < row.seats; i++) {
        assignments[key].push(row.guestId);
      }
      
      // Track seat allocations per guest
      const allocKey = `${row.day}-${row.serviceId}-${row.guestId}`;
      if (!seatAllocations[allocKey]) {
        seatAllocations[allocKey] = {};
      }
      seatAllocations[allocKey][row.tableId] = row.seats;
      
      // Track party size overrides
      if (row.partySizeOverride) {
        partySizeOverrides[allocKey] = row.partySizeOverride;
      }
    }
    
    return NextResponse.json({ assignments, seatAllocations, partySizeOverrides });
  } catch (error) {
    console.error('Get assignments error:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { guestId, tableId, day, serviceId, seats = 1, partySizeOverride } = body;
    
    // Check if this specific assignment already exists
    const existing = await sql`
      SELECT id FROM assignments 
      WHERE guest_id = ${guestId} AND table_id = ${tableId} AND day = ${day} AND service_id = ${serviceId}
    `;
    
    if (existing.rows.length > 0) {
      // Update existing assignment
      const result = await sql`
        UPDATE assignments 
        SET seats = ${seats}, party_size_override = ${partySizeOverride || null}
        WHERE guest_id = ${guestId} AND table_id = ${tableId} AND day = ${day} AND service_id = ${serviceId}
        RETURNING guest_id as "guestId", table_id as "tableId", day, service_id as "serviceId", seats, party_size_override as "partySizeOverride"
      `;
      return NextResponse.json(result.rows[0]);
    } else {
      // Create new assignment
      const result = await sql`
        INSERT INTO assignments (guest_id, table_id, day, service_id, seats, party_size_override)
        VALUES (${guestId}, ${tableId}, ${day}, ${serviceId}, ${seats}, ${partySizeOverride || null})
        RETURNING guest_id as "guestId", table_id as "tableId", day, service_id as "serviceId", seats, party_size_override as "partySizeOverride"
      `;
      return NextResponse.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Create assignment error:', error);
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const guestId = searchParams.get('guestId');
    const tableId = searchParams.get('tableId');
    const day = searchParams.get('day');
    const serviceId = searchParams.get('serviceId');
    
    if (!guestId || !tableId || !day || !serviceId) {
      return NextResponse.json({ error: 'All parameters required' }, { status: 400 });
    }
    
    await sql`
      DELETE FROM assignments 
      WHERE guest_id = ${guestId} 
        AND table_id = ${tableId} 
        AND day = ${day} 
        AND service_id = ${serviceId}
    `;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete assignment error:', error);
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
  }
}
