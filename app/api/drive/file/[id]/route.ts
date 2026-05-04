import { NextRequest, NextResponse } from 'next/server';
import { downloadFromDrive } from '@/lib/drive';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('Proxying Drive file download for ID:', id);
    
    const buffer = await downloadFromDrive(id);
    
    // Return a standard Response with the buffer and correct headers
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': buffer.length.toString(),
        'Content-Disposition': `inline; filename="document.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('Drive Proxy Error:', error);
    return NextResponse.json({ message: 'Failed to fetch file from Drive' }, { status: 500 });
  }
}
