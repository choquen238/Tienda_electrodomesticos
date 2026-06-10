import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Faltan variables de entorno de Supabase. Copia .env.example a .env y complétalo.'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
