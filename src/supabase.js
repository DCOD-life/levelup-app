import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://lzzzwjfzekppawavmuxc.supabase.co'
const SUPABASE_KEY = 'sb_publishable_vG0cRSs2lOPMe7Jv1t_kNg_U4zPwsmE'

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

export { sb }
export default sb