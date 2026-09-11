import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jwtidsgxtqvwihggpmuq.supabase.co'
const supabaseAnonKey = 'sb_publishable_pDxODPx16DcbeQXut3l6dw_ZeqhXxLf'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)