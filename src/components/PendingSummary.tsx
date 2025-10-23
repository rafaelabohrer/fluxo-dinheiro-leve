import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Calendar } from "lucide-react";

interface PendingData {
  totalExpenses: number;
  totalIncome: number;
  count: number;
}

const PendingSummary = () => {
  const [pendingData, setPendingData] = useState<PendingData>({
    totalExpenses: 0,
    totalIncome: 0,
    count: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingTransactions();

    const channel = supabase
      .channel('pending-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions'
        },
        () => {
          fetchPendingTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPendingTransactions = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.user.id)
        .eq("status", "pending");

      if (error) throw error;

      const expenses = data?.filter(t => t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      
      const income = data?.filter(t => t.type === "income")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      setPendingData({
        totalExpenses: expenses,
        totalIncome: income,
        count: data?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching pending transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="h-20 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (pendingData.count === 0) {
    return null;
  }

  return (
    <Card className="mb-6 border-orange-500/20 bg-orange-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Pendências Futuras
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Pendente</p>
              <p className="text-lg font-semibold">{pendingData.count}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <span className="material-icons text-destructive">arrow_downward</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Despesas Futuras</p>
              <p className="text-lg font-semibold text-destructive">
                {formatCurrency(pendingData.totalExpenses)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
              <span className="material-icons text-success">arrow_upward</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Receitas Futuras</p>
              <p className="text-lg font-semibold text-success">
                {formatCurrency(pendingData.totalIncome)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PendingSummary;
