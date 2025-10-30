-- Function to create default categories for new users
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert default expense categories
  INSERT INTO public.categories (user_id, name, icon, type) VALUES
    (NEW.id, 'Alimentação', 'restaurant', 'expense'),
    (NEW.id, 'Transporte', 'directions_car', 'expense'),
    (NEW.id, 'Moradia', 'home', 'expense'),
    (NEW.id, 'Saúde', 'local_hospital', 'expense'),
    (NEW.id, 'Lazer', 'sports_esports', 'expense'),
    (NEW.id, 'Compras', 'shopping_cart', 'expense'),
    (NEW.id, 'Educação', 'school', 'expense'),
    (NEW.id, 'Outros', 'more_horiz', 'expense');
  
  -- Insert default income categories
  INSERT INTO public.categories (user_id, name, icon, type) VALUES
    (NEW.id, 'Salário', 'work', 'income'),
    (NEW.id, 'Freelance', 'trending_up', 'income'),
    (NEW.id, 'Investimentos', 'savings', 'income'),
    (NEW.id, 'Outros', 'account_balance_wallet', 'income');
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create default categories for new users
DROP TRIGGER IF EXISTS on_auth_user_created_categories ON auth.users;
CREATE TRIGGER on_auth_user_created_categories
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_categories();