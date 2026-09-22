export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          created_at: string
          disabled_at: string | null
          id: string
          privy_did: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          disabled_at?: string | null
          id?: string
          privy_did: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          disabled_at?: string | null
          id?: string
          privy_did?: string
          updated_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_address: string
          follower_user_id: string | null
          target_address: string
          target_user_id: string | null
        }
        Insert: {
          created_at?: string
          follower_address: string
          follower_user_id?: string | null
          target_address: string
          target_user_id?: string | null
        }
        Update: {
          created_at?: string
          follower_address?: string
          follower_user_id?: string | null
          target_address?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_user_id_fkey"
            columns: ["follower_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_address: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          post_id: string
          user_address: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          post_id?: string
          user_address?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reposts: {
        Row: {
          created_at: string
          post_id: string
          user_address: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          post_id: string
          user_address: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          post_id?: string
          user_address?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reposts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          asset: string | null
          author_address: string
          author_initials: string | null
          author_name: string | null
          chain_id: number | null
          content: string | null
          created_at: string
          deleted_at: string | null
          description: string
          duel_contract: string | null
          eyebrow: string | null
          id: string
          is_live_challenge: boolean
          kind: string
          onchain_duel_id: string | null
          stake_mon: number | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          asset?: string | null
          author_address: string
          author_initials?: string | null
          author_name?: string | null
          chain_id?: number | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          description: string
          duel_contract?: string | null
          eyebrow?: string | null
          id: string
          is_live_challenge?: boolean
          kind?: string
          onchain_duel_id?: string | null
          stake_mon?: number | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          asset?: string | null
          author_address?: string
          author_initials?: string | null
          author_name?: string | null
          chain_id?: number | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          duel_contract?: string | null
          eyebrow?: string | null
          id?: string
          is_live_challenge?: boolean
          kind?: string
          onchain_duel_id?: string | null
          stake_mon?: number | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_matches: {
        Row: {
          asset: string
          created_at: string
          direction: string
          elo_delta: number
          id: string
          mode: string
          outcome: string
          payout: number
          player_address: string
          settled_price: number
          stake: number
          strike_price: number
          user_id: string | null
        }
        Insert: {
          asset: string
          created_at?: string
          direction: string
          elo_delta?: number
          id: string
          mode?: string
          outcome: string
          payout?: number
          player_address: string
          settled_price: number
          stake?: number
          strike_price: number
          user_id?: string | null
        }
        Update: {
          asset?: string
          created_at?: string
          direction?: string
          elo_delta?: number
          id?: string
          mode?: string
          outcome?: string
          payout?: number
          player_address?: string
          settled_price?: number
          stake?: number
          strike_price?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          handle: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          handle?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          handle?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      replies: {
        Row: {
          author_address: string
          author_initials: string | null
          author_name: string | null
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string | null
        }
        Insert: {
          author_address: string
          author_initials?: string | null
          author_name?: string | null
          content: string
          created_at?: string
          id: string
          post_id: string
          user_id?: string | null
        }
        Update: {
          author_address?: string
          author_initials?: string | null
          author_name?: string | null
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_wallets: {
        Row: {
          address: string
          chain_id: number
          id: string
          is_primary: boolean
          is_public: boolean
          user_id: string
          verified_at: string
        }
        Insert: {
          address: string
          chain_id: number
          id?: string
          is_primary?: boolean
          is_public?: boolean
          user_id: string
          verified_at?: string
        }
        Update: {
          address?: string
          chain_id?: number
          id?: string
          is_primary?: boolean
          is_public?: boolean
          user_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
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
