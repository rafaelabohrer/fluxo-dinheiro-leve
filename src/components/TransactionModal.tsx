import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Upload, X, FileText, Download } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Category {
  id: number;
  name: string;
  icon: string;
  type: "income" | "expense";
}

interface Transaction {
  id: number;
  description: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  category_id: number | null;
}

interface TransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  onClose?: () => void;
}

const TransactionModal = ({ open, onOpenChange, transaction, onClose }: TransactionModalProps) => {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [categoryId, setCategoryId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDay, setRecurrenceDay] = useState<string>("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachmentMonth, setAttachmentMonth] = useState<string>("");
  const [attachmentYear, setAttachmentYear] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchCategories();
      if (transaction) {
        setType(transaction.type);
        setCategoryId(transaction.category_id?.toString() || "");
        setAmount(Math.abs(transaction.amount).toString());
        setDescription(transaction.description || "");
        setDate(transaction.date);
        setIsRecurring((transaction as any).is_recurring || false);
        setRecurrenceDay((transaction as any).recurrence_day?.toString() || "");
        fetchAttachments(transaction.id);
      }
      const now = new Date();
      setAttachmentMonth((now.getMonth() + 1).toString());
      setAttachmentYear(now.getFullYear().toString());
    } else {
      // Reset form
      setType("expense");
      setCategoryId("");
      setAmount("");
      setDescription("");
      setDate(new Date().toISOString().split('T')[0]);
      setIsRecurring(false);
      setRecurrenceDay("");
      setAttachments([]);
      setSelectedFile(null);
      setAttachmentMonth("");
      setAttachmentYear("");
    }
  }, [open, transaction]);

  const fetchCategories = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", user.user.id)
        .order("name");

      if (error) throw error;
      setCategories((data || []) as Category[]);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchAttachments = async (transactionId: number) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from("transaction_attachments")
        .select("*")
        .eq("transaction_id", transactionId)
        .eq("user_id", user.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error("Error fetching attachments:", error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Máximo 10MB.");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadAttachment = async () => {
    if (!selectedFile || !transaction) {
      toast.error("Selecione um arquivo primeiro");
      return;
    }

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("User not authenticated");

      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("transaction-attachments")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Save attachment record
      const { error: insertError } = await supabase
        .from("transaction_attachments")
        .insert({
          user_id: user.user.id,
          transaction_id: transaction.id,
          file_path: fileName,
          file_name: selectedFile.name,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          attachment_month: isRecurring ? parseInt(attachmentMonth) : null,
          attachment_year: isRecurring ? parseInt(attachmentYear) : null,
        });

      if (insertError) throw insertError;

      toast.success("Comprovante anexado!");
      setSelectedFile(null);
      fetchAttachments(transaction.id);
    } catch (error: any) {
      console.error("Error uploading attachment:", error);
      toast.error("Erro ao anexar comprovante");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: number, filePath: string) => {
    setLoading(true);
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("transaction-attachments")
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("transaction_attachments")
        .delete()
        .eq("id", attachmentId);

      if (dbError) throw dbError;

      toast.success("Comprovante removido!");
      if (transaction) {
        fetchAttachments(transaction.id);
      }
    } catch (error: any) {
      console.error("Error deleting attachment:", error);
      toast.error("Erro ao remover comprovante");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAttachment = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("transaction-attachments")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error downloading attachment:", error);
      toast.error("Erro ao baixar comprovante");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    setLoading(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("User not authenticated");

      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      
      const status = selectedDate > today ? "pending" : "completed";

      const transactionData = {
        user_id: user.user.id,
        type,
        category_id: categoryId ? parseInt(categoryId) : null,
        amount: parseFloat(amount),
        description: description.trim() || null,
        date,
        is_recurring: isRecurring,
        recurrence_day: isRecurring && recurrenceDay ? parseInt(recurrenceDay) : null,
        status,
      };

      if (transaction) {
        // Update existing transaction
        const { error } = await supabase
          .from("transactions")
          .update(transactionData)
          .eq("id", transaction.id);

        if (error) throw error;
        toast.success("Transação atualizada!");
      } else {
        // Create new transaction
        const { error } = await supabase
          .from("transactions")
          .insert(transactionData);

        if (error) throw error;
        toast.success("Transação adicionada!");
      }

      onOpenChange(false);
      if (onClose) onClose();
    } catch (error: any) {
      console.error("Error saving transaction:", error);
      toast.error("Erro ao salvar transação");
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(cat => cat.type === type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "Editar Transação" : "Nova Transação"}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={type} onValueChange={(v) => setType(v as "income" | "expense")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="expense">Despesa</TabsTrigger>
              <TabsTrigger value="income">Receita</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span className="material-icons text-sm">{cat.icon}</span>
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              type="text"
              placeholder="Descrição (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={loading || isRecurring}
              required
            />
            {isRecurring && (
              <p className="text-xs text-muted-foreground">
                Para transações recorrentes, a data será calculada automaticamente
              </p>
            )}
          </div>

          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={isRecurring}
                onCheckedChange={(checked) => {
                  setIsRecurring(checked as boolean);
                  if (!checked) setRecurrenceDay("");
                }}
                disabled={loading}
              />
              <Label htmlFor="recurring" className="font-normal cursor-pointer">
                Transação recorrente mensal
              </Label>
            </div>

            {isRecurring && (
              <div className="space-y-2 pl-6">
                <Label htmlFor="recurrence-day">Dia do mês (1-31)</Label>
                <Input
                  id="recurrence-day"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex: 5 (todo dia 5)"
                  value={recurrenceDay}
                  onChange={(e) => setRecurrenceDay(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Esta transação será registrada automaticamente todo mês no dia especificado
                </p>
              </div>
            )}
          </div>

          {transaction && (
            <div className="space-y-3 border-t pt-4">
              <Label>Comprovantes</Label>
              
              {/* Existing attachments */}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                          {attachment.attachment_month && attachment.attachment_year && (
                            <p className="text-xs text-muted-foreground">
                              {attachment.attachment_month}/{attachment.attachment_year}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownloadAttachment(attachment.file_path, attachment.file_name)}
                          disabled={loading}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteAttachment(attachment.id, attachment.file_path)}
                          disabled={loading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload new attachment */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    onChange={handleFileSelect}
                    disabled={loading}
                    accept="image/*,.pdf,.doc,.docx"
                    className="flex-1"
                  />
                  {selectedFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedFile(null)}
                      disabled={loading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {selectedFile && isRecurring && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="attachment-month">Mês</Label>
                      <Select value={attachmentMonth} onValueChange={setAttachmentMonth} disabled={loading}>
                        <SelectTrigger>
                          <SelectValue placeholder="Mês" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                            <SelectItem key={month} value={month.toString()}>
                              {month.toString().padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="attachment-year">Ano</Label>
                      <Input
                        id="attachment-year"
                        type="number"
                        value={attachmentYear}
                        onChange={(e) => setAttachmentYear(e.target.value)}
                        disabled={loading}
                        placeholder="2024"
                      />
                    </div>
                  </div>
                )}

                {selectedFile && (
                  <Button
                    type="button"
                    onClick={handleUploadAttachment}
                    disabled={loading || (isRecurring && (!attachmentMonth || !attachmentYear))}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Anexar Comprovante
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                onOpenChange(false);
                if (onClose) onClose();
              }}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionModal;
