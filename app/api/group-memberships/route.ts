import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// POST add a member to a group
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groupId, guestId } = body;

    if (!groupId || !guestId) {
      return NextResponse.json({ error: 'Group ID and Guest ID required' }, { status: 400 });
    }

    // Check if membership already exists
    const existing = await sql`
      SELECT id FROM group_memberships 
      WHERE group_id = ${groupId} AND guest_id = ${guestId}
    `;

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Guest is already a member of this group' }, { status: 400 });
    }

    // Check that guest is not the lead of this group
    const group = await sql`
      SELECT lead_guest_id FROM groups WHERE id = ${groupId}
    `;

    if (group.rows.length > 0 && group.rows[0].lead_guest_id === guestId) {
      return NextResponse.json({ error: 'Cannot add lead guest as a member' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO group_memberships (group_id, guest_id)
      VALUES (${groupId}, ${guestId})
      RETURNING id, group_id as "groupId", guest_id as "guestId"
    `;

    // Get guest info
    const guestInfo = await sql`
      SELECT name, COALESCE(is_ghost, false) as "isGhost"
      FROM guests WHERE id = ${guestId}
    `;

    return NextResponse.json({
      ...result.rows[0],
      guestName: guestInfo.rows[0]?.name,
      isGhost: guestInfo.rows[0]?.isGhost
    });
  } catch (error) {
    console.error('Add group member error:', error);
    return NextResponse.json({ error: 'Failed to add member to group' }, { status: 500 });
  }
}

// DELETE remove a member from a group
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const groupId = searchParams.get('groupId');
    const guestId = searchParams.get('guestId');

    if (id) {
      // Delete by membership ID
      await sql`DELETE FROM group_memberships WHERE id = ${id}`;
    } else if (groupId && guestId) {
      // Delete by group and guest IDs
      await sql`
        DELETE FROM group_memberships 
        WHERE group_id = ${groupId} AND guest_id = ${guestId}
      `;
    } else {
      return NextResponse.json({ error: 'Membership ID or Group+Guest IDs required' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove group member error:', error);
    return NextResponse.json({ error: 'Failed to remove member from group' }, { status: 500 });
  }
}
