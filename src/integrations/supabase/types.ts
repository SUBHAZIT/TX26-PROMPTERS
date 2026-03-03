export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          team_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          team_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          team_id?: string | null
        }
        Relationships: []
      }
      qualified_teams: {
        Row: {
          created_at: string
          id: string
          qualified_from_round: number
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          qualified_from_round: number
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          qualified_from_round?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualified_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      questions: {
        Row: {
          correct_answer: string | null
          created_at: string
          id: string
          image_url: string | null
          options: Json | null
          question_number: number
          question_text: string | null
          question_type: string
          round_number: number
          timer_seconds: number
        }
        Insert: {
          correct_answer?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          options?: Json | null
          question_number: number
          question_text?: string | null
          question_type: string
          round_number: number
          timer_seconds?: number
        }
        Update: {
          correct_answer?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          options?: Json | null
          question_number?: number
          question_text?: string | null
          question_type?: string
          round_number?: number
          timer_seconds?: number
        }
        Relationships: []
      }
      round_state: {
        Row: {
          created_at: string
          current_question: number | null
          ended_at: string | null
          id: string
          question_started_at: string | null
          round_number: number
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          current_question?: number | null
          ended_at?: string | null
          id?: string
          question_started_at?: string | null
          round_number: number
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          current_question?: number | null
          ended_at?: string | null
          id?: string
          question_started_at?: string | null
          round_number?: number
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      round3_config: {
        Row: {
          created_at: string
          id: string
          reference_image_url: string | null
          timer_minutes: number
        }
        Insert: {
          created_at?: string
          id?: string
          reference_image_url?: string | null
          timer_minutes?: number
        }
        Update: {
          created_at?: string
          id?: string
          reference_image_url?: string | null
          timer_minutes?: number
        }
        Relationships: []
      }
      round3_submissions: {
        Row: {
          admin_selected: boolean
          id: string
          image_url: string
          prompt_text: string | null
          rank: number | null
          submitted_at: string
          team_id: string
        }
        Insert: {
          admin_selected?: boolean
          id?: string
          image_url: string
          prompt_text?: string | null
          rank?: number | null
          submitted_at?: string
          team_id: string
        }
        Update: {
          admin_selected?: boolean
          id?: string
          image_url?: string
          prompt_text?: string | null
          rank?: number | null
          submitted_at?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round3_submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      submissions: {
        Row: {
          admin_approved: boolean
          answer: string | null
          id: string
          image_url: string | null
          is_correct: boolean | null
          question_number: number
          round_number: number
          score: number
          submitted_at: string
          team_id: string
        }
        Insert: {
          admin_approved?: boolean
          answer?: string | null
          id?: string
          image_url?: string | null
          is_correct?: boolean | null
          question_number: number
          round_number: number
          score?: number
          submitted_at?: string
          team_id: string
        }
        Update: {
          admin_approved?: boolean
          answer?: string | null
          id?: string
          image_url?: string | null
          is_correct?: boolean | null
          question_number?: number
          round_number?: number
          score?: number
          submitted_at?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          leader_name: string
          section: string
          session_token: string | null
          status: string
          suspicious_flag: boolean
          team_id: string
          total_score: number
          warning_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          leader_name: string
          section: string
          session_token?: string | null
          status?: string
          suspicious_flag?: boolean
          team_id: string
          total_score?: number
          warning_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          leader_name?: string
          section?: string
          session_token?: string | null
          status?: string
          suspicious_flag?: boolean
          team_id?: string
          total_score?: number
          warning_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
