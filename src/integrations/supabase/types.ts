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
      hangout_change_requests: {
        Row: {
          created_at: string
          hangout_id: string
          id: string
          new_snapshot: Json
          old_snapshot: Json
          proposed_by_participant_id: string
          proposer_comment: string | null
          responded_at: string | null
          responder_comment: string | null
          responder_participant_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          hangout_id: string
          id?: string
          new_snapshot?: Json
          old_snapshot?: Json
          proposed_by_participant_id: string
          proposer_comment?: string | null
          responded_at?: string | null
          responder_comment?: string | null
          responder_participant_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          hangout_id?: string
          id?: string
          new_snapshot?: Json
          old_snapshot?: Json
          proposed_by_participant_id?: string
          proposer_comment?: string | null
          responded_at?: string | null
          responder_comment?: string | null
          responder_participant_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hangout_change_requests_hangout_id_fkey"
            columns: ["hangout_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hangout_change_requests_proposed_by_participant_id_fkey"
            columns: ["proposed_by_participant_id"]
            isOneToOne: false
            referencedRelation: "hangout_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hangout_change_requests_responder_participant_id_fkey"
            columns: ["responder_participant_id"]
            isOneToOne: false
            referencedRelation: "hangout_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      hangout_invitees: {
        Row: {
          comment: string | null
          created_at: string
          email: string
          hangout_id: string
          id: string
          name: string
          responded_at: string | null
          response_status: string
          slug: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          email: string
          hangout_id: string
          id?: string
          name: string
          responded_at?: string | null
          response_status?: string
          slug?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          email?: string
          hangout_id?: string
          id?: string
          name?: string
          responded_at?: string | null
          response_status?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "hangout_invitees_hangout_id_fkey"
            columns: ["hangout_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      hangout_participants: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          hangout_id: string
          id: string
          is_active: boolean
          needs_reconfirmation: boolean
          role_source: string
          slug: string | null
          source_row_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          hangout_id: string
          id?: string
          is_active?: boolean
          needs_reconfirmation?: boolean
          role_source: string
          slug?: string | null
          source_row_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          hangout_id?: string
          id?: string
          is_active?: boolean
          needs_reconfirmation?: boolean
          role_source?: string
          slug?: string | null
          source_row_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hangout_participants_hangout_id_fkey"
            columns: ["hangout_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          admin_comment: string | null
          category: string
          created_at: string
          custom_venue_image_url: string | null
          custom_venue_location: string | null
          custom_venue_name: string | null
          end_time: string | null
          hangout_kind: string
          hangout_status: string
          id: string
          initiator: string
          parent_hangout_id: string | null
          pitch: string | null
          request_message: string | null
          request_status: string | null
          requester_email: string | null
          requester_name: string | null
          slug: string
          start_time: string
          title: string | null
          updated_at: string
          venue_id: string | null
          visibility: string
        }
        Insert: {
          admin_comment?: string | null
          category: string
          created_at?: string
          custom_venue_image_url?: string | null
          custom_venue_location?: string | null
          custom_venue_name?: string | null
          end_time?: string | null
          hangout_kind?: string
          hangout_status?: string
          id?: string
          initiator?: string
          parent_hangout_id?: string | null
          pitch?: string | null
          request_message?: string | null
          request_status?: string | null
          requester_email?: string | null
          requester_name?: string | null
          slug?: string
          start_time: string
          title?: string | null
          updated_at?: string
          venue_id?: string | null
          visibility?: string
        }
        Update: {
          admin_comment?: string | null
          category?: string
          created_at?: string
          custom_venue_image_url?: string | null
          custom_venue_location?: string | null
          custom_venue_name?: string | null
          end_time?: string | null
          hangout_kind?: string
          hangout_status?: string
          id?: string
          initiator?: string
          parent_hangout_id?: string | null
          pitch?: string | null
          request_message?: string | null
          request_status?: string | null
          requester_email?: string | null
          requester_name?: string | null
          slug?: string
          start_time?: string
          title?: string | null
          updated_at?: string
          venue_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_parent_hangout_id_fkey"
            columns: ["parent_hangout_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          location: string | null
          name: string
          url: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          name: string
          url?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          name?: string
          url?: string | null
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
