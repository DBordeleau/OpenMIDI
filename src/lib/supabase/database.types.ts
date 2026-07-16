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
          credits_confirmation_request_id: string | null
          credits_confirmation_sha256: string | null
          credits_confirmed_at: string | null
          declared_media_type: string | null
          deleted_at: string | null
          duration_ms: number | null
          failed_at: string | null
          failure_code: string | null
          frame_count: number | null
          id: string
          image_height: number | null
          image_width: number | null
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
          credits_confirmation_request_id?: string | null
          credits_confirmation_sha256?: string | null
          credits_confirmed_at?: string | null
          declared_media_type?: string | null
          deleted_at?: string | null
          duration_ms?: number | null
          failed_at?: string | null
          failure_code?: string | null
          frame_count?: number | null
          id?: string
          image_height?: number | null
          image_width?: number | null
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
          credits_confirmation_request_id?: string | null
          credits_confirmation_sha256?: string | null
          credits_confirmed_at?: string | null
          declared_media_type?: string | null
          deleted_at?: string | null
          duration_ms?: number | null
          failed_at?: string | null
          failure_code?: string | null
          frame_count?: number | null
          id?: string
          image_height?: number | null
          image_width?: number | null
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
      contribution_reviews: {
        Row: {
          applied_decision: Database["public"]["Enums"]["contribution_review_decision"]
          contribution_id: string
          contribution_version_id: string
          created_at: string
          expected_project_revision_id: string
          id: string
          note: string | null
          reason:
            | Database["public"]["Enums"]["contribution_review_reason"]
            | null
          request_id: string
          requested_decision: Database["public"]["Enums"]["contribution_review_decision"]
          resulting_revision_id: string | null
          reviewer_id: string
        }
        Insert: {
          applied_decision: Database["public"]["Enums"]["contribution_review_decision"]
          contribution_id: string
          contribution_version_id: string
          created_at?: string
          expected_project_revision_id: string
          id?: string
          note?: string | null
          reason?:
            | Database["public"]["Enums"]["contribution_review_reason"]
            | null
          request_id: string
          requested_decision: Database["public"]["Enums"]["contribution_review_decision"]
          resulting_revision_id?: string | null
          reviewer_id: string
        }
        Update: {
          applied_decision?: Database["public"]["Enums"]["contribution_review_decision"]
          contribution_id?: string
          contribution_version_id?: string
          created_at?: string
          expected_project_revision_id?: string
          id?: string
          note?: string | null
          reason?:
            | Database["public"]["Enums"]["contribution_review_reason"]
            | null
          request_id?: string
          requested_decision?: Database["public"]["Enums"]["contribution_review_decision"]
          resulting_revision_id?: string | null
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_reviews_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_reviews_expected_project_revision_id_fkey"
            columns: ["expected_project_revision_id"]
            isOneToOne: false
            referencedRelation: "project_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_reviews_result_fk"
            columns: ["contribution_id", "resulting_revision_id"]
            isOneToOne: false
            referencedRelation: "project_revisions"
            referencedColumns: ["accepted_contribution_id", "id"]
          },
          {
            foreignKeyName: "contribution_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_reviews_version_fk"
            columns: ["contribution_id", "contribution_version_id"]
            isOneToOne: false
            referencedRelation: "contribution_versions"
            referencedColumns: ["contribution_id", "id"]
          },
        ]
      }
      contribution_version_clips: {
        Row: {
          clip_id: string
          contribution_version_id: string
          duration_ms: number | null
          duration_ticks: number | null
          kind: string
          loop: boolean | null
          midi_stem_version_id: string | null
          position_ms: number | null
          source_start_tick: number | null
          start_tick: number | null
          track_id: string
          trim_start_ms: number | null
        }
        Insert: {
          clip_id: string
          contribution_version_id: string
          duration_ms?: number | null
          duration_ticks?: number | null
          kind: string
          loop?: boolean | null
          midi_stem_version_id?: string | null
          position_ms?: number | null
          source_start_tick?: number | null
          start_tick?: number | null
          track_id: string
          trim_start_ms?: number | null
        }
        Update: {
          clip_id?: string
          contribution_version_id?: string
          duration_ms?: number | null
          duration_ticks?: number | null
          kind?: string
          loop?: boolean | null
          midi_stem_version_id?: string | null
          position_ms?: number | null
          source_start_tick?: number | null
          start_tick?: number | null
          track_id?: string
          trim_start_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contribution_version_clips_contribution_version_id_fkey"
            columns: ["contribution_version_id"]
            isOneToOne: false
            referencedRelation: "contribution_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_version_clips_contribution_version_id_track_i_fkey"
            columns: ["contribution_version_id", "track_id"]
            isOneToOne: false
            referencedRelation: "contribution_version_tracks"
            referencedColumns: ["contribution_version_id", "track_id"]
          },
          {
            foreignKeyName: "contribution_version_clips_midi_stem_version_id_fkey"
            columns: ["midi_stem_version_id"]
            isOneToOne: false
            referencedRelation: "midi_stem_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_version_midi_track_credits: {
        Row: {
          contribution_version_id: string
          creator_credit_name: string
          creator_id: string
          credit_role: string
          credited_stem_version_id: string
          midi_stem_version_id: string
          track_id: string
        }
        Insert: {
          contribution_version_id: string
          creator_credit_name: string
          creator_id: string
          credit_role: string
          credited_stem_version_id: string
          midi_stem_version_id: string
          track_id: string
        }
        Update: {
          contribution_version_id?: string
          creator_credit_name?: string
          creator_id?: string
          credit_role?: string
          credited_stem_version_id?: string
          midi_stem_version_id?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_version_midi_tra_contribution_version_id_trac_fkey"
            columns: ["contribution_version_id", "track_id"]
            isOneToOne: false
            referencedRelation: "contribution_version_tracks"
            referencedColumns: ["contribution_version_id", "track_id"]
          },
          {
            foreignKeyName: "contribution_version_midi_track_c_credited_stem_version_id_fkey"
            columns: ["credited_stem_version_id"]
            isOneToOne: false
            referencedRelation: "midi_stem_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_version_midi_track_credi_midi_stem_version_id_fkey"
            columns: ["midi_stem_version_id"]
            isOneToOne: false
            referencedRelation: "midi_stem_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_version_midi_track_credits_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_version_midi_track_credits_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_version_tracks: {
        Row: {
          added_by: string
          asset_id: string | null
          contribution_version_id: string
          duration_ms: number | null
          gain_db: number
          instrument_id: string | null
          kind: string
          muted: boolean
          name: string
          pan: number
          position_ms: number | null
          preset_id: string | null
          preset_version: number | null
          soloed: boolean
          sort_order: number
          track_id: string
          trim_start_ms: number | null
        }
        Insert: {
          added_by: string
          asset_id?: string | null
          contribution_version_id: string
          duration_ms?: number | null
          gain_db: number
          instrument_id?: string | null
          kind?: string
          muted: boolean
          name: string
          pan: number
          position_ms?: number | null
          preset_id?: string | null
          preset_version?: number | null
          soloed: boolean
          sort_order: number
          track_id: string
          trim_start_ms?: number | null
        }
        Update: {
          added_by?: string
          asset_id?: string | null
          contribution_version_id?: string
          duration_ms?: number | null
          gain_db?: number
          instrument_id?: string | null
          kind?: string
          muted?: boolean
          name?: string
          pan?: number
          position_ms?: number | null
          preset_id?: string | null
          preset_version?: number | null
          soloed?: boolean
          sort_order?: number
          track_id?: string
          trim_start_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contribution_version_tracks_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_version_tracks_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_version_tracks_asset_fk"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_version_tracks_contribution_version_id_fkey"
            columns: ["contribution_version_id"]
            isOneToOne: false
            referencedRelation: "contribution_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_version_tracks_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_versions: {
        Row: {
          attestation_version: string
          base_revision_id: string
          contribution_id: string
          created_at: string
          created_by: string
          duration_ms: number
          engine: string
          engine_version: string
          id: string
          manifest: Json
          manifest_sha256: string
          manifest_version: number
          snapshot_asset_id: string | null
          submission_request_id: string
          version_number: number
          workspace_lock_version: number
        }
        Insert: {
          attestation_version: string
          base_revision_id: string
          contribution_id: string
          created_at?: string
          created_by: string
          duration_ms: number
          engine: string
          engine_version: string
          id?: string
          manifest: Json
          manifest_sha256: string
          manifest_version: number
          snapshot_asset_id?: string | null
          submission_request_id: string
          version_number: number
          workspace_lock_version: number
        }
        Update: {
          attestation_version?: string
          base_revision_id?: string
          contribution_id?: string
          created_at?: string
          created_by?: string
          duration_ms?: number
          engine?: string
          engine_version?: string
          id?: string
          manifest?: Json
          manifest_sha256?: string
          manifest_version?: number
          snapshot_asset_id?: string | null
          submission_request_id?: string
          version_number?: number
          workspace_lock_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contribution_versions_base_revision_id_fkey"
            columns: ["base_revision_id"]
            isOneToOne: false
            referencedRelation: "project_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_versions_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_versions_snapshot_asset_id_fkey"
            columns: ["snapshot_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      contributions: {
        Row: {
          author_id: string
          base_revision_id: string
          create_request_id: string
          created_at: string
          current_version_id: string | null
          deleted_at: string | null
          description: string | null
          id: string
          moderation_state: string
          moderation_updated_at: string
          moderation_version: number
          project_id: string
          purged_at: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["contribution_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          author_id: string
          base_revision_id: string
          create_request_id: string
          created_at?: string
          current_version_id?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          moderation_state?: string
          moderation_updated_at?: string
          moderation_version?: number
          project_id: string
          purged_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["contribution_status"]
          submitted_at?: string | null
          title: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          author_id?: string
          base_revision_id?: string
          create_request_id?: string
          created_at?: string
          current_version_id?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          moderation_state?: string
          moderation_updated_at?: string
          moderation_version?: number
          project_id?: string
          purged_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["contribution_status"]
          submitted_at?: string | null
          title?: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contributions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_current_version_fk"
            columns: ["id", "current_version_id"]
            isOneToOne: false
            referencedRelation: "contribution_versions"
            referencedColumns: ["contribution_id", "id"]
          },
          {
            foreignKeyName: "contributions_project_base_fk"
            columns: ["project_id", "base_revision_id"]
            isOneToOne: false
            referencedRelation: "project_revisions"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "contributions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_state: {
        Row: {
          singleton: boolean
          updated_at: string
          version: number
        }
        Insert: {
          singleton?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          singleton?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: []
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
          derived_bytes: number
          reserved_derived_bytes: number
          reserved_source_bytes: number
          singleton: boolean
          source_bytes: number
          updated_at: string
        }
        Insert: {
          derived_bytes?: number
          reserved_derived_bytes?: number
          reserved_source_bytes?: number
          singleton?: boolean
          source_bytes?: number
          updated_at?: string
        }
        Update: {
          derived_bytes?: number
          reserved_derived_bytes?: number
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
      midi_stem_drafts: {
        Row: {
          content_sha256: string
          created_at: string
          default_preset_id: string
          default_preset_version: number
          duration_ticks: number
          entry_mode: string
          id: string
          last_save_expected_lock_version: number | null
          last_save_request_id: string | null
          lock_version: number
          name: string
          note_count: number
          notes: Json
          owner_id: string
          parent_stem_version_id: string | null
          ppq: number
          stem_id: string
          updated_at: string
        }
        Insert: {
          content_sha256: string
          created_at?: string
          default_preset_id: string
          default_preset_version: number
          duration_ticks: number
          entry_mode: string
          id?: string
          last_save_expected_lock_version?: number | null
          last_save_request_id?: string | null
          lock_version?: number
          name: string
          note_count?: number
          notes?: Json
          owner_id: string
          parent_stem_version_id?: string | null
          ppq: number
          stem_id: string
          updated_at?: string
        }
        Update: {
          content_sha256?: string
          created_at?: string
          default_preset_id?: string
          default_preset_version?: number
          duration_ticks?: number
          entry_mode?: string
          id?: string
          last_save_expected_lock_version?: number | null
          last_save_request_id?: string | null
          lock_version?: number
          name?: string
          note_count?: number
          notes?: Json
          owner_id?: string
          parent_stem_version_id?: string | null
          ppq?: number
          stem_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "midi_stem_drafts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_stem_drafts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_stem_drafts_parent_stem_version_id_fkey"
            columns: ["parent_stem_version_id"]
            isOneToOne: false
            referencedRelation: "midi_stem_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_stem_drafts_stem_id_owner_id_fkey"
            columns: ["stem_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "midi_stems"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      midi_stem_versions: {
        Row: {
          content_sha256: string
          created_at: string
          creator_credit_name: string
          default_preset_id: string
          default_preset_version: number
          duration_ticks: number
          id: string
          name: string
          note_count: number
          notes: Json
          owner_id: string
          parent_stem_version_id: string | null
          ppq: number
          publication_request_id: string | null
          source_draft_id: string | null
          source_lock_version: number | null
          stem_id: string
          version: number
        }
        Insert: {
          content_sha256: string
          created_at?: string
          creator_credit_name: string
          default_preset_id: string
          default_preset_version: number
          duration_ticks: number
          id?: string
          name: string
          note_count: number
          notes: Json
          owner_id: string
          parent_stem_version_id?: string | null
          ppq: number
          publication_request_id?: string | null
          source_draft_id?: string | null
          source_lock_version?: number | null
          stem_id: string
          version: number
        }
        Update: {
          content_sha256?: string
          created_at?: string
          creator_credit_name?: string
          default_preset_id?: string
          default_preset_version?: number
          duration_ticks?: number
          id?: string
          name?: string
          note_count?: number
          notes?: Json
          owner_id?: string
          parent_stem_version_id?: string | null
          ppq?: number
          publication_request_id?: string | null
          source_draft_id?: string | null
          source_lock_version?: number | null
          stem_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "midi_stem_versions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_stem_versions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_stem_versions_parent_stem_version_id_fkey"
            columns: ["parent_stem_version_id"]
            isOneToOne: false
            referencedRelation: "midi_stem_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_stem_versions_stem_id_owner_id_fkey"
            columns: ["stem_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "midi_stems"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      midi_stems: {
        Row: {
          create_request_id: string
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          create_request_id: string
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          create_request_id?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "midi_stems_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_stems_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_avatar_versions: {
        Row: {
          byte_size: number | null
          cleaned_at: string | null
          created_at: string
          height: number | null
          id: string
          installed_at: string | null
          media_type: string | null
          profile_id: string
          public_object_path: string
          sha256: string | null
          source_asset_id: string
          status: Database["public"]["Enums"]["profile_avatar_status"]
          superseded_at: string | null
          width: number | null
        }
        Insert: {
          byte_size?: number | null
          cleaned_at?: string | null
          created_at?: string
          height?: number | null
          id: string
          installed_at?: string | null
          media_type?: string | null
          profile_id: string
          public_object_path: string
          sha256?: string | null
          source_asset_id: string
          status?: Database["public"]["Enums"]["profile_avatar_status"]
          superseded_at?: string | null
          width?: number | null
        }
        Update: {
          byte_size?: number | null
          cleaned_at?: string | null
          created_at?: string
          height?: number | null
          id?: string
          installed_at?: string | null
          media_type?: string | null
          profile_id?: string
          public_object_path?: string
          sha256?: string | null
          source_asset_id?: string
          status?: Database["public"]["Enums"]["profile_avatar_status"]
          superseded_at?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_avatar_versions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_avatar_versions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_avatar_versions_source_asset_id_fkey"
            columns: ["source_asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          avatar_updated_at: string | null
          avatar_version_id: string | null
          bio: string | null
          created_at: string
          credit_name: string | null
          deletion_requested_at: string | null
          deletion_restore_until: string | null
          display_name: string | null
          id: string
          last_active_at: string | null
          moderation_state: string
          moderation_updated_at: string
          moderation_version: number
          profile_completed_at: string | null
          purged_at: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          username: string | null
          username_normalized: string | null
        }
        Insert: {
          avatar_path?: string | null
          avatar_updated_at?: string | null
          avatar_version_id?: string | null
          bio?: string | null
          created_at?: string
          credit_name?: string | null
          deletion_requested_at?: string | null
          deletion_restore_until?: string | null
          display_name?: string | null
          id: string
          last_active_at?: string | null
          moderation_state?: string
          moderation_updated_at?: string
          moderation_version?: number
          profile_completed_at?: string | null
          purged_at?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          username?: string | null
          username_normalized?: string | null
        }
        Update: {
          avatar_path?: string | null
          avatar_updated_at?: string | null
          avatar_version_id?: string | null
          bio?: string | null
          created_at?: string
          credit_name?: string | null
          deletion_requested_at?: string | null
          deletion_restore_until?: string | null
          display_name?: string | null
          id?: string
          last_active_at?: string | null
          moderation_state?: string
          moderation_updated_at?: string
          moderation_version?: number
          profile_completed_at?: string | null
          purged_at?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          username?: string | null
          username_normalized?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_avatar_version_fk"
            columns: ["avatar_version_id"]
            isOneToOne: false
            referencedRelation: "profile_avatar_versions"
            referencedColumns: ["id"]
          },
        ]
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
          accepted_contribution_id: string | null
          accepted_contribution_version_id: string | null
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
          accepted_contribution_id?: string | null
          accepted_contribution_version_id?: string | null
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
          accepted_contribution_id?: string | null
          accepted_contribution_version_id?: string | null
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
            foreignKeyName: "project_revisions_accepted_contribution_project_fk"
            columns: ["project_id", "accepted_contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["project_id", "id"]
          },
          {
            foreignKeyName: "project_revisions_accepted_version_fk"
            columns: [
              "accepted_contribution_id",
              "accepted_contribution_version_id",
            ]
            isOneToOne: false
            referencedRelation: "contribution_versions"
            referencedColumns: ["contribution_id", "id"]
          },
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
      project_stats: {
        Row: {
          accepted_contributions: number
          last_public_activity_at: string | null
          project_id: string
          public_direct_forks: number
          revision_events: number
          trending_score: number
          updated_at: string
        }
        Insert: {
          accepted_contributions?: number
          last_public_activity_at?: string | null
          project_id: string
          public_direct_forks?: number
          revision_events?: number
          trending_score?: number
          updated_at?: string
        }
        Update: {
          accepted_contributions?: number
          last_public_activity_at?: string | null
          project_id?: string
          public_direct_forks?: number
          revision_events?: number
          trending_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_stats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
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
          compatibility: string
          create_request_id: string
          created_at: string
          current_revision_id: string | null
          deleted_at: string | null
          description: string | null
          id: string
          license_code: string
          lock_version: number
          moderation_state: string
          moderation_updated_at: string
          moderation_version: number
          musical_key: string | null
          open_to_contributions: boolean
          owner_id: string
          published_at: string | null
          purged_at: string | null
          source_project_id: string | null
          source_revision_id: string | null
          status: Database["public"]["Enums"]["project_status"]
          time_signature_denominator: number
          time_signature_numerator: number
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["project_visibility"]
        }
        Insert: {
          bpm?: number | null
          compatibility?: string
          create_request_id: string
          created_at?: string
          current_revision_id?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          license_code: string
          lock_version?: number
          moderation_state?: string
          moderation_updated_at?: string
          moderation_version?: number
          musical_key?: string | null
          open_to_contributions?: boolean
          owner_id: string
          published_at?: string | null
          purged_at?: string | null
          source_project_id?: string | null
          source_revision_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          time_signature_denominator?: number
          time_signature_numerator?: number
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["project_visibility"]
        }
        Update: {
          bpm?: number | null
          compatibility?: string
          create_request_id?: string
          created_at?: string
          current_revision_id?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          license_code?: string
          lock_version?: number
          moderation_state?: string
          moderation_updated_at?: string
          moderation_version?: number
          musical_key?: string | null
          open_to_contributions?: boolean
          owner_id?: string
          published_at?: string | null
          purged_at?: string | null
          source_project_id?: string | null
          source_revision_id?: string | null
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
            foreignKeyName: "projects_fork_source_revision_fk"
            columns: ["source_project_id", "source_revision_id"]
            isOneToOne: false
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
      public_project_catalog: {
        Row: {
          attributions: Json
          bpm: number | null
          current_revision_id: string
          description: string | null
          discovery_version: number
          duration_ms: number
          genre_slugs: string[]
          genres: Json
          instrument_slugs: string[]
          license_allows_derivatives: boolean
          license_code: string
          license_name: string
          license_summary: string
          license_url: string
          musical_key: string | null
          open_to_contributions: boolean
          owner_id: string
          project_id: string
          published_at: string
          refreshed_at: string
          revision_number: number
          search_vector: unknown
          tag_slugs: string[]
          tags: Json
          time_signature_denominator: number
          time_signature_numerator: number
          title: string
          tracks: Json
          trending_score: number
          updated_at: string
        }
        Insert: {
          attributions: Json
          bpm?: number | null
          current_revision_id: string
          description?: string | null
          discovery_version: number
          duration_ms: number
          genre_slugs: string[]
          genres: Json
          instrument_slugs: string[]
          license_allows_derivatives: boolean
          license_code: string
          license_name: string
          license_summary: string
          license_url: string
          musical_key?: string | null
          open_to_contributions: boolean
          owner_id: string
          project_id: string
          published_at: string
          refreshed_at?: string
          revision_number: number
          search_vector: unknown
          tag_slugs: string[]
          tags: Json
          time_signature_denominator: number
          time_signature_numerator: number
          title: string
          tracks: Json
          trending_score: number
          updated_at: string
        }
        Update: {
          attributions?: Json
          bpm?: number | null
          current_revision_id?: string
          description?: string | null
          discovery_version?: number
          duration_ms?: number
          genre_slugs?: string[]
          genres?: Json
          instrument_slugs?: string[]
          license_allows_derivatives?: boolean
          license_code?: string
          license_name?: string
          license_summary?: string
          license_url?: string
          musical_key?: string | null
          open_to_contributions?: boolean
          owner_id?: string
          project_id?: string
          published_at?: string
          refreshed_at?: string
          revision_number?: number
          search_vector?: unknown
          tag_slugs?: string[]
          tags?: Json
          time_signature_denominator?: number
          time_signature_numerator?: number
          title?: string
          tracks?: Json
          trending_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_project_catalog_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_project_catalog_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_project_catalog_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
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
      revision_attributions: {
        Row: {
          contribution_id: string | null
          contribution_version_id: string | null
          created_at: string
          credit_name: string
          kind: Database["public"]["Enums"]["revision_attribution_kind"]
          revision_id: string
          user_id: string
        }
        Insert: {
          contribution_id?: string | null
          contribution_version_id?: string | null
          created_at?: string
          credit_name: string
          kind: Database["public"]["Enums"]["revision_attribution_kind"]
          revision_id: string
          user_id: string
        }
        Update: {
          contribution_id?: string | null
          contribution_version_id?: string | null
          created_at?: string
          credit_name?: string
          kind?: Database["public"]["Enums"]["revision_attribution_kind"]
          revision_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revision_attributions_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_attributions_contribution_version_id_fkey"
            columns: ["contribution_version_id"]
            isOneToOne: false
            referencedRelation: "contribution_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_attributions_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "project_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_attributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_attributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      revision_clips: {
        Row: {
          clip_id: string
          duration_ms: number | null
          duration_ticks: number | null
          kind: string
          loop: boolean | null
          midi_stem_version_id: string | null
          position_ms: number | null
          revision_id: string
          source_start_tick: number | null
          start_tick: number | null
          track_id: string
          trim_start_ms: number | null
        }
        Insert: {
          clip_id: string
          duration_ms?: number | null
          duration_ticks?: number | null
          kind: string
          loop?: boolean | null
          midi_stem_version_id?: string | null
          position_ms?: number | null
          revision_id: string
          source_start_tick?: number | null
          start_tick?: number | null
          track_id: string
          trim_start_ms?: number | null
        }
        Update: {
          clip_id?: string
          duration_ms?: number | null
          duration_ticks?: number | null
          kind?: string
          loop?: boolean | null
          midi_stem_version_id?: string | null
          position_ms?: number | null
          revision_id?: string
          source_start_tick?: number | null
          start_tick?: number | null
          track_id?: string
          trim_start_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "revision_clips_midi_stem_version_id_fkey"
            columns: ["midi_stem_version_id"]
            isOneToOne: false
            referencedRelation: "midi_stem_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_clips_revision_id_track_id_fkey"
            columns: ["revision_id", "track_id"]
            isOneToOne: false
            referencedRelation: "revision_tracks"
            referencedColumns: ["revision_id", "id"]
          },
        ]
      }
      revision_midi_track_credits: {
        Row: {
          created_at: string
          creator_credit_name: string
          creator_id: string
          credit_role: string
          credited_stem_version_id: string
          midi_stem_version_id: string
          revision_id: string
          track_id: string
        }
        Insert: {
          created_at?: string
          creator_credit_name: string
          creator_id: string
          credit_role: string
          credited_stem_version_id: string
          midi_stem_version_id: string
          revision_id: string
          track_id: string
        }
        Update: {
          created_at?: string
          creator_credit_name?: string
          creator_id?: string
          credit_role?: string
          credited_stem_version_id?: string
          midi_stem_version_id?: string
          revision_id?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revision_midi_track_credits_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_midi_track_credits_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_midi_track_credits_credited_stem_version_id_fkey"
            columns: ["credited_stem_version_id"]
            isOneToOne: false
            referencedRelation: "midi_stem_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_midi_track_credits_midi_stem_version_id_fkey"
            columns: ["midi_stem_version_id"]
            isOneToOne: false
            referencedRelation: "midi_stem_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_midi_track_credits_revision_id_track_id_fkey"
            columns: ["revision_id", "track_id"]
            isOneToOne: false
            referencedRelation: "revision_tracks"
            referencedColumns: ["revision_id", "id"]
          },
        ]
      }
      revision_track_credits: {
        Row: {
          asset_id: string
          created_at: string
          credit_name: string
          position: number
          revision_id: string
          role: Database["public"]["Enums"]["asset_credit_role"]
          source_credit_position: number
          track_id: string
          user_id: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          credit_name: string
          position: number
          revision_id: string
          role: Database["public"]["Enums"]["asset_credit_role"]
          source_credit_position: number
          track_id: string
          user_id?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          credit_name?: string
          position?: number
          revision_id?: string
          role?: Database["public"]["Enums"]["asset_credit_role"]
          source_credit_position?: number
          track_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revision_track_credits_asset_id_source_credit_position_fkey"
            columns: ["asset_id", "source_credit_position"]
            isOneToOne: false
            referencedRelation: "asset_credits"
            referencedColumns: ["asset_id", "position"]
          },
          {
            foreignKeyName: "revision_track_credits_revision_id_track_id_asset_id_fkey"
            columns: ["revision_id", "track_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "revision_tracks"
            referencedColumns: ["revision_id", "id", "asset_id"]
          },
          {
            foreignKeyName: "revision_track_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_track_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      revision_tracks: {
        Row: {
          added_by: string
          asset_id: string | null
          duration_ms: number
          gain_db: number
          id: string
          instrument_id: string | null
          kind: string
          muted: boolean
          name: string
          pan: number
          position_ms: number
          preset_id: string | null
          preset_version: number | null
          revision_id: string
          soloed: boolean
          sort_order: number
          trim_start_ms: number
        }
        Insert: {
          added_by: string
          asset_id?: string | null
          duration_ms: number
          gain_db: number
          id: string
          instrument_id?: string | null
          kind?: string
          muted: boolean
          name: string
          pan: number
          position_ms: number
          preset_id?: string | null
          preset_version?: number | null
          revision_id: string
          soloed: boolean
          sort_order: number
          trim_start_ms: number
        }
        Update: {
          added_by?: string
          asset_id?: string | null
          duration_ms?: number
          gain_db?: number
          id?: string
          instrument_id?: string | null
          kind?: string
          muted?: boolean
          name?: string
          pan?: number
          position_ms?: number
          preset_id?: string | null
          preset_version?: number | null
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
      waveform_peak_derivatives: {
        Row: {
          algorithm_version: string | null
          bin_count: number | null
          bucket: string
          byte_size: number | null
          channels: number | null
          content_type: string
          created_at: string
          duration_ms: number | null
          expected_byte_size: number
          expires_at: string
          failed_at: string | null
          format_version: number | null
          id: string
          object_path: string
          owner_id: string
          ready_at: string | null
          request_id: string
          sample_rate_hz: number | null
          sha256: string | null
          source_asset_id: string
          status: string
        }
        Insert: {
          algorithm_version?: string | null
          bin_count?: number | null
          bucket?: string
          byte_size?: number | null
          channels?: number | null
          content_type?: string
          created_at?: string
          duration_ms?: number | null
          expected_byte_size: number
          expires_at: string
          failed_at?: string | null
          format_version?: number | null
          id: string
          object_path: string
          owner_id: string
          ready_at?: string | null
          request_id: string
          sample_rate_hz?: number | null
          sha256?: string | null
          source_asset_id: string
          status?: string
        }
        Update: {
          algorithm_version?: string | null
          bin_count?: number | null
          bucket?: string
          byte_size?: number | null
          channels?: number | null
          content_type?: string
          created_at?: string
          duration_ms?: number | null
          expected_byte_size?: number
          expires_at?: string
          failed_at?: string | null
          format_version?: number | null
          id?: string
          object_path?: string
          owner_id?: string
          ready_at?: string | null
          request_id?: string
          sample_rate_hz?: number | null
          sha256?: string | null
          source_asset_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "waveform_peak_derivatives_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waveform_peak_derivatives_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waveform_peak_derivatives_source_owner_fk"
            columns: ["source_asset_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      workspace_clips: {
        Row: {
          clip_id: string
          duration_ms: number | null
          duration_ticks: number | null
          kind: string
          loop: boolean | null
          midi_stem_version_id: string | null
          position_ms: number | null
          source_start_tick: number | null
          start_tick: number | null
          track_id: string
          trim_start_ms: number | null
          workspace_id: string
        }
        Insert: {
          clip_id: string
          duration_ms?: number | null
          duration_ticks?: number | null
          kind: string
          loop?: boolean | null
          midi_stem_version_id?: string | null
          position_ms?: number | null
          source_start_tick?: number | null
          start_tick?: number | null
          track_id: string
          trim_start_ms?: number | null
          workspace_id: string
        }
        Update: {
          clip_id?: string
          duration_ms?: number | null
          duration_ticks?: number | null
          kind?: string
          loop?: boolean | null
          midi_stem_version_id?: string | null
          position_ms?: number | null
          source_start_tick?: number | null
          start_tick?: number | null
          track_id?: string
          trim_start_ms?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_clips_midi_stem_version_id_fkey"
            columns: ["midi_stem_version_id"]
            isOneToOne: false
            referencedRelation: "midi_stem_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_clips_workspace_id_track_id_fkey"
            columns: ["workspace_id", "track_id"]
            isOneToOne: false
            referencedRelation: "workspace_tracks"
            referencedColumns: ["workspace_id", "track_id"]
          },
        ]
      }
      workspace_tracks: {
        Row: {
          asset_id: string | null
          duration_ms: number
          gain_db: number
          instrument_id: string | null
          kind: string
          muted: boolean
          name: string
          pan: number
          position_ms: number
          preset_id: string | null
          preset_version: number | null
          soloed: boolean
          sort_order: number
          track_id: string
          trim_start_ms: number
          workspace_id: string
        }
        Insert: {
          asset_id?: string | null
          duration_ms: number
          gain_db: number
          instrument_id?: string | null
          kind?: string
          muted: boolean
          name: string
          pan: number
          position_ms: number
          preset_id?: string | null
          preset_version?: number | null
          soloed: boolean
          sort_order: number
          track_id: string
          trim_start_ms: number
          workspace_id: string
        }
        Update: {
          asset_id?: string | null
          duration_ms?: number
          gain_db?: number
          instrument_id?: string | null
          kind?: string
          muted?: boolean
          name?: string
          pan?: number
          position_ms?: number
          preset_id?: string | null
          preset_version?: number | null
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
          contribution_id: string | null
          create_request_id: string
          created_at: string
          engine: string
          engine_version: string
          id: string
          last_manifest_expected_lock_version: number | null
          last_manifest_request_id: string | null
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
          contribution_id?: string | null
          create_request_id: string
          created_at?: string
          engine: string
          engine_version: string
          id?: string
          last_manifest_expected_lock_version?: number | null
          last_manifest_request_id?: string | null
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
          contribution_id?: string | null
          create_request_id?: string
          created_at?: string
          engine?: string
          engine_version?: string
          id?: string
          last_manifest_expected_lock_version?: number | null
          last_manifest_request_id?: string | null
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
            foreignKeyName: "workspaces_contribution_identity_fk"
            columns: [
              "contribution_id",
              "project_id",
              "owner_id",
              "base_revision_id",
            ]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: [
              "id",
              "project_id",
              "author_id",
              "base_revision_id",
            ]
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
          avatar_path: string | null
          avatar_version_id: string | null
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
          avatar_path?: string | null
          avatar_version_id?: string | null
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
          avatar_path?: string | null
          avatar_version_id?: string | null
          bio?: string | null
          created_at?: string | null
          credit_name?: string | null
          display_name?: string | null
          id?: string | null
          updated_at?: string | null
          username?: string | null
          username_normalized?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_avatar_version_fk"
            columns: ["avatar_version_id"]
            isOneToOne: false
            referencedRelation: "profile_avatar_versions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_signup_invitation: { Args: { p_email: string }; Returns: Json }
      apply_moderation_action: {
        Args: {
          p_action: string
          p_expected_report_status: string
          p_expected_target_version: number
          p_reason: string
          p_report_id: string
          p_request_id: string
        }
        Returns: Json
      }
      assert_viewer_admin: { Args: never; Returns: boolean }
      cancel_source_upload: {
        Args: { p_asset_id: string }
        Returns: Database["public"]["Enums"]["asset_status"]
      }
      cancel_waveform_peaks: {
        Args: { p_derivative_id: string }
        Returns: string
      }
      claim_username: {
        Args: { p_username: string }
        Returns: {
          username: string
          username_normalized: string
        }[]
      }
      complete_profile_image_upload: {
        Args: { p_asset_id: string }
        Returns: string
      }
      complete_source_upload: {
        Args: { p_asset_id: string }
        Returns: Database["public"]["Enums"]["asset_status"]
      }
      confirm_source_asset_credits: {
        Args: { p_asset_id: string; p_credits: Json; p_request_id: string }
        Returns: {
          asset_id: string
          credits_confirmed_at: string
        }[]
      }
      create_contribution_workspace: {
        Args: {
          p_description: string
          p_expected_current_revision_id: string
          p_project_id: string
          p_request_id: string
          p_title: string
        }
        Returns: {
          base_revision_id: string
          contribution_id: string
          created_at: string
          lock_version: number
          workspace_id: string
        }[]
      }
      create_imported_midi_stem_draft: {
        Args: {
          p_content: Json
          p_request_id: string
          p_save_request_id: string
        }
        Returns: {
          content_sha256: string
          created_at: string
          draft_id: string
          lock_version: number
          stem_id: string
          updated_at: string
        }[]
      }
      create_midi_project_workspace: {
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
          lock_version: number
          project_id: string
          title: string
          workspace_id: string
        }[]
      }
      create_midi_stem_draft: {
        Args: {
          p_default_preset_id?: string
          p_default_preset_version?: number
          p_entry_mode?: string
          p_name: string
          p_parent_stem_version_id?: string
          p_request_id: string
        }
        Returns: {
          created_at: string
          draft_id: string
          lock_version: number
          stem_id: string
        }[]
      }
      create_midi_stem_draft_owner_v1: {
        Args: {
          p_default_preset_id?: string
          p_default_preset_version?: number
          p_entry_mode?: string
          p_name: string
          p_parent_stem_version_id?: string
          p_request_id: string
        }
        Returns: {
          created_at: string
          draft_id: string
          lock_version: number
          stem_id: string
        }[]
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
      delete_own_contribution: {
        Args: { p_contribution_id: string; p_request_id: string }
        Returns: Json
      }
      delete_project: {
        Args: {
          p_expected_lock_version: number
          p_project_id: string
          p_request_id: string
        }
        Returns: {
          deleted_at: string
          lock_version: number
          project_id: string
        }[]
      }
      finalize_studio_midi_draft: {
        Args: {
          p_clip_id: string
          p_draft_id: string
          p_expected_content_sha256: string
          p_expected_draft_lock_version: number
          p_expected_workspace_lock_version: number
          p_operation: string
          p_request_id: string
          p_start_tick?: number
          p_track_id: string
          p_workspace_id: string
        }
        Returns: {
          creator_credit_name: string
          stem_id: string
          stem_version_id: string
          version: number
          version_created_at: string
          workspace_lock_version: number
          workspace_manifest: Json
          workspace_manifest_sha256: string
          workspace_updated_at: string
        }[]
      }
      finalize_waveform_peaks: {
        Args: {
          p_algorithm_version: string
          p_bin_count: number
          p_byte_size: number
          p_channels: number
          p_derivative_id: string
          p_duration_ms: number
          p_format_version: number
          p_sample_rate_hz: number
          p_sha256: string
        }
        Returns: string
      }
      fork_project: {
        Args: {
          p_description: string
          p_expected_license_code: string
          p_request_id: string
          p_source_project_id: string
          p_source_revision_id: string
          p_title: string
        }
        Returns: {
          created_at: string
          project_id: string
          revision_id: string
          revision_number: number
        }[]
      }
      fork_project_v1: {
        Args: {
          p_description: string
          p_expected_license_code: string
          p_request_id: string
          p_source_project_id: string
          p_source_revision_id: string
          p_title: string
        }
        Returns: {
          created_at: string
          project_id: string
          revision_id: string
          revision_number: number
        }[]
      }
      get_admin_moderation_target: {
        Args: { p_report_id: string }
        Returns: Json
      }
      get_admin_storage_summary: { Args: never; Returns: Json }
      get_contribution_project_context: {
        Args: { p_contribution_id: string }
        Returns: Json
      }
      get_own_account_recovery: { Args: never; Returns: Json }
      get_project_revision_preview: {
        Args: { p_project_id: string; p_revision_id: string }
        Returns: Json
      }
      get_public_profile_history: {
        Args: { p_profile_id: string }
        Returns: Json
      }
      get_public_project_lineage: {
        Args: { p_project_id: string }
        Returns: Json
      }
      get_source_admission_capability: {
        Args: never
        Returns: {
          source_audio_admission_enabled: boolean
        }[]
      }
      get_source_verification_status: {
        Args: { p_asset_id: string }
        Returns: {
          asset_status: Database["public"]["Enums"]["asset_status"]
          attempt_count: number
          byte_size: number
          channels: number
          duration_ms: number
          failure_code: string
          media_type: string
          next_attempt_at: string
          sample_rate_hz: number
          verification_state: string
        }[]
      }
      get_viewer_dashboard: { Args: never; Returns: Json }
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
      list_admin_moderation_queue: {
        Args: { p_after_created_at?: string; p_after_id?: string }
        Returns: Json
      }
      list_admin_rejectable_uploads: { Args: never; Returns: Json }
      list_public_profile_contributions: {
        Args: {
          p_after_accepted_at?: string
          p_after_revision_id?: string
          p_discovery_version: number
          p_profile_id: string
        }
        Returns: Json
      }
      list_public_profile_projects: {
        Args: {
          p_after_project_id?: string
          p_after_published_at?: string
          p_discovery_version: number
          p_profile_id: string
        }
        Returns: Json
      }
      list_viewer_contributions: {
        Args: {
          p_after_id?: string
          p_after_updated_at?: string
          p_status?: string
        }
        Returns: Json
      }
      list_viewer_projects: {
        Args: {
          p_after_id?: string
          p_after_updated_at?: string
          p_review?: boolean
          p_scope?: string
        }
        Returns: Json
      }
      list_viewer_reports: {
        Args: { p_after_created_at?: string; p_after_id?: string }
        Returns: Json
      }
      operator_claim_profile_avatar_cleanup: {
        Args: never
        Returns: {
          attempt_count: number
          avatar_version_id: string
          lease_token: string
          private_object_path: string
          profile_id: string
          public_object_path: string
          source_asset_id: string
        }[]
      }
      operator_claim_profile_image: {
        Args: { p_asset_id?: string; p_owner_id?: string }
        Returns: {
          asset_id: string
          attempt_count: number
          avatar_version_id: string
          bucket: string
          declared_media_type: string
          lease_token: string
          object_path: string
          owner_id: string
          public_object_path: string
          reserved_byte_size: number
        }[]
      }
      operator_claim_retention_job: {
        Args: { p_run_id: string }
        Returns: Json
      }
      operator_claim_source_verification: {
        Args: { p_asset_id?: string; p_owner_id?: string }
        Returns: {
          asset_id: string
          attempt_count: number
          bucket: string
          lease_token: string
          object_path: string
          original_filename: string
          owner_id: string
          reserved_byte_size: number
        }[]
      }
      operator_complete_profile_avatar_cleanup: {
        Args: { p_avatar_version_id: string; p_lease_token: string }
        Returns: undefined
      }
      operator_complete_profile_image: {
        Args: {
          p_asset_id: string
          p_byte_size: number
          p_frame_count: number
          p_height: number
          p_lease_token: string
          p_media_type: string
          p_output_byte_size: number
          p_output_sha256: string
          p_sha256: string
          p_width: number
        }
        Returns: string
      }
      operator_complete_retention_run: {
        Args: { p_run_id: string }
        Returns: Json
      }
      operator_complete_source_verification: {
        Args: {
          p_asset_id: string
          p_byte_size: number
          p_channels: number
          p_duration_ms: number
          p_lease_token: string
          p_media_type: string
          p_sample_rate_hz: number
          p_sha256: string
          p_verification_version: string
        }
        Returns: undefined
      }
      operator_count_due_profile_avatar_cleanup: {
        Args: never
        Returns: number
      }
      operator_fail_source_asset: {
        Args: { p_asset_id: string; p_failure_code: string }
        Returns: undefined
      }
      operator_fail_source_verification: {
        Args: {
          p_asset_id: string
          p_failure_code: string
          p_lease_token: string
        }
        Returns: undefined
      }
      operator_finalize_retention_job: {
        Args: {
          p_deleted_object_ids: string[]
          p_job_id: string
          p_lease_token: string
          p_missing_object_ids: string[]
        }
        Returns: string
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
      operator_retention_preview: { Args: { p_limit?: number }; Returns: Json }
      operator_retry_profile_avatar_cleanup: {
        Args: {
          p_avatar_version_id: string
          p_error_code: string
          p_lease_token: string
        }
        Returns: string
      }
      operator_retry_profile_image: {
        Args: {
          p_asset_id: string
          p_error_code: string
          p_lease_token: string
        }
        Returns: string
      }
      operator_retry_retention_job: {
        Args: { p_error_code: string; p_job_id: string; p_lease_token: string }
        Returns: string
      }
      operator_retry_source_verification: {
        Args: {
          p_asset_id: string
          p_error_code: string
          p_lease_token: string
        }
        Returns: string
      }
      operator_set_source_admission_enabled: {
        Args: { p_enabled: boolean }
        Returns: boolean
      }
      operator_start_retention_run: {
        Args: { p_limit?: number }
        Returns: string
      }
      place_content_hold: {
        Args: {
          p_expires_at?: string
          p_hold_type: string
          p_reason: string
          p_request_id: string
          p_target_id: string
          p_target_kind: string
        }
        Returns: string
      }
      publish_midi_stem_version: {
        Args: {
          p_draft_id: string
          p_expected_content_sha256: string
          p_expected_lock_version: number
          p_request_id: string
        }
        Returns: {
          content_sha256: string
          created_at: string
          creator_credit_name: string
          stem_id: string
          stem_version_id: string
          version: number
        }[]
      }
      publish_midi_workspace_revision: {
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
      reject_admin_upload: {
        Args: {
          p_asset_id: string
          p_expected_status: string
          p_reason: string
          p_request_id: string
        }
        Returns: Json
      }
      release_content_hold: {
        Args: { p_hold_id: string; p_reason: string; p_request_id: string }
        Returns: string
      }
      remove_own_avatar: {
        Args: { p_expected_avatar_version_id: string }
        Returns: undefined
      }
      request_account_deletion: {
        Args: { p_request_id: string; p_username: string }
        Returns: Json
      }
      reserve_profile_image_upload: {
        Args: {
          p_declared_media_type: string
          p_expected_byte_size: number
          p_filename: string
          p_request_id: string
        }
        Returns: {
          asset_id: string
          avatar_version_id: string
          bucket: string
          expires_at: string
          object_path: string
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
      reserve_waveform_peaks: {
        Args: {
          p_expected_byte_size: number
          p_request_id: string
          p_source_asset_id: string
        }
        Returns: {
          bucket: string
          content_type: string
          derivative_id: string
          expires_at: string
          object_path: string
          source_asset_id: string
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
      restore_own_account: { Args: never; Returns: Json }
      restore_own_contribution: {
        Args: { p_contribution_id: string }
        Returns: Json
      }
      restore_project: {
        Args: { p_project_id: string; p_request_id: string }
        Returns: {
          lock_version: number
          project_id: string
          status: string
        }[]
      }
      retry_source_verification: {
        Args: { p_asset_id: string }
        Returns: string
      }
      review_contribution: {
        Args: {
          p_contribution_id: string
          p_decision: Database["public"]["Enums"]["contribution_review_decision"]
          p_expected_current_version_id: string
          p_expected_project_revision_id: string
          p_expected_status: Database["public"]["Enums"]["contribution_status"]
          p_note?: string
          p_request_id: string
        }
        Returns: {
          applied_decision: Database["public"]["Enums"]["contribution_review_decision"]
          contribution_id: string
          contribution_version_id: string
          reason: Database["public"]["Enums"]["contribution_review_reason"]
          requested_decision: Database["public"]["Enums"]["contribution_review_decision"]
          reviewed_at: string
          revision_id: string
          revision_number: number
          status: Database["public"]["Enums"]["contribution_status"]
        }[]
      }
      review_contribution_v1: {
        Args: {
          p_contribution_id: string
          p_decision: Database["public"]["Enums"]["contribution_review_decision"]
          p_expected_current_version_id: string
          p_expected_project_revision_id: string
          p_expected_status: Database["public"]["Enums"]["contribution_status"]
          p_note?: string
          p_request_id: string
        }
        Returns: {
          applied_decision: Database["public"]["Enums"]["contribution_review_decision"]
          contribution_id: string
          contribution_version_id: string
          reason: Database["public"]["Enums"]["contribution_review_reason"]
          requested_decision: Database["public"]["Enums"]["contribution_review_decision"]
          reviewed_at: string
          revision_id: string
          revision_number: number
          status: Database["public"]["Enums"]["contribution_status"]
        }[]
      }
      revision_manifest_checksum_valid: {
        Args: { p_project_id: string; p_revision_id: string }
        Returns: boolean
      }
      save_midi_stem_draft: {
        Args: {
          p_content: Json
          p_draft_id: string
          p_expected_lock_version: number
          p_request_id: string
        }
        Returns: {
          content_sha256: string
          draft_id: string
          lock_version: number
          updated_at: string
        }[]
      }
      save_midi_workspace: {
        Args: {
          p_expected_lock_version: number
          p_manifest: Json
          p_request_id: string
          p_workspace_id: string
        }
        Returns: {
          lock_version: number
          manifest_sha256: string
          updated_at: string
          workspace_id: string
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
      search_public_projects: {
        Args: {
          p_after_project_id?: string
          p_after_published_at?: string
          p_after_score?: number
          p_bpm_max?: number
          p_bpm_min?: number
          p_genres?: string[]
          p_instruments?: string[]
          p_keys?: string[]
          p_limit?: number
          p_open?: boolean
          p_query?: string
          p_sort?: string
          p_tags?: string[]
        }
        Returns: {
          attributions: Json
          bpm: number
          current_revision_id: string
          description: string
          discovery_version: number
          duration_ms: number
          genres: Json
          license_allows_derivatives: boolean
          license_code: string
          license_name: string
          license_summary: string
          musical_key: string
          open_to_contributions: boolean
          owner_id: string
          project_id: string
          published_at: string
          revision_number: number
          tags: Json
          title: string
          tracks: Json
          trending_score: number
          updated_at: string
        }[]
      }
      set_project_contributions_open: {
        Args: {
          p_expected_lock_version: number
          p_open: boolean
          p_project_id: string
        }
        Returns: {
          lock_version: number
          open_to_contributions: boolean
          project_id: string
          updated_at: string
        }[]
      }
      set_project_visibility: {
        Args: {
          p_expected_lock_version: number
          p_project_id: string
          p_visibility: Database["public"]["Enums"]["project_visibility"]
        }
        Returns: {
          lock_version: number
          project_id: string
          updated_at: string
          visibility: Database["public"]["Enums"]["project_visibility"]
        }[]
      }
      submit_contribution: {
        Args: {
          p_attestation_version: string
          p_contribution_id: string
          p_expected_base_revision_id: string
          p_expected_manifest_sha256: string
          p_expected_workspace_lock_version: number
          p_request_id: string
        }
        Returns: {
          contribution_id: string
          created_at: string
          status: Database["public"]["Enums"]["contribution_status"]
          version_id: string
          version_number: number
        }[]
      }
      submit_moderation_report: {
        Args: {
          p_detail?: string
          p_reason: string
          p_request_id: string
          p_target_id: string
          p_target_kind: string
        }
        Returns: {
          created_at: string
          report_id: string
          status: string
        }[]
      }
      touch_viewer_activity: {
        Args: never
        Returns: {
          last_active_at: string
          touched: boolean
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
      withdraw_contribution: {
        Args: {
          p_contribution_id: string
          p_expected_current_version_id: string
          p_expected_status: Database["public"]["Enums"]["contribution_status"]
        }
        Returns: {
          contribution_id: string
          current_version_id: string
          status: Database["public"]["Enums"]["contribution_status"]
          withdrawn_at: string
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
      contribution_review_decision: "request_changes" | "reject" | "accept"
      contribution_review_reason: "owner_feedback" | "base_outdated"
      contribution_status:
        | "draft"
        | "submitted"
        | "changes_requested"
        | "accepted"
        | "rejected"
        | "withdrawn"
      member_role: "owner" | "editor" | "viewer"
      profile_avatar_status:
        | "processing"
        | "current"
        | "superseded"
        | "removed"
        | "failed"
        | "cleaned"
      project_status: "draft" | "active" | "archived" | "deleted"
      project_visibility: "private" | "unlisted" | "public"
      revision_attribution_kind: "publisher" | "accepted_contributor"
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
      contribution_review_decision: ["request_changes", "reject", "accept"],
      contribution_review_reason: ["owner_feedback", "base_outdated"],
      contribution_status: [
        "draft",
        "submitted",
        "changes_requested",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      member_role: ["owner", "editor", "viewer"],
      profile_avatar_status: [
        "processing",
        "current",
        "superseded",
        "removed",
        "failed",
        "cleaned",
      ],
      project_status: ["draft", "active", "archived", "deleted"],
      project_visibility: ["private", "unlisted", "public"],
      revision_attribution_kind: ["publisher", "accepted_contributor"],
    },
  },
} as const

