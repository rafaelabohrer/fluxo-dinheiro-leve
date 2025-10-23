import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

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
      }
    } else {
      // Reset form
      setType("expense");
      setCategoryId("");
      setAmount("");
      setDescription("");
      setDate(new Date().toISOString().split('T')[0]);
      setIsRecurring(false);
      setRecurrenceDay("");
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "Editar Transação" : "Nova Transação"}
          </DialogTitle>
        </DialogHeader>
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

          <div className="flex gap-2">
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
      </DialogContent>
    </Dialog>
  );
};

export default TransactionModal;
