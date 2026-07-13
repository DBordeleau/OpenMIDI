export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      asset_credits: {
        Row: {
          asset_id: string
          created_at: string
          credit_name: string
          position: number
          role: Database["public"]["Enums"]["asset_credit_role"]
          user_id: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          credit_name: string
          position: number
          role: Database["public"]["Enums"]["asset_credit_role"]
          user_id?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          credit_name?: string
          position?: number
          role?: Database["public"]["Enums"]["asset_credit_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_credits_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_uploads: {
        Row: {
          asset_id: string
          client_duration_ms: number | null
          client_filename: string
          client_media_type: string | null
          created_at: string
          expected_byte_size: number
          expected_sha256: string | null
          expires_at: string
          owner_id: string
          request_id: string
          updated_at: string
        }
        Insert: {
          asset_id: string
          client_duration_ms?: number | null
          client_filename: string
          client_media_type?: string | null
          created_at?: string
          expected_byte_size: number
          expected_sha256?: string | null
          expires_at: string
          owner_id: string
          request_id: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          client_duration_ms?: number | null
          client_filename?: string
          client_media_type?: string | null
          created_at?: string
          expected_byte_size?: number
          expected_sha256?: string | null
          expires_at?: string
          owner_id?: string
          request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_uploads_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_uploads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_uploads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          bucket: string
          byte_size: number | null
          channels: number | null
          created_at: string
          declared_media_type: string | null
          deleted_at: string | null
          duration_ms: number | null
          failed_at: string | null
          failure_code: string | null
          id: string
          kind: Database["public"]["Enums"]["asset_kind"]
          media_type: string | null
          object_path: string
          original_filename: string
          owner_id: string
          ready_at: string | null
          reserved_byte_size: number
          sample_rate_hz: number | null
          sha256: string | null
          status: Database["public"]["Enums"]["asset_status"]
          upload_completed_at: string | null
          verification_version: string | null
        }
        Insert: {
          bucket?: string
          byte_size?: number | null
          channels?: number | null
          created_at?: string
          declared_media_type?: string | null
          deleted_at?: string | null
          duration_ms?: number | null
          failed_at?: string | null
          failure_code?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          media_type?: string | null
          object_path: string
          original_filename: string
          owner_id: string
          ready_at?: string | null
          reserved_byte_size: number
          sample_rate_hz?: number | null
          sha256?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          upload_completed_at?: string | null
          verification_version?: string | null
        }
        Update: {
          bucket?: string
          byte_size?: number | null
          channels?: number | null
          created_at?: string
          declared_media_type?: string | null
          deleted_at?: string | null
          duration_ms?: number | null
          failed_at?: string | null
          failure_code?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          media_type?: string | null
          object_path?: string
          original_filename?: string
          owner_id?: string
          ready_at?: string | null
          reserved_byte_size?: number
          sample_rate_hz?: number | null
          sha256?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          upload_completed_at?: string | null
          verification_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          name: string
          slug: string
          sort_order: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      global_storage_usage: {
        Row: {
          reserved_source_bytes: number
          singleton: boolean
          source_bytes: number
          updated_at: string
        }
        Insert: {
          reserved_source_bytes?: number
          singleton?: boolean
          source_bytes?: number
          updated_at?: string
        }
        Update: {
          reserved_source_bytes?: number
          singleton?: boolean
          source_bytes?: number
          updated_at?: string
        }
        Relationships: []
      }
      instruments: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "instruments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          allows_derivatives: boolean
          code: string
          created_at: string
          is_active: boolean
          name: string
          requires_attribution: boolean
          share_alike: boolean
          sort_order: number
          summary: string
          url: string
        }
        Insert: {
          allows_derivatives: boolean
          code: string
          created_at?: string
          is_active?: boolean
          name: string
          requires_attribution: boolean
          share_alike: boolean
          sort_order: number
          summary: string
          url: string
        }
        Update: {
          allows_derivatives?: boolean
          code?: string
          created_at?: string
          is_active?: boolean
          name?: string
          requires_attribution?: boolean
          share_alike?: boolean
          sort_order?: number
          summary?: string
          url?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string
          credit_name: string | null
          display_name: string | null
          id: string
          last_active_at: string | null
          profile_completed_at: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          username: string | null
          username_normalized: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          credit_name?: string | null
          display_name?: string | null
          id: string
          last_active_at?: string | null
          profile_completed_at?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          username?: string | null
          username_normalized?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          credit_name?: string | null
          display_name?: string | null
          id?: string
          last_active_at?: string | null
          profile_completed_at?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          username?: string | null
          username_normalized?: string | null
        }
        Relationships: []
      }
      project_genres: {
        Row: {
          created_at: string
          genre_id: string
          is_primary: boolean
          project_id: string
        }
        Insert: {
          created_at?: string
          genre_id: string
          is_primary?: boolean
          project_id: string
        }
        Update: {
          created_at?: string
          genre_id?: string
          is_primary?: boolean
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_genres_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          created_by: string
          project_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          project_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          project_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tags: {
        Row: {
          created_at: string
          project_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          bpm: number | null
          create_request_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          license_code: string
          lock_version: number
          musical_key: string | null
          open_to_contributions: boolean
          owner_id: string
          published_at: string | null
          status: Database["public"]["Enums"]["project_status"]
          time_signature_denominator: number
          time_signature_numerator: number
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["project_visibility"]
        }
        Insert: {
          bpm?: number | null
          create_request_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          license_code: string
          lock_version?: number
          musical_key?: string | null
          open_to_contributions?: boolean
          owner_id: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          time_signature_denominator?: number
          time_signature_numerator?: number
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["project_visibility"]
        }
        Update: {
          bpm?: number | null
          create_request_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          license_code?: string
          lock_version?: number
          musical_key?: string | null
          open_to_contributions?: boolean
          owner_id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          time_signature_denominator?: number
          time_signature_numerator?: number
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["project_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "projects_license_code_fkey"
            columns: ["license_code"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reserved_usernames: {
        Row: {
          created_at: string
          reason: string | null
          username_normalized: string
        }
        Insert: {
          created_at?: string
          reason?: string | null
          username_normalized: string
        }
        Update: {
          created_at?: string
          reason?: string | null
          username_normalized?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          is_active: boolean
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name: string
          id: string
          is_active?: boolean
          slug: string
          sort_order: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_storage_usage: {
        Row: {
          reserved_source_bytes: number
          source_bytes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          reserved_source_bytes?: number
          source_bytes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          reserved_source_bytes?: number
          source_bytes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_storage_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_storage_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          bio: string | null
          created_at: string | null
          credit_name: string | null
          display_name: string | null
          id: string | null
          updated_at: string | null
          username: string | null
          username_normalized: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          credit_name?: string | null
          display_name?: string | null
          id?: string | null
          updated_at?: string | null
          username?: string | null
          username_normalized?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          credit_name?: string | null
          display_name?: string | null
          id?: string | null
          updated_at?: string | null
          username?: string | null
          username_normalized?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cancel_source_upload: {
        Args: { p_asset_id: string }
        Returns: Database["public"]["Enums"]["asset_status"]
      }
      claim_username: {
        Args: { p_username: string }
        Returns: {
          username: string
          username_normalized: string
        }[]
      }
      complete_source_upload: {
        Args: { p_asset_id: string }
        Returns: Database["public"]["Enums"]["asset_status"]
      }
      create_project: {
        Args: {
          p_bpm: number
          p_description: string
          p_genre_ids: string[]
          p_license_code: string
          p_musical_key: string
          p_primary_genre_id: string
          p_request_id: string
          p_tag_ids: string[]
          p_time_signature_denominator: number
          p_time_signature_numerator: number
          p_title: string
        }
        Returns: {
          id: string
          lock_version: number
          title: string
        }[]
      }
      get_viewer_profile: {
        Args: never
        Returns: {
          bio: string
          created_at: string
          credit_name: string
          display_name: string
          id: string
          last_active_at: string
          profile_completed_at: string
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          username: string
          username_normalized: string
        }[]
      }
      operator_fail_source_asset: {
        Args: { p_asset_id: string; p_failure_code: string }
        Returns: undefined
      }
      operator_promote_source_asset: {
        Args: {
          p_asset_id: string
          p_byte_size: number
          p_channels: number
          p_duration_ms: number
          p_media_type: string
          p_sample_rate_hz: number
          p_sha256: string
          p_verification_version: string
        }
        Returns: undefined
      }
      reserve_source_asset: {
        Args: {
          p_client_duration_ms?: number
          p_declared_media_type?: string
          p_expected_byte_size: number
          p_expected_sha256?: string
          p_filename: string
          p_request_id: string
        }
        Returns: {
          asset_id: string
          bucket: string
          capacity_warning: boolean
          expires_at: string
          global_remaining_bytes: number
          object_path: string
          user_remaining_bytes: number
        }[]
      }
      save_own_profile: {
        Args: {
          p_bio?: string
          p_credit_name: string
          p_display_name: string
          p_username: string
        }
        Returns: {
          bio: string
          created_at: string
          credit_name: string
          display_name: string
          id: string
          profile_completed_at: string
          updated_at: string
          username: string
          username_normalized: string
        }[]
      }
      update_project_metadata: {
        Args: {
          p_bpm: number
          p_description: string
          p_expected_lock_version: number
          p_genre_ids: string[]
          p_license_code: string
          p_musical_key: string
          p_primary_genre_id: string
          p_project_id: string
          p_tag_ids: string[]
          p_time_signature_denominator: number
          p_time_signature_numerator: number
          p_title: string
        }
        Returns: {
          id: string
          lock_version: number
          title: string
        }[]
      }
    }
    Enums: {
      account_status: "active" | "suspended" | "deleted"
      asset_credit_role:
        | "creator"
        | "performer"
        | "producer"
        | "engineer"
        | "other"
      asset_kind:
        | "source_audio"
        | "workspace_snapshot"
        | "mix_preview"
        | "waveform_peaks"
        | "image"
      asset_status:
        | "reserved"
        | "uploading"
        | "processing"
        | "ready"
        | "failed"
        | "deleted"
      member_role: "owner" | "editor" | "viewer"
      project_status: "draft" | "active" | "archived" | "deleted"
      project_visibility: "private" | "unlisted" | "public"
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
    Enums: {
      account_status: ["active", "suspended", "deleted"],
      asset_credit_role: [
        "creator",
        "performer",
        "producer",
        "engineer",
        "other",
      ],
      asset_kind: [
        "source_audio",
        "workspace_snapshot",
        "mix_preview",
        "waveform_peaks",
        "image",
      ],
      asset_status: [
        "reserved",
        "uploading",
        "processing",
        "ready",
        "failed",
        "deleted",
      ],
      member_role: ["owner", "editor", "viewer"],
      project_status: ["draft", "active", "archived", "deleted"],
      project_visibility: ["private", "unlisted", "public"],
    },
  },
} as const

