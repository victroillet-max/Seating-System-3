import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const result = await sql`
      SELECT id, name, COALESCE(party_size, 1) as "partySize", notes, 
             COALESCE(is_ghost, false) as "isGhost",
             COALESCE(is_manually_added, false) as "isManuallyAdded",
             market,
             guest_type as "guestType"
      FROM guests 
      ORDER BY created_at DESC
    `;
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Get guests error:', error);
    return NextResponse.json({ error: 'Failed to fetch guests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, notes, isManuallyAdded, market, guestType } = body;
    
    const result = await sql`
      INSERT INTO guests (name, party_size, notes, is_ghost, is_manually_added, market, guest_type)
      VALUES (${name}, 1, ${notes || ''}, false, ${isManuallyAdded || false}, ${market || null}, ${guestType || null})
      RETURNING id, name, party_size as "partySize", notes, is_ghost as "isGhost", 
                COALESCE(is_manually_added, false) as "isManuallyAdded",
                market,
                guest_type as "guestType"
    `;
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Create guest error:', error);
    return NextResponse.json({ error: 'Failed to create guest' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, partySize, notes, isGhost, market, guestType } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Guest ID required' }, { status: 400 });
    }
    
    // Update only provided fields
    if (isGhost !== undefined) {
      await sql`
        UPDATE guests 
        SET is_ghost = ${isGhost}
        WHERE id = ${id}
      `;
    }
    
    if (name !== undefined || partySize !== undefined || notes !== undefined) {
      await sql`
        UPDATE guests 
        SET 
          name = COALESCE(${name}, name),
          party_size = COALESCE(${partySize}, party_size),
          notes = COALESCE(${notes}, notes)
        WHERE id = ${id}
      `;
    }

    if (market !== undefined || guestType !== undefined) {
      await sql`
        UPDATE guests 
        SET 
          market = COALESCE(${market}, market),
          guest_type = COALESCE(${guestType}, guest_type)
        WHERE id = ${id}
      `;
    }
    
    const result = await sql`
      SELECT id, name, party_size as "partySize", notes, COALESCE(is_ghost, false) as "isGhost",
             market, guest_type as "guestType"
      FROM guests 
      WHERE id = ${id}
    `;
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Update guest error:', error);
    return NextResponse.json({ error: 'Failed to update guest' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Guest ID required' }, { status: 400 });
    }
    
    // Delete all related records (cascade delete)
    await sql`DELETE FROM assignments WHERE guest_id = ${id}`;
    await sql`DELETE FROM arrivals WHERE guest_id = ${id}`;
    await sql`DELETE FROM departures WHERE guest_id = ${id}`;
    await sql`DELETE FROM group_memberships WHERE guest_id = ${id}`;
    await sql`DELETE FROM member_arrivals WHERE member_id = ${id}`;
    
    // Remove from groups where this guest is the lead
    const leadGroups = await sql`SELECT id FROM groups WHERE lead_guest_id = ${id}`;
    for (const group of leadGroups.rows) {
      await sql`DELETE FROM group_memberships WHERE group_id = ${group.id}`;
      await sql`DELETE FROM groups WHERE id = ${group.id}`;
    }
    
    // Finally delete the guest
    await sql`DELETE FROM guests WHERE id = ${id}`;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete guest error:', error);
    return NextResponse.json({ error: 'Failed to delete guest' }, { status: 500 });
  }
}
