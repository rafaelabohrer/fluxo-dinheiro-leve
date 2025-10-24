-- Create storage bucket for transaction attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('transaction-attachments', 'transaction-attachments', false);

-- Create table for transaction attachments
CREATE TABLE public.transaction_attachments (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL,
  transaction_id bigint NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  attachment_month integer,
  attachment_year integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transaction_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for transaction_attachments table
CREATE POLICY "Users can view their own attachments"
ON public.transaction_attachments
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attachments"
ON public.transaction_attachments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own attachments"
ON public.transaction_attachments
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_transaction_attachments_transaction_id ON public.transaction_attachments(transaction_id);
CREATE INDEX idx_transaction_attachments_user_id ON public.transaction_attachments(user_id);

-- Storage policies for transaction-attachments bucket
CREATE POLICY "Users can view their own attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'transaction-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'transaction-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'transaction-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);