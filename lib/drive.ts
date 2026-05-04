import { google } from 'googleapis';
import { Readable } from 'stream';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

async function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export async function getOrCreateFolder(parentFolderId: string, folderName: string) {
  const drive = await getDriveClient();
  
  // Search for existing folder
  const q = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed = false`;
  const response = await drive.files.list({
    q,
    fields: 'files(id)',
  });

  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id!;
  }

  // Create new folder
  const folderMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId],
  };

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: 'id',
  });

  return folder.data.id!;
}

export async function uploadToDrive(file: Buffer, fileName: string, mimeType: string, customFolderId?: string) {
  const drive = await getDriveClient();
  const folderId = customFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

  const fileMetadata = {
    name: fileName,
    parents: folderId ? [folderId] : [],
  };

  const media = {
    mimeType: mimeType,
    body: Readable.from(file),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink, webContentLink',
  });

  return response.data;
}

export async function uploadMetadataToDrive(token: string, metadata: any, customFolderId?: string) {
  const drive = await getDriveClient();
  const folderId = customFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

  const fileMetadata = {
    name: `${token}.json`,
    parents: folderId ? [folderId] : [],
    mimeType: 'application/json',
  };

  const media = {
    mimeType: 'application/json',
    body: JSON.stringify(metadata),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id',
  });

  return response.data;
}

export async function getMetadataFromDrive(token: string) {
  const drive = await getDriveClient();
  
  // Search for the file globally in the drive (restricted by app permissions)
  // This ensures we find it even if it's nested in a Project Folder
  const response = await drive.files.list({
    q: `name = '${token}.json' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
  });

  if (!response.data.files || response.data.files.length === 0) {
    throw new Error('Metadata not found');
  }

  const fileId = response.data.files[0].id!;
  const fileContent = await drive.files.get({
    fileId: fileId,
    alt: 'media',
  });

  return fileContent.data;
}

export async function downloadFromDrive(fileId: string) {
  const drive = await getDriveClient();
  const response = await drive.files.get({
    fileId: fileId,
    alt: 'media',
  }, { responseType: 'arraybuffer' });

  return Buffer.from(response.data as ArrayBuffer);
}

export async function updateMetadataInDrive(token: string, updates: any) {
  const drive = await getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  // Search globally for the metadata file
  const response = await drive.files.list({
    q: `name = '${token}.json' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
  });

  if (!response.data.files || response.data.files.length === 0) {
    throw new Error('Metadata not found');
  }

  const fileId = response.data.files[0].id!;
  
  // Get existing metadata first
  const existing = await getMetadataFromDrive(token) as any;
  const updated = { ...existing, ...updates };

  await drive.files.update({
    fileId: fileId,
    media: {
      mimeType: 'application/json',
      body: JSON.stringify(updated),
    },
  });

  return updated;
}

export async function listRequestsFromDrive() {
  const drive = await getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  // Search globally for all JSON metadata files
  const response = await drive.files.list({
    q: `mimeType = 'application/json' and trashed = false`,
    fields: 'files(id, name, createdTime)',
    orderBy: 'createdTime desc',
  });

  if (!response.data.files) return [];

  const requests = await Promise.all(
    response.data.files
      .filter(f => f.name?.endsWith('.json'))
      .map(async (f) => {
        try {
          const content = await drive.files.get({
            fileId: f.id!,
            alt: 'media',
          });
          return {
            ...(content.data as any),
            id: f.id,
            token: f.name?.replace('.json', ''),
            created_at: f.createdTime,
          };
        } catch (e) {
          console.error(`Error loading metadata for ${f.name}:`, e);
          return null;
        }
      })
  );

  return requests.filter(r => r !== null);
}
