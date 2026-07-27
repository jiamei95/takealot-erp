import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const stores = db.prepare('SELECT * FROM stores ORDER BY name').all();
  return NextResponse.json({ stores });
}
