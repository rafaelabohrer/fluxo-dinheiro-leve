import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { format, isSameDay, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Transaction {
  id: number;
  description: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  status: "completed" | "pending";
  is_recurring: boolean;
  recurrence_day: number | null;
  categories: {
    name: string;
    icon: string;
  } | null;
}

const CalendarPage = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");

  useEffect(() => {
    fetchTransactions();

    const channel = supabase
      .channel('calendar-transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions'
        },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTransactions = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const now = new Date();
      const firstDay = startOfMonth(now);
      const lastDay = endOfMonth(now);

      // Fetch regular transactions for the month
      const { data: regularData, error: regularError } = await supabase
        .from("transactions")
        .select(`
          *,
          categories (
            name,
            icon
          )
        `)
        .eq("user_id", user.user.id)
        .gte("date", firstDay.toISOString().split('T')[0])
        .lte("date", lastDay.toISOString().split('T')[0])
        .order("date", { ascending: false });

      if (regularError) throw regularError;

      // Fetch recurring transactions (they appear every month on their recurrence_day)
      const { data: recurringData, error: recurringError } = await supabase
        .from("transactions")
        .select(`
          *,
          categories (
            name,
            icon
          )
        `)
        .eq("user_id", user.user.id)
        .eq("is_recurring", true)
        .not("recurrence_day", "is", null);

      if (recurringError) throw recurringError;

      // Combine transactions
      const allTransactions = [...(regularData || [])];
      
      // Add recurring transactions for this month
      if (recurringData && recurringData.length > 0) {
        recurringData.forEach((recurring) => {
          const recurrenceDay = recurring.recurrence_day;
          if (recurrenceDay) {
            const recurringDate = new Date(now.getFullYear(), now.getMonth(), recurrenceDay);
            // Check if this specific occurrence already exists
            const alreadyExists = regularData?.some(t => 
              t.id === recurring.id && 
              isSameDay(new Date(t.date), recurringDate)
            );
            
            if (!alreadyExists) {
              // Add a virtual instance of the recurring transaction for this month
              allTransactions.push({
                ...recurring,
                date: recurringDate.toISOString().split('T')[0]
              });
            }
          }
        });
      }

      setTransactions(allTransactions as Transaction[]);
    } catch (error) {
      console.error("Error fetching transactions:", error);
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

  const getTransactionsForDate = (date: Date) => {
    return transactions.filter(t => isSameDay(new Date(t.date), date));
  };

  const getFilteredTransactions = (dateTransactions: Transaction[]) => {
    if (filterType === "all") return dateTransactions;
    return dateTransactions.filter(t => t.type === filterType);
  };

  const getDayTotal = (date: Date, type: "income" | "expense" | "all") => {
    const dayTransactions = getTransactionsForDate(date);
    if (type === "all") {
      const income = dayTransactions.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
      const expense = dayTransactions.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
      return income - expense;
    }
    return dayTransactions.filter(t => t.type === type).reduce((sum, t) => sum + t.amount, 0);
  };

  const hasTransactions = (date: Date) => {
    return getTransactionsForDate(date).length > 0;
  };

  const selectedDateTransactions = selectedDate ? getFilteredTransactions(getTransactionsForDate(selectedDate)) : [];
  const selectedDateIncome = selectedDate ? getDayTotal(selectedDate, "income") : 0;
  const selectedDateExpense = selectedDate ? getDayTotal(selectedDate, "expense") : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Calendário</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Selecione uma data</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ptBR}
                className="rounded-md border pointer-events-auto"
                modifiers={{
                  hasTransactions: (date) => hasTransactions(date)
                }}
                modifiersStyles={{
                  hasTransactions: {
                    fontWeight: 'bold',
                    color: 'hsl(var(--primary))',
                  }
                }}
              />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedDate ? format(selectedDate, "d 'de' MMMM", { locale: ptBR }) : "Selecione uma data"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-success/10">
                    <div className="flex items-center gap-2 text-success mb-2">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm font-medium">Receitas</span>
                    </div>
                    <p className="text-2xl font-bold text-success">
                      {formatCurrency(selectedDateIncome)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-destructive/10">
                    <div className="flex items-center gap-2 text-destructive mb-2">
                      <TrendingDown className="h-4 w-4" />
                      <span className="text-sm font-medium">Despesas</span>
                    </div>
                    <p className="text-2xl font-bold text-destructive">
                      {formatCurrency(selectedDateExpense)}
                    </p>
                  </div>
                </div>

                <Tabs value={filterType} onValueChange={(v) => setFilterType(v as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="all">Todas</TabsTrigger>
                    <TabsTrigger value="income">Receitas</TabsTrigger>
                    <TabsTrigger value="expense">Despesas</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Transações do dia</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
                ) : selectedDateTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma transação nesta data
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {selectedDateTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`h-10 w-10 rounded-full flex-shrink-0 ${
                            transaction.type === "income" 
                              ? "bg-success/10" 
                              : "bg-destructive/10"
                          } flex items-center justify-center`}>
                            <span className="material-icons text-base" style={{
                              color: transaction.type === "income" 
                                ? "hsl(var(--success))" 
                                : "hsl(var(--destructive))"
                            }}>
                              {transaction.categories?.icon || "category"}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm">
                                {transaction.categories?.name || "Sem categoria"}
                              </p>
                              {transaction.is_recurring && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                                  Recorrente
                                </span>
                              )}
                              {transaction.status === "pending" && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 flex-shrink-0">
                                  Futura
                                </span>
                              )}
                            </div>
                            {transaction.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {transaction.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <p className={`font-bold flex-shrink-0 ml-2 ${
                          transaction.type === "income" 
                            ? "text-success" 
                            : "text-destructive"
                        }`}>
                          {transaction.type === "income" ? "+" : "-"}
                          {formatCurrency(Math.abs(transaction.amount))}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CalendarPage;
