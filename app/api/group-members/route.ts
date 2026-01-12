import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mainGuestId = searchParams.get('mainGuestId');

    if (mainGuestId) {
      // Get members for specific guest
      const result = await sql`
        SELECT id, main_guest_id as "mainGuestId", name
        FROM group_members
        WHERE main_guest_id = ${mainGuestId}
        ORDER BY id
      `;
      return NextResponse.json(result.rows);
    } else {
      // Get all members
      const result = await sql`
        SELECT id, main_guest_id as "mainGuestId", name
        FROM group_members
        ORDER BY main_guest_id, id
      `;
      return NextResponse.json(result.rows);
    }
  } catch (error) {
    console.error('Get group members error:', error);
    return NextResponse.json({ error: 'Failed to fetch group members' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mainGuestId, name } = body;

    const result = await sql`
      INSERT INTO group_members (main_guest_id, name)
      VALUES (${mainGuestId}, ${name})
      RETURNING id, main_guest_id as "mainGuestId", name
    `;

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Create group member error:', error);
    return NextResponse.json({ error: 'Failed to create group member' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    await sql`
      DELETE FROM group_members WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete group member error:', error);
    return NextResponse.json({ error: 'Failed to delete group member' }, { status: 500 });
  }
}
