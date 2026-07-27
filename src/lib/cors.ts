import { NextResponse } from 'next/server';

export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  }
  return headers;
}

export function jsonResponse(data: any, request: Request, status = 200) {
  const origin = request.headers.get('origin');
  return NextResponse.json(data, { status, headers: corsHeaders(origin) });
}

export function errorResponse(error: string, request: Request, status = 400) {
  const origin = request.headers.get('origin');
  return NextResponse.json({ error }, { status, headers: corsHeaders(origin) });
}

export function optionsResponse(request: Request) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}
