import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// GET all groups with their members
export async function GET() {
  try {
    // Get all groups with lead guest info
    const groupsResult = await sql`
      SELECT 
        g.id,
        g.name,
        g.lead_guest_id as "leadGuestId",
        gu.name as "leadGuestName",
        COALESCE(gu.is_ghost, false) as "leadIsGhost"
      FROM groups g
      LEFT JOIN guests gu ON g.lead_guest_id = gu.id
      ORDER BY g.created_at DESC
    `;

    // Get all memberships with guest info
    const membershipsResult = await sql`
      SELECT 
        gm.id,
        gm.group_id as "groupId",
        gm.guest_id as "guestId",
        gu.name as "guestName",
        COALESCE(gu.is_ghost, false) as "isGhost"
      FROM group_memberships gm
      LEFT JOIN guests gu ON gm.guest_id = gu.id
      ORDER BY gm.created_at
    `;

    // Organize memberships by group
    const membershipsByGroup: Record<number, Array<{id: number, guestId: number, guestName: string, isGhost: boolean}>> = {};
    for (const membership of membershipsResult.rows) {
      if (!membershipsByGroup[membership.groupId]) {
        membershipsByGroup[membership.groupId] = [];
      }
      membershipsByGroup[membership.groupId].push({
        id: membership.id,
        guestId: membership.guestId,
        guestName: membership.guestName,
        isGhost: membership.isGhost
      });
    }

    // Combine groups with their members
    const groups = groupsResult.rows.map(group => ({
      ...group,
      members: membershipsByGroup[group.id] || []
    }));

    return NextResponse.json(groups);
  } catch (error) {
    console.error('Get groups error:', error);
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
  }
}

// POST create a new group
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, leadGuestId } = body;

    if (!leadGuestId) {
      return NextResponse.json({ error: 'Lead guest ID required' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO groups (name, lead_guest_id)
      VALUES (${name || null}, ${leadGuestId})
      RETURNING id, name, lead_guest_id as "leadGuestId"
    `;

    // Get lead guest info
    const leadGuest = await sql`
      SELECT name, COALESCE(is_ghost, false) as "isGhost"
      FROM guests WHERE id = ${leadGuestId}
    `;

    return NextResponse.json({
      ...result.rows[0],
      leadGuestName: leadGuest.rows[0]?.name,
      leadIsGhost: leadGuest.rows[0]?.isGhost,
      members: []
    });
  } catch (error) {
    console.error('Create group error:', error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}

// PUT update a group
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, leadGuestId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Group ID required' }, { status: 400 });
    }

    // If name is explicitly provided (even as empty/null), update it
    if ('name' in body) {
      await sql`
        UPDATE groups
        SET name = ${name || null}
        WHERE id = ${id}
      `;
    }
    
    // If leadGuestId is provided, update it
    if (leadGuestId) {
      await sql`
        UPDATE groups
        SET lead_guest_id = ${leadGuestId}
        WHERE id = ${id}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update group error:', error);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

// DELETE a group
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Group ID required' }, { status: 400 });
    }

    // Delete all memberships first
    await sql`DELETE FROM group_memberships WHERE group_id = ${id}`;
    
    // Delete the group
    await sql`DELETE FROM groups WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete group error:', error);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}
