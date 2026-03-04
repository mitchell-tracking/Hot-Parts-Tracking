import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://okoxvxzvfnrzofajyxar.supabase.co'
const supabaseAnonKey = 'sb_publishable_2OkYXGs6iwTCKQe6MDznSA_6kji3mLC' 

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
