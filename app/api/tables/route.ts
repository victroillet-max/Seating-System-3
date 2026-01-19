import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const result = await sql`
      SELECT id, name, capacity, x, y 
      FROM tables 
      ORDER BY id ASC
    `;
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Get tables error:', error);
    return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, capacity, x, y } = body;
    
    const result = await sql`
      INSERT INTO tables (name, capacity, x, y)
      VALUES (${name}, ${capacity || 6}, ${x || 250}, ${y || 200})
      RETURNING id, name, capacity, x, y
    `;
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Create table error:', error);
    return NextResponse.json({ error: 'Failed to create table' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, x, y, name, capacity } = body;
    
    // If name or capacity is provided, update those fields
    if (name !== undefined || capacity !== undefined) {
      const result = await sql`
        UPDATE tables 
        SET 
          name = COALESCE(${name}, name),
          capacity = COALESCE(${capacity}, capacity),
          x = COALESCE(${x}, x),
          y = COALESCE(${y}, y)
        WHERE id = ${id}
        RETURNING id, name, capacity, x, y
      `;
      return NextResponse.json(result.rows[0]);
    }
    
    // Otherwise just update position (backward compatible)
    const result = await sql`
      UPDATE tables 
      SET x = ${x}, y = ${y}
      WHERE id = ${id}
      RETURNING id, name, capacity, x, y
    `;
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Update table error:', error);
    return NextResponse.json({ error: 'Failed to update table' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Table ID required' }, { status: 400 });
    }
    
    // Delete related assignments and blocked_tables
    await sql`DELETE FROM assignments WHERE table_id = ${id}`;
    await sql`DELETE FROM blocked_tables WHERE table_id = ${id}`;
    await sql`DELETE FROM tables WHERE id = ${id}`;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete table error:', error);
    return NextResponse.json({ error: 'Failed to delete table' }, { status: 500 });
  }
}
