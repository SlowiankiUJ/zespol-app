import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jwtidsgxtqvwihggpmuq.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3dGlkc2d4dHF2d2loZ2dwbXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMzc2MTgsImV4cCI6MjEwNDcxMzYxOH0.-9KyYt5vp0nVdhVp1z_08_A2SibMSOvzJ1WIg_W6xEs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)