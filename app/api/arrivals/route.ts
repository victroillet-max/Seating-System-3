import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const result = await sql`
      SELECT guest_id as "guestId", day, arrived
      FROM arrivals
      WHERE arrived = true
    `;
    
    // Convert to the format expected by the frontend
    const arrivals: Record<string, number[]> = {};
    for (const row of result.rows) {
      if (!arrivals[row.day]) {
        arrivals[row.day] = [];
      }
      arrivals[row.day].push(row.guestId);
    }
    
    return NextResponse.json(arrivals);
  } catch (error) {
    console.error('Get arrivals error:', error);
    return NextResponse.json({ error: 'Failed to fetch arrivals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { guestId, day, arrived } = body;
    
    // Upsert the arrival status
    await sql`
      INSERT INTO arrivals (guest_id, day, arrived)
      VALUES (${guestId}, ${day}, ${arrived})
      ON CONFLICT (guest_id, day) 
      DO UPDATE SET arrived = ${arrived}
    `;
    
    return NextResponse.json({ success: true, guestId, day, arrived });
  } catch (error) {
    console.error('Update arrival error:', error);
    return NextResponse.json({ error: 'Failed to update arrival' }, { status: 500 });
  }
}
