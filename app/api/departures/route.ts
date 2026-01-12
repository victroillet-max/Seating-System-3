import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

// GET - fetch all departures for a day
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const day = searchParams.get('day');

  try {
    const result = await sql`
      SELECT guest_id, service_id FROM departures WHERE day = ${day}
    `;
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching departures:', error);
    return NextResponse.json([]);
  }
}

// POST - mark guest as departed
export async function POST(request: Request) {
  const { guestId, day, serviceId } = await request.json();

  try {
    // First check if table exists, create if not
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

    await sql`
      INSERT INTO departures (guest_id, day, service_id)
      VALUES (${guestId}, ${day}, ${serviceId})
      ON CONFLICT (guest_id, day, service_id) DO NOTHING
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking departure:', error);
    return NextResponse.json({ error: 'Failed to mark departure' }, { status: 500 });
  }
}

// DELETE - unmark guest as departed (they came back)
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const guestId = searchParams.get('guestId');
  const day = searchParams.get('day');
  const serviceId = searchParams.get('serviceId');

  try {
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
