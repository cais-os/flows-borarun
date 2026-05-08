export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  chat: {
    Tables: {
      chat_histories: {
        Row: {
          id: number
          message: Json
          session_id: string
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          status: Database["chat"]["Enums"]["reminder_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["chat"]["Enums"]["reminder_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["chat"]["Enums"]["reminder_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_properties: {
        Row: {
          created_at: string
          family_child_1_age: string | null
          family_child_1_name: string | null
          family_child_2_age: string | null
          family_child_2_name: string | null
          family_child_3_age: string | null
          family_child_3_name: string | null
          family_child_4_age: string | null
          family_child_4_name: string | null
          family_child_5_age: string | null
          family_child_5_name: string | null
          family_children_count: string | null
          family_marital_status: string | null
          family_spouse_age: string | null
          family_spouse_name: string | null
          family_spouse_profession: string | null
          id: string
          lifestyle_challenges: string | null
          lifestyle_dietary_restrictions: string | null
          lifestyle_goals: string | null
          lifestyle_health_conditions: string | null
          lifestyle_hobbies: string | null
          lifestyle_interests: string | null
          lifestyle_means_of_transportations: string | null
          lifestyle_preferred_topics: string | null
          lifestyle_work_schedule: string | null
          location_address: string | null
          location_city: string | null
          location_country: string | null
          location_state: string | null
          location_zip_code: string | null
          personal_age: string | null
          personal_birth_date: string | null
          personal_education_level: string | null
          personal_full_name: string | null
          personal_gender: string | null
          preferences_preferred_language: string | null
          preferences_reminder_preferences: string | null
          preferences_whatsapp_preferred_communication_method: string | null
          professional_colleagues_names: string | null
          professional_company: string | null
          professional_experience_years: string | null
          professional_is_employee_or_owner: string | null
          professional_main_activities: string | null
          professional_monthly_income_range: string | null
          professional_profession: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          family_child_1_age?: string | null
          family_child_1_name?: string | null
          family_child_2_age?: string | null
          family_child_2_name?: string | null
          family_child_3_age?: string | null
          family_child_3_name?: string | null
          family_child_4_age?: string | null
          family_child_4_name?: string | null
          family_child_5_age?: string | null
          family_child_5_name?: string | null
          family_children_count?: string | null
          family_marital_status?: string | null
          family_spouse_age?: string | null
          family_spouse_name?: string | null
          family_spouse_profession?: string | null
          id?: string
          lifestyle_challenges?: string | null
          lifestyle_dietary_restrictions?: string | null
          lifestyle_goals?: string | null
          lifestyle_health_conditions?: string | null
          lifestyle_hobbies?: string | null
          lifestyle_interests?: string | null
          lifestyle_means_of_transportations?: string | null
          lifestyle_preferred_topics?: string | null
          lifestyle_work_schedule?: string | null
          location_address?: string | null
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          location_zip_code?: string | null
          personal_age?: string | null
          personal_birth_date?: string | null
          personal_education_level?: string | null
          personal_full_name?: string | null
          personal_gender?: string | null
          preferences_preferred_language?: string | null
          preferences_reminder_preferences?: string | null
          preferences_whatsapp_preferred_communication_method?: string | null
          professional_colleagues_names?: string | null
          professional_company?: string | null
          professional_experience_years?: string | null
          professional_is_employee_or_owner?: string | null
          professional_main_activities?: string | null
          professional_monthly_income_range?: string | null
          professional_profession?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          family_child_1_age?: string | null
          family_child_1_name?: string | null
          family_child_2_age?: string | null
          family_child_2_name?: string | null
          family_child_3_age?: string | null
          family_child_3_name?: string | null
          family_child_4_age?: string | null
          family_child_4_name?: string | null
          family_child_5_age?: string | null
          family_child_5_name?: string | null
          family_children_count?: string | null
          family_marital_status?: string | null
          family_spouse_age?: string | null
          family_spouse_name?: string | null
          family_spouse_profession?: string | null
          id?: string
          lifestyle_challenges?: string | null
          lifestyle_dietary_restrictions?: string | null
          lifestyle_goals?: string | null
          lifestyle_health_conditions?: string | null
          lifestyle_hobbies?: string | null
          lifestyle_interests?: string | null
          lifestyle_means_of_transportations?: string | null
          lifestyle_preferred_topics?: string | null
          lifestyle_work_schedule?: string | null
          location_address?: string | null
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          location_zip_code?: string | null
          personal_age?: string | null
          personal_birth_date?: string | null
          personal_education_level?: string | null
          personal_full_name?: string | null
          personal_gender?: string | null
          preferences_preferred_language?: string | null
          preferences_reminder_preferences?: string | null
          preferences_whatsapp_preferred_communication_method?: string | null
          professional_colleagues_names?: string | null
          professional_company?: string | null
          professional_experience_years?: string | null
          professional_is_employee_or_owner?: string | null
          professional_main_activities?: string | null
          professional_monthly_income_range?: string | null
          professional_profession?: string | null
          updated_at?: string | null
          user_id?: string | null
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
      reminder_status: "pending" | "done" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  marketing: {
    Tables: {
      campaigns: {
        Row: {
          campaign: string
          channel: string
          id: string
          metadata: Json | null
          sent_at: string | null
          user_id: string
        }
        Insert: {
          campaign: string
          channel: string
          id?: string
          metadata?: Json | null
          sent_at?: string | null
          user_id: string
        }
        Update: {
          campaign?: string
          channel?: string
          id?: string
          metadata?: Json | null
          sent_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          category: string
          created_at: string | null
          event_name: string
          id: number
          metadata: Json | null
          origin: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          event_name: string
          id?: number
          metadata?: Json | null
          origin: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          event_name?: string
          id?: number
          metadata?: Json | null
          origin?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      call_track_event: {
        Args: { p_event_name: string; p_metadata?: Json; p_user_id: string }
        Returns: undefined
      }
      check_onboarding_abandonment: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      fatigue_logs: {
        Row: {
          created_at: string | null
          date: string
          feedback: string | null
          id: string
          level: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          feedback?: string | null
          id?: string
          level: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          feedback?: string | null
          id?: string
          level?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      onboarding_data: {
        Row: {
          birth_date: string | null
          created_at: string | null
          goal_type: string | null
          height_cm: number | null
          id: string
          name: string | null
          sex: string | null
          target_days: number | null
          target_weight_change_kg: number | null
          updated_at: string | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string | null
          goal_type?: string | null
          height_cm?: number | null
          id?: string
          name?: string | null
          sex?: string | null
          target_days?: number | null
          target_weight_change_kg?: number | null
          updated_at?: string | null
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string | null
          goal_type?: string | null
          height_cm?: number | null
          id?: string
          name?: string | null
          sex?: string | null
          target_days?: number | null
          target_weight_change_kg?: number | null
          updated_at?: string | null
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          has_used_whatsapp: boolean | null
          id: string
          marketing_analytics_consent: boolean | null
          marketing_email_consent: boolean | null
          marketing_whatsapp_consent: boolean | null
          onboarding_channel:
          | Database["public"]["Enums"]["onboarding_channel"]
          | null
          onboarding_status:
          | Database["public"]["Enums"]["onboarding_status"]
          | null
          phone: string | null
          tracked_milestones: Json | null
          training_generation_status:
          | Database["public"]["Enums"]["training_generation_status"]
          | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          has_used_whatsapp?: boolean | null
          id?: string
          marketing_analytics_consent?: boolean | null
          marketing_email_consent?: boolean | null
          marketing_whatsapp_consent?: boolean | null
          onboarding_channel?:
          | Database["public"]["Enums"]["onboarding_channel"]
          | null
          onboarding_status?:
          | Database["public"]["Enums"]["onboarding_status"]
          | null
          phone?: string | null
          tracked_milestones?: Json | null
          training_generation_status?:
          | Database["public"]["Enums"]["training_generation_status"]
          | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          has_used_whatsapp?: boolean | null
          id?: string
          marketing_analytics_consent?: boolean | null
          marketing_email_consent?: boolean | null
          marketing_whatsapp_consent?: boolean | null
          onboarding_channel?:
          | Database["public"]["Enums"]["onboarding_channel"]
          | null
          onboarding_status?:
          | Database["public"]["Enums"]["onboarding_status"]
          | null
          phone?: string | null
          tracked_milestones?: Json | null
          training_generation_status?:
          | Database["public"]["Enums"]["training_generation_status"]
          | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      strava_accounts: {
        Row: {
          access_token: string
          access_token_expires_at: string
          athlete_id: number
          connected_at: string
          created_at: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          last_webhook_at: string | null
          refresh_token: string
          scope: string[] | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          access_token_expires_at: string
          athlete_id: number
          connected_at?: string
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          last_webhook_at?: string | null
          refresh_token: string
          scope?: string[] | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          access_token_expires_at?: string
          athlete_id?: number
          connected_at?: string
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          last_webhook_at?: string | null
          refresh_token?: string
          scope?: string[] | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strava_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      strava_interest: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string | null
          id: string
          plan_type: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string
          trial_start: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          plan_type?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string
          trial_start?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          plan_type?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string
          trial_start?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      training_plans: {
        Row: {
          completed_distance: number | null
          completed_weeks: number | null
          created_at: string | null
          goal_distance: number | null
          goal_type: string
          id: string
          race_date: string | null
          start_date: string | null
          total_distance: number | null
          total_weeks: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_distance?: number | null
          completed_weeks?: number | null
          created_at?: string | null
          goal_distance?: number | null
          goal_type: string
          id?: string
          race_date?: string | null
          start_date?: string | null
          total_distance?: number | null
          total_weeks: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_distance?: number | null
          completed_weeks?: number | null
          created_at?: string | null
          goal_distance?: number | null
          goal_type?: string
          id?: string
          race_date?: string | null
          start_date?: string | null
          total_distance?: number | null
          total_weeks?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      weekly_trainings: {
        Row: {
          actual_distance: number | null
          actual_elapsed_time: number | null
          actual_pace: number | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          date: string
          day_of_week: string
          description: string | null
          difficulty_level: number | null
          distance: number
          elapsed_time: number
          feedbacks: string | null
          id: string
          name: string
          pace: number | null
          strava_activity_id: number | null
          title: string
          training_plan_id: string
          type: string
          user_id: string
          week_number: number
        }
        Insert: {
          actual_distance?: number | null
          actual_elapsed_time?: number | null
          actual_pace?: number | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          date: string
          day_of_week: string
          description?: string | null
          difficulty_level?: number | null
          distance: number
          elapsed_time: number
          feedbacks?: string | null
          id?: string
          name: string
          pace?: number | null
          strava_activity_id?: number | null
          title: string
          training_plan_id: string
          type: string
          user_id: string
          week_number: number
        }
        Update: {
          actual_distance?: number | null
          actual_elapsed_time?: number | null
          actual_pace?: number | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          date?: string
          day_of_week?: string
          description?: string | null
          difficulty_level?: number | null
          distance?: number
          elapsed_time?: number
          feedbacks?: string | null
          id?: string
          name?: string
          pace?: number | null
          strava_activity_id?: number | null
          title?: string
          training_plan_id?: string
          type?: string
          user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_trainings_training_plan_id_fkey"
            columns: ["training_plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_trainings: {
        Row: {
          actual_distance: number | null
          actual_elapsed_time: number | null
          actual_pace: number | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          date: string
          description: string | null
          difficulty_level: number | null
          distance: number
          elapsed_time: number
          feedbacks: string | null
          id: string
          name: string
          pace: number | null
          source: string | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_distance?: number | null
          actual_elapsed_time?: number | null
          actual_pace?: number | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          difficulty_level?: number | null
          distance: number
          elapsed_time: number
          feedbacks?: string | null
          id?: string
          name: string
          pace?: number | null
          source?: string | null
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_distance?: number | null
          actual_elapsed_time?: number | null
          actual_pace?: number | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          difficulty_level?: number | null
          distance?: number
          elapsed_time?: number
          feedbacks?: string | null
          id?: string
          name?: string
          pace?: number | null
          source?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      view_users_summary: {
        Row: {
          age: number | null
          birth_date: string | null
          channel: Database["public"]["Enums"]["onboarding_channel"] | null
          comments: number | null
          completed_runs: number | null
          created_at_brasil: string | null
          ddd: string | null
          fatigue_logs: number | null
          goal: number | null
          height_cm: number | null
          imc: number | null
          name: string | null
          onboarding: Database["public"]["Enums"]["onboarding_status"] | null
          phone: string | null
          planned_runs: number | null
          sex: string | null
          strava_interest: boolean | null
          subscription: string | null
          training:
          | Database["public"]["Enums"]["training_generation_status"]
          | null
          user_id: string | null
          weight_kg: number | null
          whatsapp_messages: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_pace_seconds: {
        Args: { p_distance_m: number; p_elapsed_seconds: number }
        Returns: number
      }
      get_phone_location: {
        Args: { phone_number: string }
        Returns: {
          country: string
          ddd: string
          state: string
        }[]
      }
      pace_formatted_to_seconds: { Args: { p_pace: string }; Returns: number }
      time_string_to_seconds: { Args: { p_time: string }; Returns: number }
    }
    Enums: {
      onboarding_channel: "app" | "whatsapp"
      onboarding_status: "not_started" | "in_progress" | "completed"
      training_generation_status:
      | "idle"
      | "generating"
      | "completed"
      | "failed"
      | "timeout"
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
  chat: {
    Enums: {
      reminder_status: ["pending", "done", "cancelled"],
    },
  },
  graphql_public: {
    Enums: {},
  },
  marketing: {
    Enums: {},
  },
  public: {
    Enums: {
      onboarding_channel: ["app", "whatsapp"],
      onboarding_status: ["not_started", "in_progress", "completed"],
      training_generation_status: [
        "idle",
        "generating",
        "completed",
        "failed",
        "timeout",
      ],
    },
  },
} as const

