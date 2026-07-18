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
      arrangement_clips: {
        Row: {
          arrangement_version_id: string
          clip_id: string
          duration_ticks: number
          loop: boolean
          midi_pattern_version_id: string
          project_id: string
          source_start_tick: number
          start_tick: number
          track_id: string
        }
        Insert: {
          arrangement_version_id: string
          clip_id: string
          duration_ticks: number
          loop: boolean
          midi_pattern_version_id: string
          project_id: string
          source_start_tick: number
          start_tick: number
          track_id: string
        }
        Update: {
          arrangement_version_id?: string
          clip_id?: string
          duration_ticks?: number
          loop?: boolean
          midi_pattern_version_id?: string
          project_id?: string
          source_start_tick?: number
          start_tick?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arrangement_clips_midi_pattern_version_id_fkey"
            columns: ["midi_pattern_version_id"]
            isOneToOne: false
            referencedRelation: "midi_pattern_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrangement_clips_project_id_arrangement_version_id_track__fkey"
            columns: ["project_id", "arrangement_version_id", "track_id"]
            isOneToOne: false
            referencedRelation: "arrangement_tracks"
            referencedColumns: [
              "project_id",
              "arrangement_version_id",
              "track_id",
            ]
          },
        ]
      }
      arrangement_tracks: {
        Row: {
          arrangement_version_id: string
          gain_db: number
          muted: boolean
          name: string
          pan: number
          preset_id: string
          preset_version: number
          project_id: string
          soloed: boolean
          sort_order: number
          track_id: string
        }
        Insert: {
          arrangement_version_id: string
          gain_db: number
          muted: boolean
          name: string
          pan: number
          preset_id: string
          preset_version: number
          project_id: string
          soloed: boolean
          sort_order: number
          track_id: string
        }
        Update: {
          arrangement_version_id?: string
          gain_db?: number
          muted?: boolean
          name?: string
          pan?: number
          preset_id?: string
          preset_version?: number
          project_id?: string
          soloed?: boolean
          sort_order?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arrangement_tracks_project_id_arrangement_version_id_fkey"
            columns: ["project_id", "arrangement_version_id"]
            isOneToOne: false
            referencedRelation: "arrangement_versions"
            referencedColumns: ["project_id", "id"]
          },
        ]
      }
      arrangement_versions: {
        Row: {
          create_request_id: string
          created_at: string
          created_by: string
          duration_ticks: number
          engine: string
          engine_version: string
          id: string
          manifest: Json
          manifest_sha256: string
          manifest_version: number
          musical_key: string | null
          ppq: number
          project_id: string
          tempo_bpm: number
          time_signature_denominator: number
          time_signature_numerator: number
        }
        Insert: {
          create_request_id: string
          created_at?: string
          created_by: string
          duration_ticks: number
          engine: string
          engine_version: string
          id?: string
          manifest: Json
          manifest_sha256: string
          manifest_version: number
          musical_key?: string | null
          ppq: number
          project_id: string
          tempo_bpm: number
          time_signature_denominator: number
          time_signature_numerator: number
        }
        Update: {
          create_request_id?: string
          created_at?: string
          created_by?: string
          duration_ticks?: number
          engine?: string
          engine_version?: string
          id?: string
          manifest?: Json
          manifest_sha256?: string
          manifest_version?: number
          musical_key?: string | null
          ppq?: number
          project_id?: string
          tempo_bpm?: number
          time_signature_denominator?: number
          time_signature_numerator?: number
        }
        Relationships: [
          {
            foreignKeyName: "arrangement_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrangement_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrangement_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          bucket: string
          byte_size: number | null
          created_at: string
          declared_media_type: string | null
          deleted_at: string | null
          failed_at: string | null
          failure_code: string | null
          frame_count: number | null
          id: string
          image_height: number | null
          image_width: number | null
          media_type: string | null
          object_path: string
          original_filename: string
          owner_id: string
          ready_at: string | null
          reserved_byte_size: number
          sha256: string | null
          status: Database["public"]["Enums"]["asset_status"]
          upload_completed_at: string | null
          verification_version: string | null
        }
        Insert: {
          bucket?: string
          byte_size?: number | null
          created_at?: string
          declared_media_type?: string | null
          deleted_at?: string | null
          failed_at?: string | null
          failure_code?: string | null
          frame_count?: number | null
          id?: string
          image_height?: number | null
          image_width?: number | null
          media_type?: string | null
          object_path: string
          original_filename: string
          owner_id: string
          ready_at?: string | null
          reserved_byte_size: number
          sha256?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          upload_completed_at?: string | null
          verification_version?: string | null
        }
        Update: {
          bucket?: string
          byte_size?: number | null
          created_at?: string
          declared_media_type?: string | null
          deleted_at?: string | null
          failed_at?: string | null
          failure_code?: string | null
          frame_count?: number | null
          id?: string
          image_height?: number | null
          image_width?: number | null
          media_type?: string | null
          object_path?: string
          original_filename?: string
          owner_id?: string
          ready_at?: string | null
          reserved_byte_size?: number
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
      contribution_versions: {
        Row: {
          arrangement_version_id: string | null
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
          project_id: string
          submission_request_id: string
          version_number: number
          workspace_lock_version: number
        }
        Insert: {
          arrangement_version_id?: string | null
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
          project_id: string
          submission_request_id: string
          version_number: number
          workspace_lock_version: number
        }
        Update: {
          arrangement_version_id?: string | null
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
          project_id?: string
          submission_request_id?: string
          version_number?: number
          workspace_lock_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contribution_versions_arrangement_fk"
            columns: ["project_id", "arrangement_version_id"]
            isOneToOne: false
            referencedRelation: "arrangement_versions"
            referencedColumns: ["project_id", "id"]
          },
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
            foreignKeyName: "contribution_versions_contribution_project_fk"
            columns: ["project_id", "contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["project_id", "id"]
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
      midi_library_categories: {
        Row: {
          active: boolean
          code: string
          display_name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          display_name: string
          sort_order: number
        }
        Update: {
          active?: boolean
          code?: string
          display_name?: string
          sort_order?: number
        }
        Relationships: []
      }
      midi_library_listing_tags: {
        Row: {
          created_at: string
          listing_id: string
          tag_code: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          tag_code: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          tag_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "midi_library_listing_tags_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "midi_library_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_library_listing_tags_tag_code_fkey"
            columns: ["tag_code"]
            isOneToOne: false
            referencedRelation: "midi_library_tags"
            referencedColumns: ["code"]
          },
        ]
      }
      midi_library_listings: {
        Row: {
          attestation_version: string
          attested_at: string
          attested_by: string
          category_code: string
          creator_credit_name: string
          creator_display_name: string
          creator_username: string
          creator_version: number
          description: string
          duration_beats: number
          duration_ticks: number
          id: string
          instrument_family_code: string
          listed_at: string
          max_pitch: number | null
          midi_pattern_id: string
          midi_pattern_version_id: string
          min_pitch: number | null
          moderation_hidden_at: string | null
          moderation_version: number
          note_count: number
          owner_id: string
          polyphony_kind: string
          public_domain_rationale: string | null
          request_id: string
          request_payload_sha256: string
          reuse_mode: string
          rights_basis: string
          rights_payload_sha256: string
          search_vector: unknown
          suggested_preset_id: string
          suggested_preset_version: number
          supporting_source_terms: string | null
          supporting_source_url: string | null
          title: string
          unlist_request_id: string | null
          unlisted_at: string | null
          unlisted_by: string | null
        }
        Insert: {
          attestation_version: string
          attested_at?: string
          attested_by: string
          category_code: string
          creator_credit_name: string
          creator_display_name: string
          creator_username: string
          creator_version?: number
          description?: string
          duration_beats: number
          duration_ticks: number
          id?: string
          instrument_family_code: string
          listed_at?: string
          max_pitch?: number | null
          midi_pattern_id: string
          midi_pattern_version_id: string
          min_pitch?: number | null
          moderation_hidden_at?: string | null
          moderation_version?: number
          note_count: number
          owner_id: string
          polyphony_kind: string
          public_domain_rationale?: string | null
          request_id: string
          request_payload_sha256: string
          reuse_mode: string
          rights_basis: string
          rights_payload_sha256: string
          search_vector?: unknown
          suggested_preset_id: string
          suggested_preset_version: number
          supporting_source_terms?: string | null
          supporting_source_url?: string | null
          title: string
          unlist_request_id?: string | null
          unlisted_at?: string | null
          unlisted_by?: string | null
        }
        Update: {
          attestation_version?: string
          attested_at?: string
          attested_by?: string
          category_code?: string
          creator_credit_name?: string
          creator_display_name?: string
          creator_username?: string
          creator_version?: number
          description?: string
          duration_beats?: number
          duration_ticks?: number
          id?: string
          instrument_family_code?: string
          listed_at?: string
          max_pitch?: number | null
          midi_pattern_id?: string
          midi_pattern_version_id?: string
          min_pitch?: number | null
          moderation_hidden_at?: string | null
          moderation_version?: number
          note_count?: number
          owner_id?: string
          polyphony_kind?: string
          public_domain_rationale?: string | null
          request_id?: string
          request_payload_sha256?: string
          reuse_mode?: string
          rights_basis?: string
          rights_payload_sha256?: string
          search_vector?: unknown
          suggested_preset_id?: string
          suggested_preset_version?: number
          supporting_source_terms?: string | null
          supporting_source_url?: string | null
          title?: string
          unlist_request_id?: string | null
          unlisted_at?: string | null
          unlisted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "midi_library_listings_attested_by_fkey"
            columns: ["attested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_library_listings_attested_by_fkey"
            columns: ["attested_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_library_listings_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "midi_library_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "midi_library_listings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_library_listings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_library_listings_pattern_version_fk"
            columns: ["midi_pattern_version_id", "midi_pattern_id"]
            isOneToOne: false
            referencedRelation: "midi_pattern_versions"
            referencedColumns: ["id", "midi_pattern_id"]
          },
          {
            foreignKeyName: "midi_library_listings_preset_fk"
            columns: ["suggested_preset_id", "suggested_preset_version"]
            isOneToOne: false
            referencedRelation: "midi_library_presets"
            referencedColumns: ["preset_id", "version"]
          },
          {
            foreignKeyName: "midi_library_listings_unlisted_by_fkey"
            columns: ["unlisted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_library_listings_unlisted_by_fkey"
            columns: ["unlisted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      midi_library_presets: {
        Row: {
          active: boolean
          display_name: string
          family_code: string
          preset_id: string
          sort_order: number
          version: number
        }
        Insert: {
          active?: boolean
          display_name: string
          family_code: string
          preset_id: string
          sort_order: number
          version: number
        }
        Update: {
          active?: boolean
          display_name?: string
          family_code?: string
          preset_id?: string
          sort_order?: number
          version?: number
        }
        Relationships: []
      }
      midi_library_tags: {
        Row: {
          active: boolean
          code: string
          display_name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          display_name: string
          sort_order: number
        }
        Update: {
          active?: boolean
          code?: string
          display_name?: string
          sort_order?: number
        }
        Relationships: []
      }
      midi_pattern_external_credits: {
        Row: {
          attribution_note: string | null
          created_at: string
          credited_name: string
          id: string
          inherited_from_credit_id: string | null
          listing_id: string | null
          midi_pattern_version_id: string
          position: number
          role: string
          source_terms: string | null
          source_url: string | null
          work_title: string | null
        }
        Insert: {
          attribution_note?: string | null
          created_at?: string
          credited_name: string
          id?: string
          inherited_from_credit_id?: string | null
          listing_id?: string | null
          midi_pattern_version_id: string
          position: number
          role: string
          source_terms?: string | null
          source_url?: string | null
          work_title?: string | null
        }
        Update: {
          attribution_note?: string | null
          created_at?: string
          credited_name?: string
          id?: string
          inherited_from_credit_id?: string | null
          listing_id?: string | null
          midi_pattern_version_id?: string
          position?: number
          role?: string
          source_terms?: string | null
          source_url?: string | null
          work_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "midi_pattern_external_credits_inherited_from_credit_id_fkey"
            columns: ["inherited_from_credit_id"]
            isOneToOne: false
            referencedRelation: "midi_pattern_external_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_pattern_external_credits_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "midi_library_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_pattern_external_credits_midi_pattern_version_id_fkey"
            columns: ["midi_pattern_version_id"]
            isOneToOne: false
            referencedRelation: "midi_pattern_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      midi_pattern_notes: {
        Row: {
          duration_ticks: number
          midi_pattern_version_id: string
          note_id: string
          pitch: number
          start_tick: number
          velocity: number
        }
        Insert: {
          duration_ticks: number
          midi_pattern_version_id: string
          note_id: string
          pitch: number
          start_tick: number
          velocity: number
        }
        Update: {
          duration_ticks?: number
          midi_pattern_version_id?: string
          note_id?: string
          pitch?: number
          start_tick?: number
          velocity?: number
        }
        Relationships: [
          {
            foreignKeyName: "midi_pattern_notes_midi_pattern_version_id_fkey"
            columns: ["midi_pattern_version_id"]
            isOneToOne: false
            referencedRelation: "midi_pattern_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      midi_pattern_versions: {
        Row: {
          content_sha256: string
          create_request_id: string
          created_at: string
          creator_credit_name: string
          creator_id: string
          duration_ticks: number
          id: string
          midi_pattern_id: string
          note_count: number
          parent_pattern_version_id: string | null
          ppq: number
          reuse_license_code: string | null
          reuse_license_url: string | null
          reuse_license_version: string | null
          source_pattern_version_id: string | null
          version_number: number
        }
        Insert: {
          content_sha256: string
          create_request_id: string
          created_at?: string
          creator_credit_name: string
          creator_id: string
          duration_ticks: number
          id?: string
          midi_pattern_id: string
          note_count: number
          parent_pattern_version_id?: string | null
          ppq: number
          reuse_license_code?: string | null
          reuse_license_url?: string | null
          reuse_license_version?: string | null
          source_pattern_version_id?: string | null
          version_number: number
        }
        Update: {
          content_sha256?: string
          create_request_id?: string
          created_at?: string
          creator_credit_name?: string
          creator_id?: string
          duration_ticks?: number
          id?: string
          midi_pattern_id?: string
          note_count?: number
          parent_pattern_version_id?: string | null
          ppq?: number
          reuse_license_code?: string | null
          reuse_license_url?: string | null
          reuse_license_version?: string | null
          source_pattern_version_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "midi_pattern_versions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_pattern_versions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_pattern_versions_midi_pattern_id_fkey"
            columns: ["midi_pattern_id"]
            isOneToOne: false
            referencedRelation: "midi_patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_pattern_versions_midi_pattern_id_parent_pattern_versi_fkey"
            columns: ["midi_pattern_id", "parent_pattern_version_id"]
            isOneToOne: false
            referencedRelation: "midi_pattern_versions"
            referencedColumns: ["midi_pattern_id", "id"]
          },
          {
            foreignKeyName: "midi_pattern_versions_source_pattern_version_id_fkey"
            columns: ["source_pattern_version_id"]
            isOneToOne: false
            referencedRelation: "midi_pattern_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      midi_patterns: {
        Row: {
          create_request_id: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          owner_id: string
          published_at: string | null
          rights_attestation_version: string | null
          source_pattern_id: string | null
          source_pattern_version_id: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          create_request_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          owner_id: string
          published_at?: string | null
          rights_attestation_version?: string | null
          source_pattern_id?: string | null
          source_pattern_version_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          create_request_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          owner_id?: string
          published_at?: string | null
          rights_attestation_version?: string | null
          source_pattern_id?: string | null
          source_pattern_version_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "midi_patterns_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_patterns_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_patterns_source_pattern_id_fkey"
            columns: ["source_pattern_id"]
            isOneToOne: false
            referencedRelation: "midi_patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midi_patterns_source_version_fk"
            columns: ["source_pattern_id", "source_pattern_version_id"]
            isOneToOne: false
            referencedRelation: "midi_pattern_versions"
            referencedColumns: ["midi_pattern_id", "id"]
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
          arrangement_version_id: string | null
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
        }
        Insert: {
          accepted_contribution_id?: string | null
          accepted_contribution_version_id?: string | null
          arrangement_version_id?: string | null
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
        }
        Update: {
          accepted_contribution_id?: string | null
          accepted_contribution_version_id?: string | null
          arrangement_version_id?: string | null
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
            foreignKeyName: "project_revisions_arrangement_fk"
            columns: ["project_id", "arrangement_version_id"]
            isOneToOne: false
            referencedRelation: "arrangement_versions"
            referencedColumns: ["project_id", "id"]
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
          rights_attestation_version: string | null
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
          rights_attestation_version?: string | null
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
          rights_attestation_version?: string | null
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
      saved_midi_patterns: {
        Row: {
          created_at: string
          midi_pattern_version_id: string
          save_request_id: string
          source_listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          midi_pattern_version_id: string
          save_request_id: string
          source_listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          midi_pattern_version_id?: string
          save_request_id?: string
          source_listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_midi_patterns_midi_pattern_version_id_fkey"
            columns: ["midi_pattern_version_id"]
            isOneToOne: false
            referencedRelation: "midi_pattern_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_midi_patterns_source_listing_id_fkey"
            columns: ["source_listing_id"]
            isOneToOne: false
            referencedRelation: "midi_library_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_midi_patterns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_midi_patterns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
      workspace_clips: {
        Row: {
          clip_id: string
          duration_ticks: number | null
          loop: boolean | null
          midi_pattern_version_id: string | null
          source_start_tick: number | null
          start_tick: number | null
          track_id: string
          workspace_id: string
        }
        Insert: {
          clip_id: string
          duration_ticks?: number | null
          loop?: boolean | null
          midi_pattern_version_id?: string | null
          source_start_tick?: number | null
          start_tick?: number | null
          track_id: string
          workspace_id: string
        }
        Update: {
          clip_id?: string
          duration_ticks?: number | null
          loop?: boolean | null
          midi_pattern_version_id?: string | null
          source_start_tick?: number | null
          start_tick?: number | null
          track_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_clips_midi_pattern_version_id_fkey"
            columns: ["midi_pattern_version_id"]
            isOneToOne: false
            referencedRelation: "midi_pattern_versions"
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
          gain_db: number
          muted: boolean
          name: string
          pan: number
          preset_id: string | null
          preset_version: number | null
          soloed: boolean
          sort_order: number
          track_id: string
          workspace_id: string
        }
        Insert: {
          gain_db: number
          muted: boolean
          name: string
          pan: number
          preset_id?: string | null
          preset_version?: number | null
          soloed: boolean
          sort_order: number
          track_id: string
          workspace_id: string
        }
        Update: {
          gain_db?: number
          muted?: boolean
          name?: string
          pan?: number
          preset_id?: string | null
          preset_version?: number | null
          soloed?: boolean
          sort_order?: number
          track_id?: string
          workspace_id?: string
        }
        Relationships: [
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
      accept_contribution_v3: {
        Args: {
          p_contribution_id: string
          p_expected_contribution_version_id: string
          p_expected_project_revision_id: string
          p_message?: string
          p_request_id: string
        }
        Returns: {
          arrangement_version_id: string
          created_at: string
          revision_id: string
          revision_number: number
        }[]
      }
      activate_signup_invitation: { Args: { p_email: string }; Returns: Json }
      apply_midi_library_moderation_action: {
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
      create_contribution_workspace_v3: {
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
      create_midi_pattern_v3: {
        Args: {
          p_name: string
          p_request_id: string
          p_source_pattern_version_id?: string
        }
        Returns: {
          created_at: string
          pattern_id: string
        }[]
      }
      create_midi_pattern_version_v3: {
        Args: {
          p_duration_ticks: number
          p_expected_version_number: number
          p_notes: Json
          p_pattern_id: string
          p_ppq: number
          p_publish_for_reuse?: boolean
          p_request_id: string
          p_rights_attestation_version?: string
        }
        Returns: {
          content_sha256: string
          created_at: string
          pattern_version_id: string
          version_number: number
        }[]
      }
      create_midi_project_workspace_v3: {
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
      create_project_workspace_v3: {
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
      fork_project_v3: {
        Args: {
          p_description: string
          p_expected_license_code: string
          p_request_id: string
          p_rights_attestation_version: string
          p_source_project_id: string
          p_source_revision_id: string
          p_title: string
        }
        Returns: {
          arrangement_version_id: string
          created_at: string
          project_id: string
          revision_id: string
          workspace_id: string
        }[]
      }
      get_admin_beta_feedback: {
        Args: { p_feedback_id: string }
        Returns: Json
      }
      get_admin_midi_library_report: {
        Args: { p_report_id: string }
        Returns: Json
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
      get_midi_library_export: {
        Args: { p_listing_id: string; p_pattern_version_id: string }
        Returns: Json
      }
      get_own_account_recovery: { Args: never; Returns: Json }
      get_project_revision_history_v3: {
        Args: { p_project_id: string }
        Returns: Json
      }
      get_public_midi_library_listing: {
        Args: { p_listing_id: string }
        Returns: Json
      }
      get_public_midi_library_pattern_comparison: {
        Args: {
          p_from_pattern_version_id: string
          p_listing_id: string
          p_to_pattern_version_id: string
        }
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
      list_admin_beta_feedback: {
        Args: {
          p_after_created_at?: string
          p_after_id?: string
          p_kind?: string
          p_status?: string
        }
        Returns: Json
      }
      list_admin_midi_library_reports: { Args: never; Returns: Json }
      list_admin_moderation_queue: {
        Args: { p_after_created_at?: string; p_after_id?: string }
        Returns: Json
      }
      list_midi_library_pattern_version: {
        Args: {
          p_attestation_version: string
          p_category_code: string
          p_description: string
          p_external_credits: Json
          p_pattern_version_id: string
          p_public_domain_rationale: string
          p_replace_listing_id?: string
          p_request_id: string
          p_reuse_mode: string
          p_rights_basis: string
          p_suggested_preset_id: string
          p_suggested_preset_version: number
          p_supporting_source_terms: string
          p_supporting_source_url: string
          p_tags: string[]
        }
        Returns: {
          creator_version: number
          listed_at: string
          listing_id: string
        }[]
      }
      list_owned_midi_library_versions: {
        Args: { p_limit?: number }
        Returns: {
          active_creator_version: number
          active_listing_id: string
          active_listing_pattern_version_id: string
          active_reuse_mode: string
          created_at: string
          duration_ticks: number
          has_inherited_external_credits: boolean
          has_source_lineage: boolean
          note_count: number
          pattern_id: string
          pattern_name: string
          pattern_version_id: string
          reuse_license_code: string
          version_number: number
        }[]
      }
      list_owned_private_midi_workspaces: {
        Args: never
        Returns: {
          lock_version: number
          project_id: string
          project_title: string
          updated_at: string
          workspace_id: string
        }[]
      }
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
      list_saved_midi_library_pattern_ids: {
        Args: { p_pattern_version_ids: string[] }
        Returns: {
          midi_pattern_version_id: string
        }[]
      }
      list_saved_midi_library_patterns: {
        Args: { p_limit?: number }
        Returns: {
          can_reuse: boolean
          category_name: string
          created_at: string
          creator_credit_name: string
          creator_display_name: string
          creator_username: string
          duration_ticks: number
          external_credits: Json
          license_code: string
          license_url: string
          license_version: string
          midi_pattern_version_id: string
          note_count: number
          notes: Json
          preset_id: string
          preset_name: string
          preset_version: number
          reuse_mode: string
          source_availability: string
          source_listing_id: string
          title: string
        }[]
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
      mutate_admin_beta_feedback: {
        Args: {
          p_action: string
          p_deletion_reason?: string
          p_expected_lock_version: number
          p_feedback_id: string
          p_kind?: string
          p_note?: string
          p_request_id: string
        }
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
      operator_count_due_profile_avatar_cleanup: {
        Args: never
        Returns: number
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
      publish_midi_workspace_revision_v3: {
        Args: {
          p_expected_base_revision_id: string
          p_expected_workspace_lock_version: number
          p_message: string
          p_request_id: string
          p_workspace_id: string
        }
        Returns: {
          arrangement_version_id: string
          created_at: string
          revision_id: string
          revision_number: number
        }[]
      }
      release_content_hold: {
        Args: { p_hold_id: string; p_reason: string; p_request_id: string }
        Returns: string
      }
      remove_own_avatar: {
        Args: { p_expected_avatar_version_id: string }
        Returns: undefined
      }
      remove_saved_midi_library_pattern: {
        Args: { p_pattern_version_id: string; p_request_id: string }
        Returns: {
          midi_pattern_version_id: string
          removed: boolean
        }[]
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
      reuse_midi_library_pattern: {
        Args: {
          p_copy_name?: string
          p_expected_workspace_lock_version?: number
          p_listing_id: string
          p_operation: string
          p_pattern_version_id: string
          p_request_id: string
          p_start_tick?: number
          p_workspace_id?: string
        }
        Returns: {
          clip_id: string
          derived_pattern_id: string
          derived_pattern_version_id: string
          lock_version: number
          operation: string
          project_id: string
          source_pattern_version_id: string
          track_id: string
          workspace_id: string
        }[]
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
      revision_manifest_checksum_valid: {
        Args: { p_project_id: string; p_revision_id: string }
        Returns: boolean
      }
      save_midi_library_pattern: {
        Args: {
          p_listing_id: string
          p_pattern_version_id: string
          p_request_id: string
        }
        Returns: {
          created_at: string
          midi_pattern_version_id: string
          source_listing_id: string
        }[]
      }
      save_midi_workspace_v3: {
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
      search_public_midi_library: {
        Args: {
          p_after_listed_at?: string
          p_after_listing_id?: string
          p_after_title?: string
          p_category?: string
          p_duration_max?: number
          p_duration_min?: number
          p_instrument_family?: string
          p_limit?: number
          p_notes_max?: number
          p_notes_min?: number
          p_pitch_max?: number
          p_pitch_min?: number
          p_polyphony?: string
          p_preset?: string
          p_query?: string
          p_rights?: string
          p_sort?: string
          p_tags?: string[]
        }
        Returns: {
          category_code: string
          category_name: string
          creator_credit_name: string
          creator_display_name: string
          creator_username: string
          description: string
          duration_beats: number
          duration_ticks: number
          external_credits: Json
          instrument_family_code: string
          listed_at: string
          listing_id: string
          max_pitch: number
          midi_pattern_id: string
          midi_pattern_version_id: string
          min_pitch: number
          note_count: number
          notes: Json
          owner_id: string
          polyphony_kind: string
          public_domain_rationale: string
          reuse_mode: string
          rights_basis: string
          suggested_preset_id: string
          suggested_preset_name: string
          suggested_preset_version: number
          supporting_source_terms: string
          supporting_source_url: string
          tags: Json
          title: string
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
      submit_beta_feedback: {
        Args: {
          p_application_version: string
          p_browser_context?: string
          p_details: string
          p_kind: string
          p_request_id: string
          p_source_pathname: string
          p_summary: string
        }
        Returns: {
          created_at: string
          reference_id: string
        }[]
      }
      submit_contribution_v3: {
        Args: {
          p_attestation_version: string
          p_contribution_id: string
          p_expected_base_revision_id: string
          p_expected_manifest_sha256: string
          p_expected_workspace_lock_version: number
          p_request_id: string
        }
        Returns: {
          arrangement_version_id: string
          contribution_id: string
          contribution_version_id: string
          status: Database["public"]["Enums"]["contribution_status"]
          submitted_at: string
          version_number: number
        }[]
      }
      submit_midi_library_report: {
        Args: {
          p_claimant_role: string
          p_evidence: string
          p_listing_id: string
          p_original_work_title: string
          p_request_id: string
          p_source_url: string
        }
        Returns: {
          created_at: string
          report_id: string
          status: string
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
      unlist_midi_library_listing: {
        Args: {
          p_expected_creator_version: number
          p_listing_id: string
          p_request_id: string
        }
        Returns: {
          creator_version: number
          listing_id: string
          unlisted_at: string
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

