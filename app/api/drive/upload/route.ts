import { NextRequest, NextResponse } from 'next/server';
import { uploadToDrive, uploadMetadataToDrive, getOrCreateFolder } from '@/lib/drive';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fields = formData.get('fields') as string;
    const signerEmail = formData.get('signerEmail') as string;
    const projectNumber = formData.get('projectNumber') as string || 'General';
    
    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const token = uuidv4();

    // 1. Get or Create Project Folder
    const mainFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
    const projectFolderId = await getOrCreateFolder(mainFolderId, `Project - ${projectNumber}`);

    // 2. Upload original PDF to Project Folder
    const driveFile = await uploadToDrive(buffer, file.name, file.type, projectFolderId);

    // 3. Save metadata to Project Folder
    const metadata = {
      original_file_name: file.name,
      drive_file_id: driveFile.id,
      status: 'pending',
      fields: JSON.parse(fields || '[]'),
      signer_email: signerEmail || null,
      project_number: projectNumber,
      folder_id: projectFolderId,
      created_at: new Date().toISOString(),
    };

    await uploadMetadataToDrive(token, metadata, projectFolderId);

    return NextResponse.json({ 
      success: true, 
      token, 
      link: `${new URL(req.url).origin}/sign/${token}` 
    });
  } catch (error: any) {
    console.error('Google Drive Upload Error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
