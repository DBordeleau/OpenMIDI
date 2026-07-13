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
      activity_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          project_id: string
          subject_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          event_type: string
          id?: string
          payload: Json
          project_id: string
          subject_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          project_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_project_id_subject_id_fkey"
            columns: ["project_id", "subject_id"]
            isOneToOne: false
            referencedRelation: "project_revisions"
            referencedColumns: ["project_id", "id"]
          },
        ]
      }
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
      project_asset_references: {
        Row: {
          added_by: string
          asset_id: string
          created_at: string
          first_revision_id: string
          project_id: string
        }
        Insert: {
          added_by: string
          asset_id: string
          created_at?: string
          first_revision_id: string
          project_id: string
        }
        Update: {
          added_by?: string
          asset_id?: string
          created_at?: string
          first_revision_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_asset_references_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_asset_references_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_asset_references_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_asset_references_project_id_first_revision_id_fkey"
            columns: ["project_id", "first_revision_id"]
            isOneToOne: false
            referencedRelation: "project_revisions"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "project_asset_references_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      project_revisions: {
        Row: {
          created_at: string
          created_by: string
          duration_ms: number
          engine: string
          engine_version: string
          expected_base_revision_id: string | null
          id: string
          manifest: Json
          manifest_sha256: string
          manifest_version: number
          message: string | null
          parent_revision_id: string | null
          project_id: string
          publish_request_id: string
          revision_number: number
          snapshot_asset_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          duration_ms: number
          engine: string
          engine_version: string
          expected_base_revision_id?: string | null
          id?: string
          manifest: Json
          manifest_sha256: string
          manifest_version: number
          message?: string | null
          parent_revision_id?: string | null
          project_id: string
          publish_request_id: string
          revision_number: number
          snapshot_asset_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_ms?: number
          engine?: string
          engine_version?: string
          expected_base_revision_id?: string | null
          id?: string
          manifest?: Json
          manifest_sha256?: string
          manifest_version?: number
          message?: string | null
          parent_revision_id?: string | null
          project_id?: string
          publish_request_id?: string
          revision_number?: number
          snapshot_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_revisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_revisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_revisions_expected_base_project_fk"
            columns: ["project_id", "expected_base_revision_id"]
            isOneToOne: false
            referencedRelation: "project_revisions"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "project_revisions_parent_project_fk"
            columns: ["project_id", "parent_revision_id"]
            isOneToOne: false
            referencedRelation: "project_revisions"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "project_revisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_storage_usage: {
        Row: {
          project_id: string
          source_bytes: number
          unique_source_count: number
          updated_at: string
        }
        Insert: {
          project_id: string
          source_bytes?: number
          unique_source_count?: number
          updated_at?: string
        }
        Update: {
          project_id?: string
          source_bytes?: number
          unique_source_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_storage_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
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
          current_revision_id: string | null
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
          current_revision_id?: string | null
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
          current_revision_id?: string | null
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
            foreignKeyName: "projects_current_revision_fk"
            columns: ["id", "current_revision_id"]
            isOneToOne: true
            referencedRelation: "project_revisions"
            referencedColumns: ["project_id", "id"]
          },
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
      revision_tracks: {
        Row: {
          added_by: string
          asset_id: string
          duration_ms: number
          gain_db: number
          id: string
          instrument_id: string | null
          muted: boolean
          name: string
          pan: number
          position_ms: number
          revision_id: string
          soloed: boolean
          sort_order: number
          trim_start_ms: number
        }
        Insert: {
          added_by: string
          asset_id: string
          duration_ms: number
          gain_db: number
          id: string
          instrument_id?: string | null
          muted: boolean
          name: string
          pan: number
          position_ms: number
          revision_id: string
          soloed: boolean
          sort_order: number
          trim_start_ms: number
        }
        Update: {
          added_by?: string
          asset_id?: string
          duration_ms?: number
          gain_db?: number
          id?: string
          instrument_id?: string | null
          muted?: boolean
          name?: string
          pan?: number
          position_ms?: number
          revision_id?: string
          soloed?: boolean
          sort_order?: number
          trim_start_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "revision_tracks_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_tracks_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_tracks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_tracks_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_tracks_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "project_revisions"
            referencedColumns: ["id"]
          },
        ]
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
      workspace_tracks: {
        Row: {
          asset_id: string
          duration_ms: number
          gain_db: number
          instrument_id: string | null
          muted: boolean
          name: string
          pan: number
          position_ms: number
          soloed: boolean
          sort_order: number
          track_id: string
          trim_start_ms: number
          workspace_id: string
        }
        Insert: {
          asset_id: string
          duration_ms: number
          gain_db: number
          instrument_id?: string | null
          muted: boolean
          name: string
          pan: number
          position_ms: number
          soloed: boolean
          sort_order: number
          track_id: string
          trim_start_ms: number
          workspace_id: string
        }
        Update: {
          asset_id?: string
          duration_ms?: number
          gain_db?: number
          instrument_id?: string | null
          muted?: boolean
          name?: string
          pan?: number
          position_ms?: number
          soloed?: boolean
          sort_order?: number
          track_id?: string
          trim_start_ms?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_tracks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_tracks_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_tracks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          base_revision_id: string | null
          create_request_id: string
          created_at: string
          engine: string
          engine_version: string
          id: string
          lock_version: number
          manifest: Json
          manifest_sha256: string
          manifest_version: number
          owner_id: string
          project_id: string
          snapshot_asset_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          base_revision_id?: string | null
          create_request_id: string
          created_at?: string
          engine: string
          engine_version: string
          id?: string
          lock_version?: number
          manifest: Json
          manifest_sha256: string
          manifest_version: number
          owner_id: string
          project_id: string
          snapshot_asset_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          base_revision_id?: string | null
          create_request_id?: string
          created_at?: string
          engine?: string
          engine_version?: string
          id?: string
          lock_version?: number
          manifest?: Json
          manifest_sha256?: string
          manifest_version?: number
          owner_id?: string
          project_id?: string
          snapshot_asset_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_base_revision_id_fkey"
            columns: ["base_revision_id"]
            isOneToOne: false
            referencedRelation: "project_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspaces_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspaces_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspaces_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspaces_snapshot_asset_id_fkey"
            columns: ["snapshot_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
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
      create_project_workspace: {
        Args: {
          p_expected_current_revision_id: string
          p_project_id: string
          p_request_id: string
        }
        Returns: {
          base_revision_id: string
          created_at: string
          lock_version: number
          workspace_id: string
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
      publish_project_revision: {
        Args: {
          p_expected_current_revision_id: string
          p_manifest: Json
          p_message: string
          p_project_id: string
          p_request_id: string
        }
        Returns: {
          created_at: string
          revision_id: string
          revision_number: number
        }[]
      }
      publish_workspace_revision: {
        Args: {
          p_expected_base_revision_id: string
          p_expected_lock_version: number
          p_message: string
          p_request_id: string
          p_workspace_id: string
        }
        Returns: {
          created_at: string
          revision_id: string
          revision_number: number
          workspace_lock_version: number
        }[]
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
      reserve_workspace_snapshot: {
        Args: {
          p_byte_size: number
          p_expected_lock_version: number
          p_manifest_sha256: string
          p_request_id: string
          p_workspace_id: string
        }
        Returns: {
          asset_id: string
          bucket: string
          expires_at: string
          object_path: string
        }[]
      }
      restart_project_workspace: {
        Args: {
          p_expected_base_revision_id: string
          p_expected_current_revision_id: string
          p_expected_lock_version: number
          p_request_id: string
          p_workspace_id: string
        }
        Returns: {
          base_revision_id: string
          created_at: string
          lock_version: number
          workspace_id: string
        }[]
      }
      revision_manifest_checksum_valid: {
        Args: { p_project_id: string; p_revision_id: string }
        Returns: boolean
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
      save_workspace: {
        Args: {
          p_expected_lock_version: number
          p_manifest: Json
          p_request_id: string
          p_snapshot_asset_id: string
          p_workspace_id: string
        }
        Returns: {
          lock_version: number
          manifest_sha256: string
          updated_at: string
          workspace_id: string
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

