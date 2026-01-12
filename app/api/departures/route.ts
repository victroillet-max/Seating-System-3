import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// GET - fetch all departures (optionally filtered by day)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const day = searchParams.get('day');

    let result;
    if (day) {
      result = await sql`
        SELECT guest_id as "guestId", day, service_id as "serviceId"
        FROM departures 
        WHERE day = ${day}
      `;
    } else {
      result = await sql`
        SELECT guest_id as "guestId", day, service_id as "serviceId"
        FROM departures
      `;
    }

    // Convert to format expected by frontend
    const departures: Record<string, number[]> = {};
    for (const row of result.rows) {
      const key = `${row.day}-${row.serviceId}`;
      if (!departures[key]) {
        departures[key] = [];
      }
      departures[key].push(row.guestId);
    }

    return NextResponse.json(departures);
  } catch (error) {
    console.error('Error fetching departures:', error);
    return NextResponse.json({ error: 'Failed to fetch departures' }, { status: 500 });
  }
}

// POST - mark guest as departed
export async function POST(request: NextRequest) {
  try {
    const { guestId, day, serviceId } = await request.json();

    if (!guestId || !day || serviceId === undefined) {
      return NextResponse.json({ error: 'guestId, day, and serviceId are required' }, { status: 400 });
    }

    await sql`
      INSERT INTO departures (guest_id, day, service_id)
      VALUES (${guestId}, ${day}, ${serviceId})
      ON CONFLICT (guest_id, day, service_id) DO NOTHING
    `;

    return NextResponse.json({ success: true, guestId, day, serviceId });
  } catch (error) {
    console.error('Error marking departure:', error);
    return NextResponse.json({ error: 'Failed to mark departure' }, { status: 500 });
  }
}

// DELETE - unmark guest as departed (they came back)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const guestId = searchParams.get('guestId');
    const day = searchParams.get('day');
    const serviceId = searchParams.get('serviceId');

    if (!guestId || !day || !serviceId) {
      return NextResponse.json({ error: 'guestId, day, and serviceId are required' }, { status: 400 });
    }

    await sql`
      DELETE FROM departures 
      WHERE guest_id = ${guestId} AND day = ${day} AND service_id = ${serviceId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing departure:', error);
    return NextResponse.json({ error: 'Failed to remove departure' }, { status: 500 });
  }
}
