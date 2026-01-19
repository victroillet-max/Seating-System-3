import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function DELETE() {
  try {
    // Delete all guest-related data in order (respecting foreign key-like relationships)
    // Clear assignments first (references guests and tables)
    await sql`DELETE FROM assignments`;
    
    // Clear arrivals (references guests)
    await sql`DELETE FROM arrivals`;
    
    // Clear departures (references guests)
    await sql`DELETE FROM departures`;
    
    // Clear member_arrivals (references group members)
    await sql`DELETE FROM member_arrivals`;
    
    // Clear group_memberships (references groups and guests)
    await sql`DELETE FROM group_memberships`;
    
    // Clear groups (references guests as lead)
    await sql`DELETE FROM groups`;
    
    // Clear legacy group_members table
    await sql`DELETE FROM group_members`;
    
    // Finally, delete all guests
    await sql`DELETE FROM guests`;
    
    return NextResponse.json({ 
      success: true, 
      message: 'All guest data has been deleted successfully' 
    });
  } catch (error) {
    console.error('Delete all guests error:', error);
    return NextResponse.json(
      { error: 'Failed to delete all guest data' }, 
      { status: 500 }
    );
  }
}
