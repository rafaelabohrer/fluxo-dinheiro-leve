-- Add columns for recurring transactions and status
ALTER TABLE public.transactions
ADD COLUMN is_recurring boolean DEFAULT false NOT NULL,
ADD COLUMN recurrence_day integer,
ADD COLUMN status text DEFAULT 'completed' NOT NULL;

-- Add check constraint for status
ALTER TABLE public.transactions
ADD CONSTRAINT transactions_status_check 
CHECK (status IN ('completed', 'pending'));

-- Add check constraint for recurrence_day (1-31)
ALTER TABLE public.transactions
ADD CONSTRAINT transactions_recurrence_day_check 
CHECK (recurrence_day IS NULL OR (recurrence_day >= 1 AND recurrence_day <= 31));

-- Add index for better query performance on status
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_date_status ON public.transactions(date, status);

-- Add comment for clarity
COMMENT ON COLUMN public.transactions.is_recurring IS 'Indicates if this is a recurring transaction';
COMMENT ON COLUMN public.transactions.recurrence_day IS 'Day of month (1-31) when recurring transaction repeats';
COMMENT ON COLUMN public.transactions.status IS 'Transaction status: pending (future/unpaid) or completed (paid/received)';
