export type SheetSystem = '星光' | '太陽'

export interface Student {
  id: number
  name: string
  name_with_id: string
  gender: string | null
  role: string | null
  sheet_system: SheetSystem
  phone: string | null
  line_id: string | null
  introducer: string | null
  relation: string | null
  birthday: string | null
  business_chain: string | null
  counselor: string | null
  little_angel: string | null
  dream_interpreter: string | null
  senior_counselor: string | null
  region: string | null
  guidance_chain: string | null
  membership_expiry: string | null  // ISO date string "YYYY-MM-DD"
  course_1: string | null
  payment_1: string | null
  parent_1: string | null
  course_2: string | null
  payment_2: string | null
  course_3: string | null
  payment_3: string | null
  course_4: string | null
  payment_4: string | null
  course_5: string | null
  payment_5: string | null
  course_wuyun: string | null
  payment_wuyun: string | null
  wuyun_a: string | null
  wuyun_b: string | null
  wuyun_c: string | null
  wuyun_d: string | null
  wuyun_f: string | null
  life_numbers: string | null
  life_numbers_advanced: string | null
  life_transform: string | null
  debt_release: string | null
  group_leader: string | null
  spirit_ambassador_join_date: string | null
  love_giving_start_date: string | null
  spirit_ambassador_group: string | null
  cumulative_seniority: string | null
  created_at: string
  updated_at: string
  last_synced_at: string | null
  system_id: number | null
}

export type StudentInsert = Omit<Student, 'name_with_id' | 'created_at' | 'updated_at' | 'group_leader'>
export type StudentUpdate = Partial<StudentInsert>

export interface ImportSession {
  id: string
  imported_at: string
  filename: string | null
  source_rows: number | null
  rows_updated: number
  rows_inserted: number
  rows_unchanged: number
  diff_snapshot: StudentInsert[] | null  // 實際存 StudentInsert[]，非 FieldDiff[]
  applied: boolean
  applied_at: string | null
}

export interface FieldDiff {
  id: number
  name: string
  field: string
  old_value: string | null
  new_value: string | null
  change_type: 'update' | 'insert'
}

export interface ImportLog {
  id: string
  session_id: string
  applied_at: string
  student_id: number
  student_name: string | null
  field: string
  old_value: string | null
  new_value: string | null
  change_type: 'insert' | 'update'
}


export interface CounselorGroup {
  id: string
  name: string
  display_order: number
  root_student_ids: number[]
  created_at: string
}

export interface ImportPreviewResult {
  session_id: string
  stats: {
    total_source_rows: number
    matched: number
    new_students: number
    total_changes: number
    unchanged: number
  }
  changes: FieldDiff[]
  new_student_names: string[]
}

// Supabase Database 型別定義
export interface Database {
  public: {
    Tables: {
      students: {
        Row: Student
        Insert: StudentInsert
        Update: StudentUpdate
      }
      import_sessions: {
        Row: ImportSession
        Insert: Omit<ImportSession, 'id' | 'imported_at'>
        Update: Partial<ImportSession>
      }
    }
  }
}
