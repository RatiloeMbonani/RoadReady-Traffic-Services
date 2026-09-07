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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          admin_notes: string | null
          appointment_date: string | null
          booking_type: Database["public"]["Enums"]["booking_type"]
          created_at: string
          id: string
          preferred_date: string
          status: Database["public"]["Enums"]["application_status"]
          traffic_department: string
          updated_at: string
          user_id: string
          vehicle_class: string | null
        }
        Insert: {
          admin_notes?: string | null
          appointment_date?: string | null
          booking_type: Database["public"]["Enums"]["booking_type"]
          created_at?: string
          id?: string
          preferred_date: string
          status?: Database["public"]["Enums"]["application_status"]
          traffic_department: string
          updated_at?: string
          user_id: string
          vehicle_class?: string | null
        }
        Update: {
          admin_notes?: string | null
          appointment_date?: string | null
          booking_type?: Database["public"]["Enums"]["booking_type"]
          created_at?: string
          id?: string
          preferred_date?: string
          status?: Database["public"]["Enums"]["application_status"]
          traffic_department?: string
          updated_at?: string
          user_id?: string
          vehicle_class?: string | null
        }
        Relationships: []
      }
      fines: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          location: string
          offence: string
          offence_date: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          reference_number: string
          updated_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          location: string
          offence: string
          offence_date: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reference_number: string
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          location?: string
          offence?: string
          offence_date?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reference_number?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fines_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          fine_id: string
          id: string
          paid_at: string | null
          provider: string | null
          provider_reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          fine_id: string
          id?: string
          paid_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fine_id?: string
          id?: string
          paid_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_fine_id_fkey"
            columns: ["fine_id"]
            isOneToOne: false
            referencedRelation: "fines"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          drivers_expiry: string | null
          drivers_number: string | null
          email: string
          full_name: string
          id: string
          id_number: string | null
          learners_expiry: string | null
          learners_number: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          drivers_expiry?: string | null
          drivers_number?: string | null
          email: string
          full_name: string
          id: string
          id_number?: string | null
          learners_expiry?: string | null
          learners_number?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          drivers_expiry?: string | null
          drivers_number?: string | null
          email?: string
          full_name?: string
          id?: string
          id_number?: string | null
          learners_expiry?: string | null
          learners_number?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          admin_notes: string | null
          color: string | null
          created_at: string
          document_reference: string | null
          id: string
          make: string
          manufacture_year: number | null
          model: string
          number_plate: string
          registration_status: Database["public"]["Enums"]["vehicle_status"]
          updated_at: string
          user_id: string
          vin: string | null
        }
        Insert: {
          admin_notes?: string | null
          color?: string | null
          created_at?: string
          document_reference?: string | null
          id?: string
          make: string
          manufacture_year?: number | null
          model: string
          number_plate: string
          registration_status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          user_id: string
          vin?: string | null
        }
        Update: {
          admin_notes?: string | null
          color?: string | null
          created_at?: string
          document_reference?: string | null
          id?: string
          make?: string
          manufacture_year?: number | null
          model?: string
          number_plate?: string
          registration_status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          user_id?: string
          vin?: string | null
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
      app_role: "admin" | "user"
      application_status:
        | "pending"
        | "approved"
        | "rejected"
        | "passed"
        | "failed"
        | "cancelled"
      booking_type: "learners" | "drivers"
      payment_status: "unpaid" | "pending" | "paid" | "failed" | "refunded"
      vehicle_status: "pending" | "verified" | "rejected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      application_status: [
        "pending",
        "approved",
        "rejected",
        "passed",
        "failed",
        "cancelled",
      ],
      booking_type: ["learners", "drivers"],
      payment_status: ["unpaid", "pending", "paid", "failed", "refunded"],
      vehicle_status: ["pending", "verified", "rejected"],
    },
  },
} as const
