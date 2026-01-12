import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const result = await sql`
      SELECT member_id as "memberId", day, arrived
      FROM member_arrivals
    `;
    
    // Convert to format: { day: { memberId: boolean } }
    const arrivals: Record<string, Record<number, boolean>> = {};
    
    for (const row of result.rows) {
      if (!arrivals[row.day]) {
        arrivals[row.day] = {};
      }
      arrivals[row.day][row.memberId] = row.arrived;
    }
    
    return NextResponse.json(arrivals);
  } catch (error) {
    console.error('Get member arrivals error:', error);
    return NextResponse.json({ error: 'Failed to fetch member arrivals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { memberId, day, arrived } = body;

    // Upsert arrival status
    await sql`
      INSERT INTO member_arrivals (member_id, day, arrived)
      VALUES (${memberId}, ${day}, ${arrived})
      ON CONFLICT (member_id, day)
      DO UPDATE SET arrived = ${arrived}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update member arrival error:', error);
    return NextResponse.json({ error: 'Failed to update member arrival' }, { status: 500 });
  }
}
