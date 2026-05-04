import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import type { FieldPosition } from '@/types'
import { getMetadataFromDrive, downloadFromDrive, uploadToDrive, updateMetadataInDrive } from '@/lib/drive'

export async function POST(req: NextRequest) {
  try {
    const { token, requestId, signatureDataUrl, fieldPosition } = await req.json() as {
      token: string
      requestId: string
      signatureDataUrl: string
      fieldPosition: FieldPosition
    }

    if (!token || !signatureDataUrl || !fieldPosition) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    /*
    // LEGACY: Supabase logic preserved
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: request, error: reqErr } = await supabase
      .from('signature_requests')
      .select('*, documents(*)')
      .eq('token', token)
      .single()
    ...
    */

    // NEW: Google Drive Logic
    console.log('Fetching metadata from Drive for token:', token);
    const metadata = await getMetadataFromDrive(token) as any;

    if (metadata.status === 'signed') {
      return NextResponse.json({ error: 'Document already signed' }, { status: 409 })
    }

    // 1. Download the original PDF from Drive
    console.log('Downloading PDF from Drive:', metadata.drive_file_id);
    const pdfBytes = await downloadFromDrive(metadata.drive_file_id);

    // 2. Load PDF and embed signature
    const pdfDoc = await PDFDocument.load(pdfBytes)
    // Pages are 0-indexed in pdf-lib
    const pageIndex = fieldPosition.page - 1
    const pages = pdfDoc.getPages()
    
    if (pageIndex < 0 || pageIndex >= pages.length) {
      throw new Error(`Invalid page number: ${fieldPosition.page}. Total pages: ${pages.length}`)
    }
    
    const targetPage = pages[pageIndex]

    const { width: pageWidth, height: pageHeight } = targetPage.getSize()

    const sigX = fieldPosition.x * pageWidth
    const sigY = pageHeight - (fieldPosition.y * pageHeight) - (fieldPosition.height * pageHeight)
    const sigW = fieldPosition.width * pageWidth
    const sigH = fieldPosition.height * pageHeight

    const base64Data = signatureDataUrl.replace(/^data:image\/png;base64,/, '')
    const sigBytes = Buffer.from(base64Data, 'base64')
    const sigImage = await pdfDoc.embedPng(sigBytes)

    targetPage.drawImage(sigImage, {
      x: sigX,
      y: sigY,
      width: sigW,
      height: sigH,
    })

    // 3. Save signed PDF with optimization
    const signedPdfBytes = await pdfDoc.save({ useObjectStreams: false })

    // 4. Parallelize the final Drive operations to save time
    console.log('Parallelizing final Drive uploads...');
    const signedFileName = `signed_${metadata.original_file_name}`
    
    const [signedDriveFile] = await Promise.all([
      uploadToDrive(
        Buffer.from(signedPdfBytes), 
        signedFileName, 
        'application/pdf',
        metadata.folder_id // Use the project folder ID!
      ),
      // We don't need to update metadata here, we do it below
    ]);

    // Update everything in ONE final call
    console.log('Finalizing metadata in Drive...');
    await updateMetadataInDrive(token, {
      status: 'signed',
      signed_at: new Date().toISOString(),
      signed_drive_link: signedDriveFile.webViewLink,
      signed_drive_file_id: signedDriveFile.id
    });

    return NextResponse.json({ 
      success: true, 
      signedUrl: signedDriveFile.webViewLink 
    })
  } catch (err: unknown) {
    console.error('[/api/sign] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
