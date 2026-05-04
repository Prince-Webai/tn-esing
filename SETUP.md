# TN Solar Sign — Setup Guide

A DocuSign-style document signing application for TN Solar. Internal staff upload PDFs, place signature fields, and send unique signing links to clients.

---

## 1. Prerequisites

- Node.js 18+
- A Supabase project (free tier works fine)

---

## 2. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Where to find these:**
- Go to your Supabase project → Settings → API
- `NEXT_PUBLIC_SUPABASE_URL` = "Project URL"
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = "anon public" key
- `SUPABASE_SERVICE_ROLE_KEY` = "service_role" key (keep this secret — server-side only)

---

## 3. Supabase Setup

### 3a. Database Tables

Run the following SQL in your Supabase SQL editor (Dashboard → SQL Editor → New query):

```sql
-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  signed_storage_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Signature requests table
CREATE TABLE signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  signer_email TEXT,
  signed_at TIMESTAMPTZ,
  signature_image_url TEXT,
  field_position JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_documents_created_by ON documents(created_by);
CREATE INDEX idx_signature_requests_token ON signature_requests(token);
CREATE INDEX idx_signature_requests_document_id ON signature_requests(document_id);
```

### 3b. Row-Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_requests ENABLE ROW LEVEL SECURITY;

-- Documents: authenticated users can only see their own
CREATE POLICY "Users can manage own documents"
  ON documents FOR ALL
  USING (auth.uid() = created_by);

-- Signature requests: authenticated users can manage requests for their docs
CREATE POLICY "Users can manage own signature requests"
  ON signature_requests FOR ALL
  USING (
    document_id IN (
      SELECT id FROM documents WHERE created_by = auth.uid()
    )
  );

-- Public: anyone with a token can read their request (for signing page)
CREATE POLICY "Anyone can read request by token"
  ON signature_requests FOR SELECT
  USING (true);

-- Public: anyone can read documents (needed for signing page PDF render)
CREATE POLICY "Anyone can read documents"
  ON documents FOR SELECT
  USING (true);
```

### 3c. Storage Buckets

Create two storage buckets in Supabase Dashboard → Storage:

**Bucket 1: `documents`**
- Name: `documents`
- Public: **Yes** (so PDFs can be rendered in browser)

**Bucket 2: `signatures`**
- Name: `signatures`
- Public: **Yes** (so signature images can be displayed)

Set bucket policies (SQL):

```sql
-- Allow public reads on documents bucket
CREATE POLICY "Public read documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');

-- Allow authenticated uploads to documents bucket
CREATE POLICY "Authenticated upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Allow service role to upload signed PDFs (done via API route)
CREATE POLICY "Service role full access documents"
  ON storage.objects FOR ALL
  USING (bucket_id = 'documents');

-- Signatures bucket
CREATE POLICY "Public read signatures"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'signatures');

CREATE POLICY "Service role full access signatures"
  ON storage.objects FOR ALL
  USING (bucket_id = 'signatures');
```

> **Tip:** Alternatively, just set both buckets to Public with no RLS for development. Tighten later for production.

### 3d. Create Internal Users

In Supabase Dashboard → Authentication → Users → Invite User, create accounts for your ~20 TN Solar staff members. They'll receive email invitations to set their passwords.

---

## 4. Running the App

```bash
# Install dependencies (already done if you got this as a zip)
npm install

# Start development server
npm run dev
```

App runs at: http://localhost:3000

---

## 5. Application Flow

1. **Staff login** at `/login` using their Supabase credentials
2. **Upload a PDF** at `/upload` — drag-and-drop or click to browse
3. **Place signature field** — click "Add Signature Field", then click on the PDF where the signature should go
4. **Send** — optionally enter client email, click "Generate Signing Link"
5. **Share the link** — copy the unique `/sign/[token]` URL and send to the client
6. **Client signs** — opens the link, sees the document, clicks the orange field, draws their signature, submits
7. **Signature embedded** — the app uses `pdf-lib` to embed the signature PNG into the PDF at the correct position
8. **View & download** — staff can view the signed document and download the signed PDF from the dashboard or `/documents/[id]`

---

## 6. Project Structure

```
tnsolar-sign/
├── app/
│   ├── api/
│   │   └── sign/route.ts          # POST: embed signature into PDF
│   ├── dashboard/page.tsx          # Document list + stats
│   ├── documents/[id]/
│   │   ├── page.tsx               # Document detail view
│   │   └── DocumentViewer.tsx     # PDF viewer component
│   ├── login/page.tsx             # Supabase auth
│   ├── sign/[token]/
│   │   ├── page.tsx               # Public signing page (server)
│   │   └── SignClient.tsx         # Signing UI (client)
│   ├── upload/
│   │   ├── page.tsx               # Upload page shell
│   │   └── UploadClient.tsx       # Multi-step upload flow (client)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                   # Redirects to /dashboard
├── components/
│   ├── CopyLinkButton.tsx         # Client-side copy button
│   └── Navbar.tsx                 # Top navigation
├── lib/supabase/
│   ├── client.ts                  # Browser Supabase client
│   └── server.ts                  # Server Supabase client
├── middleware.ts                  # Auth redirect middleware
├── types/index.ts                 # TypeScript types
├── .env.local.example
└── SETUP.md
```

---

## 7. Deploying to Production

1. Push to GitHub
2. Connect to [Vercel](https://vercel.com) or any Next.js host
3. Add environment variables in the host's dashboard
4. Update `NEXT_PUBLIC_APP_URL` to your production domain
5. Add your domain to Supabase → Authentication → URL Configuration → Site URL

---

## 8. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth & DB | Supabase (PostgreSQL) |
| Storage | Supabase Storage |
| PDF Rendering | pdfjs-dist |
| PDF Writing | pdf-lib |
| Signature Capture | react-signature-canvas |
| UUID Generation | uuid |
