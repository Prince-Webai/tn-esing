export type DocumentStatus = 'pending' | 'signed'

export interface Document {
  id: string
  name: string
  storage_url: string
  signed_storage_url?: string
  status: DocumentStatus
  created_by: string
  created_at: string
}

export interface FieldPosition {
  x: number
  y: number
  page: number
  width: number
  height: number
}

export interface SignatureRequest {
  id: string
  document_id: string
  token: string
  signer_email?: string
  signed_at?: string
  signature_image_url?: string
  field_position: FieldPosition
}

export interface SignatureRequestWithDocument extends SignatureRequest {
  documents: Document
}
