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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      affiliates: {
        Row: {
          audience_size: number | null
          channel_url: string | null
          created_at: string
          niche: string | null
          status: string
          tier: string
          user_id: string
        }
        Insert: {
          audience_size?: number | null
          channel_url?: string | null
          created_at?: string
          niche?: string | null
          status?: string
          tier?: string
          user_id: string
        }
        Update: {
          audience_size?: number | null
          channel_url?: string | null
          created_at?: string
          niche?: string | null
          status?: string
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_access_state: {
        Row: {
          blocked_message: string
          id: string
          updated_at: string
        }
        Insert: {
          blocked_message: string
          id: string
          updated_at?: string
        }
        Update: {
          blocked_message?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      buyer_product_referrals: {
        Row: {
          buyer_id: string
          created_at: string
          product_id: string
          referral_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          product_id: string
          referral_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          product_id?: string
          referral_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_product_referrals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_product_referrals_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "product_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          created_at: string
          day: string
          points: number
          streak: number
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          points: number
          streak: number
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          points?: number
          streak?: number
          user_id?: string
        }
        Relationships: []
      }
      code_issue_events: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          issue_id: string
          new_content: string | null
          note: string
          old_content: string | null
          order_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          issue_id: string
          new_content?: string | null
          note: string
          old_content?: string | null
          order_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          issue_id?: string
          new_content?: string | null
          note?: string
          old_content?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_issue_events_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "code_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_issue_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      code_issues: {
        Row: {
          buyer_id: string
          code_id: string
          created_at: string
          description: string
          id: string
          order_id: string
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          code_id: string
          created_at?: string
          description: string
          id?: string
          order_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          code_id?: string
          created_at?: string
          description?: string
          id?: string
          order_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_issues_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "product_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_tiers: {
        Row: {
          commission_percent: number
          created_at: string
          id: string
          is_active: boolean
          max_order_amount: number | null
          min_order_amount: number
        }
        Insert: {
          commission_percent: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_order_amount?: number | null
          min_order_amount?: number
        }
        Update: {
          commission_percent?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_order_amount?: number | null
          min_order_amount?: number
        }
        Relationships: []
      }
      disputes: {
        Row: {
          admin_note: string | null
          buyer_note: string | null
          created_at: string
          id: string
          opened_by: string
          order_id: string
          reason: string
          resolved_at: string | null
          seller_note: string | null
          status: string
        }
        Insert: {
          admin_note?: string | null
          buyer_note?: string | null
          created_at?: string
          id?: string
          opened_by: string
          order_id: string
          reason: string
          resolved_at?: string | null
          seller_note?: string | null
          status?: string
        }
        Update: {
          admin_note?: string | null
          buyer_note?: string | null
          created_at?: string
          id?: string
          opened_by?: string
          order_id?: string
          reason?: string
          resolved_at?: string | null
          seller_note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      draw_entries: {
        Row: {
          created_at: string
          draw_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          draw_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          draw_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draw_entries_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "lucky_draws"
            referencedColumns: ["id"]
          },
        ]
      }
      draw_winners: {
        Row: {
          display_name: string
          draw_id: string
          rank: number
          user_id: string
        }
        Insert: {
          display_name: string
          draw_id: string
          rank: number
          user_id: string
        }
        Update: {
          display_name?: string
          draw_id?: string
          rank?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draw_winners_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "lucky_draws"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_campaigns: {
        Row: {
          budget_ton: number
          claim_until: string | null
          created_at: string
          created_by: string
          ends_at: string
          fee_terms: string
          id: string
          max_entries: number
          referral_entries: number
          rules: string
          shop_id: string
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          budget_ton?: number
          claim_until?: string | null
          created_at?: string
          created_by: string
          ends_at: string
          fee_terms?: string
          id?: string
          max_entries?: number
          referral_entries?: number
          rules: string
          shop_id: string
          starts_at: string
          status?: string
          title: string
        }
        Update: {
          budget_ton?: number
          claim_until?: string | null
          created_at?: string
          created_by?: string
          ends_at?: string
          fee_terms?: string
          id?: string
          max_entries?: number
          referral_entries?: number
          rules?: string
          shop_id?: string
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_campaigns_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_events: {
        Row: {
          actor_id: string
          campaign_id: string
          created_at: string
          event: string
          id: string
        }
        Insert: {
          actor_id: string
          campaign_id: string
          created_at?: string
          event: string
          id?: string
        }
        Update: {
          actor_id?: string
          campaign_id?: string
          created_at?: string
          event?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "growth_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_members: {
        Row: {
          campaign_id: string
          created_at: string
          entries: number
          invite_code: string
          referrer_id: string | null
          used_entries: number
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          entries?: number
          invite_code?: string
          referrer_id?: string | null
          used_entries?: number
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          entries?: number
          invite_code?: string
          referrer_id?: string | null
          used_entries?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "growth_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_prize_secrets: {
        Row: {
          awarded_at: string | null
          awarded_to: string | null
          content: string
          id: string
          prize_id: string
        }
        Insert: {
          awarded_at?: string | null
          awarded_to?: string | null
          content: string
          id?: string
          prize_id: string
        }
        Update: {
          awarded_at?: string | null
          awarded_to?: string | null
          content?: string
          id?: string
          prize_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_prize_secrets_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "growth_prizes"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_prizes: {
        Row: {
          campaign_id: string
          id: string
          label: string
          position: number
        }
        Insert: {
          campaign_id: string
          id?: string
          label: string
          position: number
        }
        Update: {
          campaign_id?: string
          id?: string
          label?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "growth_prizes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "growth_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_spins: {
        Row: {
          campaign_id: string
          created_at: string
          delivered_content: string
          id: string
          prize_id: string
          request_id: string
          telegram_state: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          delivered_content: string
          id?: string
          prize_id: string
          request_id: string
          telegram_state?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          delivered_content?: string
          id?: string
          prize_id?: string
          request_id?: string
          telegram_state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_spins_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "growth_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_spins_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "growth_prizes"
            referencedColumns: ["id"]
          },
        ]
      }
      lucky_draws: {
        Row: {
          created_at: string
          created_by: string
          drawn_at: string | null
          ends_at: string
          entry_cost: number
          id: string
          image_url: string | null
          max_entries_per_user: number
          prize: string
          shop_id: string | null
          starts_at: string
          status: string
          title: string
          winners_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          drawn_at?: string | null
          ends_at: string
          entry_cost?: number
          id?: string
          image_url?: string | null
          max_entries_per_user?: number
          prize: string
          shop_id?: string | null
          starts_at?: string
          status?: string
          title: string
          winners_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          drawn_at?: string | null
          ends_at?: string
          entry_cost?: number
          id?: string
          image_url?: string | null
          max_entries_per_user?: number
          prize?: string
          shop_id?: string | null
          starts_at?: string
          status?: string
          title?: string
          winners_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "lucky_draws_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          affiliate_percent: number
          affiliate_user_id: string | null
          buyer_guide: string | null
          buyer_id: string
          buyer_received_at: string | null
          commission_amount: number
          commission_percent: number
          completed_at: string | null
          created_at: string
          currency: string
          delivered_content: string | null
          delivery_address: string | null
          discount_amount: number
          escrow_release_at: string | null
          escrow_release_days: number
          escrow_status: string
          free_quantity: number
          fulfillment_error: string | null
          fulfillment_state: string
          id: string
          invoice_id: string | null
          invoice_url: string | null
          note: string | null
          order_number: number
          paid_at: string | null
          pay_currency: string | null
          pay_method: string
          payment_id: string | null
          payment_status: string | null
          product_id: string
          product_image: string | null
          product_name: string
          product_referral_id: string | null
          quantity: number
          settled_affiliate: number | null
          settled_amount: number | null
          settled_at: string | null
          settled_currency: string | null
          settled_fee: number | null
          settled_net: number | null
          shop_id: string
          stars_amount: number | null
          stars_refund_state: string | null
          stars_settlement_id: string | null
          status: string
          subtotal: number
          total_amount: number
          tracking_info: string | null
          unit_price: number
          updated_at: string
          voucher_code: string | null
          warranty_type: string
        }
        Insert: {
          affiliate_percent?: number
          affiliate_user_id?: string | null
          buyer_guide?: string | null
          buyer_id: string
          buyer_received_at?: string | null
          commission_amount?: number
          commission_percent?: number
          completed_at?: string | null
          created_at?: string
          currency: string
          delivered_content?: string | null
          delivery_address?: string | null
          discount_amount?: number
          escrow_release_at?: string | null
          escrow_release_days?: number
          escrow_status?: string
          free_quantity?: number
          fulfillment_error?: string | null
          fulfillment_state?: string
          id?: string
          invoice_id?: string | null
          invoice_url?: string | null
          note?: string | null
          order_number?: never
          paid_at?: string | null
          pay_currency?: string | null
          pay_method?: string
          payment_id?: string | null
          payment_status?: string | null
          product_id: string
          product_image?: string | null
          product_name: string
          product_referral_id?: string | null
          quantity?: number
          settled_affiliate?: number | null
          settled_amount?: number | null
          settled_at?: string | null
          settled_currency?: string | null
          settled_fee?: number | null
          settled_net?: number | null
          shop_id: string
          stars_amount?: number | null
          stars_refund_state?: string | null
          stars_settlement_id?: string | null
          status?: string
          subtotal: number
          total_amount: number
          tracking_info?: string | null
          unit_price: number
          updated_at?: string
          voucher_code?: string | null
          warranty_type?: string
        }
        Update: {
          affiliate_percent?: number
          affiliate_user_id?: string | null
          buyer_guide?: string | null
          buyer_id?: string
          buyer_received_at?: string | null
          commission_amount?: number
          commission_percent?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          delivered_content?: string | null
          delivery_address?: string | null
          discount_amount?: number
          escrow_release_at?: string | null
          escrow_release_days?: number
          escrow_status?: string
          free_quantity?: number
          fulfillment_error?: string | null
          fulfillment_state?: string
          id?: string
          invoice_id?: string | null
          invoice_url?: string | null
          note?: string | null
          order_number?: never
          paid_at?: string | null
          pay_currency?: string | null
          pay_method?: string
          payment_id?: string | null
          payment_status?: string | null
          product_id?: string
          product_image?: string | null
          product_name?: string
          product_referral_id?: string | null
          quantity?: number
          settled_affiliate?: number | null
          settled_amount?: number | null
          settled_at?: string | null
          settled_currency?: string | null
          settled_fee?: number | null
          settled_net?: number | null
          shop_id?: string
          stars_amount?: number | null
          stars_refund_state?: string | null
          stars_settlement_id?: string | null
          status?: string
          subtotal?: number
          total_amount?: number
          tracking_info?: string | null
          unit_price?: number
          updated_at?: string
          voucher_code?: string | null
          warranty_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_referral_id_fkey"
            columns: ["product_referral_id"]
            isOneToOne: false
            referencedRelation: "product_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_stars_settlement_id_fkey"
            columns: ["stars_settlement_id"]
            isOneToOne: false
            referencedRelation: "stars_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          crypto_enabled: boolean
          id: boolean
          stars_enabled: boolean
          stars_per_ton: number
          stars_per_usdt: number
          updated_at: string
        }
        Insert: {
          crypto_enabled?: boolean
          id?: boolean
          stars_enabled?: boolean
          stars_per_ton?: number
          stars_per_usdt?: number
          updated_at?: string
        }
        Update: {
          crypto_enabled?: boolean
          id?: boolean
          stars_enabled?: boolean
          stars_per_ton?: number
          stars_per_usdt?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_codes: {
        Row: {
          content: string
          created_at: string
          id: string
          order_id: string | null
          product_id: string
          received_at: string | null
          sold_at: string | null
          status: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          order_id?: string | null
          product_id: string
          received_at?: string | null
          sold_at?: string | null
          status?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          order_id?: string | null
          product_id?: string
          received_at?: string | null
          sold_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_codes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_codes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_referrals: {
        Row: {
          affiliate_user_id: string
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          affiliate_user_id: string
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          affiliate_user_id?: string
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_referrals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_secrets: {
        Row: {
          content: string
          product_id: string
          updated_at: string
        }
        Insert: {
          content: string
          product_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_secrets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          auto_send_telegram: boolean
          bulk_discounts: string | null
          buy_x: number | null
          buyer_guide: string | null
          category: string | null
          created_at: string
          currency: string
          description: string | null
          escrow_release_days: number
          flash_sale_end: string | null
          flash_sale_price: number | null
          get_y: number | null
          goods_kind: string
          highlights: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          shop_id: string
          sold_count: number
          status: string
          stock: number
          warranty_type: string
        }
        Insert: {
          auto_send_telegram?: boolean
          bulk_discounts?: string | null
          buy_x?: number | null
          buyer_guide?: string | null
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          escrow_release_days?: number
          flash_sale_end?: string | null
          flash_sale_price?: number | null
          get_y?: number | null
          goods_kind?: string
          highlights?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          shop_id: string
          sold_count?: number
          status?: string
          stock?: number
          warranty_type?: string
        }
        Update: {
          auto_send_telegram?: boolean
          bulk_discounts?: string | null
          buy_x?: number | null
          buyer_guide?: string | null
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          escrow_release_days?: number
          flash_sale_end?: string | null
          flash_sale_price?: number | null
          get_y?: number | null
          goods_kind?: string
          highlights?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          shop_id?: string
          sold_count?: number
          status?: string
          stock?: number
          warranty_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          language: string
          last_name: string | null
          photo_url: string | null
          referral_code: string
          referred_by: string | null
          telegram_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id: string
          language?: string
          last_name?: string | null
          photo_url?: string | null
          referral_code: string
          referred_by?: string | null
          telegram_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          language?: string
          last_name?: string | null
          photo_url?: string | null
          referral_code?: string
          referred_by?: string | null
          telegram_id?: string
          username?: string | null
        }
        Relationships: []
      }
      reward_points: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          ref_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          ref_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          ref_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_tasks: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          kind: string
          link_url: string | null
          points: number
          shop_id: string | null
          target: string | null
          target_amount: number
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind: string
          link_url?: string | null
          points: number
          shop_id?: string | null
          target?: string | null
          target_amount?: number
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          link_url?: string | null
          points?: number
          shop_id?: string | null
          target?: string | null
          target_amount?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_tasks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_bots: {
        Row: {
          bot_token: string | null
          notification_chat_id: string | null
          shop_id: string
          updated_at: string
        }
        Insert: {
          bot_token?: string | null
          notification_chat_id?: string | null
          shop_id: string
          updated_at?: string
        }
        Update: {
          bot_token?: string | null
          notification_chat_id?: string | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_bots_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_points: {
        Row: {
          amount: number
          created_at: string
          id: string
          quiz_id: string
          shop_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          quiz_id: string
          shop_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          quiz_id?: string
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_points_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "shop_quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_points_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_quiz_answers: {
        Row: {
          correct_index: number
          quiz_id: string
        }
        Insert: {
          correct_index: number
          quiz_id: string
        }
        Update: {
          correct_index?: number
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_quiz_answers_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: true
            referencedRelation: "shop_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_quiz_codes: {
        Row: {
          awarded_at: string | null
          awarded_to: string | null
          content: string
          id: string
          quiz_id: string
        }
        Insert: {
          awarded_at?: string | null
          awarded_to?: string | null
          content: string
          id?: string
          quiz_id: string
        }
        Update: {
          awarded_at?: string | null
          awarded_to?: string | null
          content?: string
          id?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_quiz_codes_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "shop_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_quiz_rewards: {
        Row: {
          created_at: string
          delivered_content: string | null
          entries: number
          id: string
          kind: string
          points: number
          quiz_id: string
          shop_id: string
          telegram_state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_content?: string | null
          entries?: number
          id?: string
          kind: string
          points: number
          quiz_id: string
          shop_id: string
          telegram_state?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_content?: string | null
          entries?: number
          id?: string
          kind?: string
          points?: number
          quiz_id?: string
          shop_id?: string
          telegram_state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_quiz_rewards_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "shop_quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_quiz_rewards_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_quizzes: {
        Row: {
          campaign_id: string
          created_at: string
          entries: number
          id: string
          options: Json
          points: number
          question: string
          reward_kind: string
          reward_voucher_code: string | null
          shop_id: string
          title: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          entries?: number
          id?: string
          options: Json
          points: number
          question: string
          reward_kind?: string
          reward_voucher_code?: string | null
          shop_id: string
          title: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          entries?: number
          id?: string
          options?: Json
          points?: number
          question?: string
          reward_kind?: string
          reward_voucher_code?: string | null
          shop_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_quizzes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "growth_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_quizzes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          affiliate_percent: number
          banner_url: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          plan: string
          rating: number
          slug: string
          status: string
          telegram_channel: string | null
          total_sales: number
          wallet_address: string | null
        }
        Insert: {
          affiliate_percent?: number
          banner_url?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          plan?: string
          rating?: number
          slug: string
          status?: string
          telegram_channel?: string | null
          total_sales?: number
          wallet_address?: string | null
        }
        Update: {
          affiliate_percent?: number
          banner_url?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          plan?: string
          rating?: number
          slug?: string
          status?: string
          telegram_channel?: string | null
          total_sales?: number
          wallet_address?: string | null
        }
        Relationships: []
      }
      stars_settlements: {
        Row: {
          confirmed_by: string
          created_at: string
          currency: string
          id: string
          received_amount: number
          reference: string
          stars_amount: number
        }
        Insert: {
          confirmed_by: string
          created_at?: string
          currency: string
          id?: string
          received_amount: number
          reference: string
          stars_amount: number
        }
        Update: {
          confirmed_by?: string
          created_at?: string
          currency?: string
          id?: string
          received_amount?: number
          reference?: string
          stars_amount?: number
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          created_at: string
          points: number
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          points: number
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          points?: number
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "reward_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_channels: {
        Row: {
          chat_id: string
          created_at: string
          enabled: boolean
          id: string
          name: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
        }
        Relationships: []
      }
      telegram_delivery_logs: {
        Row: {
          acknowledged_at: string | null
          chat_id: string
          created_at: string
          error_code: string | null
          event: string
          id: string
          message_id: number | null
          recipient_user_id: string | null
          status: string
        }
        Insert: {
          acknowledged_at?: string | null
          chat_id: string
          created_at?: string
          error_code?: string | null
          event: string
          id?: string
          message_id?: number | null
          recipient_user_id?: string | null
          status: string
        }
        Update: {
          acknowledged_at?: string | null
          chat_id?: string
          created_at?: string
          error_code?: string | null
          event?: string
          id?: string
          message_id?: number | null
          recipient_user_id?: string | null
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vouchers: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          last_broadcast_at: string | null
          max_uses: number | null
          min_order_amount: number | null
          shop_id: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_broadcast_at?: string | null
          max_uses?: number | null
          min_order_amount?: number | null
          shop_id: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_broadcast_at?: string | null
          max_uses?: number | null
          min_order_amount?: number | null
          shop_id?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          id: string
          order_id: string | null
          status: string
          to_address: string | null
          tx_hash: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          description?: string | null
          id?: string
          order_id?: string | null
          status?: string
          to_address?: string | null
          tx_hash?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          order_id?: string | null
          status?: string
          to_address?: string | null
          tx_hash?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_policies: {
        Row: {
          currency: string
          enabled: boolean
          fee_mode: string
          fee_value: number
          minimum: number
          updated_at: string
        }
        Insert: {
          currency: string
          enabled?: boolean
          fee_mode?: string
          fee_value?: number
          minimum?: number
          updated_at?: string
        }
        Update: {
          currency?: string
          enabled?: boolean
          fee_mode?: string
          fee_value?: number
          minimum?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_task: { Args: { _task: string; _user: string }; Returns: number }
      bind_product_referral: {
        Args: { _buyer: string; _referral: string }
        Returns: string
      }
      configure_growth_terms: {
        Args: {
          _actor: string
          _budget: number
          _campaign: string
          _claim: string
          _fees: string
        }
        Returns: undefined
      }
      configure_quiz_reward: {
        Args: {
          _actor: string
          _codes: string[]
          _kind: string
          _quiz: string
          _voucher: string
        }
        Returns: number
      }
      confirm_order_receipt: {
        Args: { _actor: string; _order_id: string }
        Returns: boolean
      }
      create_growth_campaign: {
        Args: {
          _actor: string
          _bonus: number
          _ends: string
          _max: number
          _prizes: Json
          _rules: string
          _shop: string
          _starts: string
          _title: string
        }
        Returns: string
      }
      create_shop_quiz: {
        Args: {
          _actor: string
          _campaign: string
          _correct: number
          _entries: number
          _options: Json
          _points: number
          _question: string
          _title: string
        }
        Returns: string
      }
      credit_stars_order: { Args: { _order_id: string }; Returns: boolean }
      daily_checkin: { Args: { _user: string }; Returns: number }
      enter_draw: { Args: { _draw: string; _user: string }; Returns: boolean }
      finish_withdrawal: {
        Args: {
          _actor: string
          _approve: boolean
          _id: string
          _tx_hash: string
        }
        Returns: boolean
      }
      fulfill_paid_order: { Args: { _order_id: string }; Returns: boolean }
      growth_inventory_counts: {
        Args: { _campaigns: string[] }
        Returns: {
          prize_id: string
          remaining: number
        }[]
      }
      growth_member_counts: {
        Args: { _campaigns: string[] }
        Returns: {
          campaign_id: string
          referrals: number
          spins: number
          users: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      join_growth_campaign: {
        Args: {
          _campaign: string
          _invite?: string
          _new_telegram?: boolean
          _user: string
        }
        Returns: undefined
      }
      mark_order_paid: {
        Args: { _order_id: string; _pay_currency: string; _payment_id: string }
        Returns: boolean
      }
      my_reward_balance: { Args: never; Returns: number }
      open_order_dispute: {
        Args: {
          _actor: string
          _note: string
          _order_id: string
          _reason: string
        }
        Returns: string
      }
      play_shop_quiz: {
        Args: { _answer: number; _quiz: string; _user: string }
        Returns: number
      }
      play_shop_quiz_reward: {
        Args: { _answer: number; _quiz: string; _user: string }
        Returns: Json
      }
      prepare_stars_refund: {
        Args: { _actor: string; _dispute: string }
        Returns: Json
      }
      refund_order_escrow: { Args: { _order_id: string }; Returns: boolean }
      release_order_escrow: { Args: { _order_id: string }; Returns: boolean }
      report_code_issue: {
        Args: {
          _actor: string
          _code: string
          _description: string
          _order: string
        }
        Returns: string
      }
      request_withdrawal: {
        Args: {
          _address: string
          _amount: number
          _currency: string
          _user_id: string
        }
        Returns: string
      }
      resolve_code_issue: {
        Args: { _action: string; _actor: string; _issue: string; _note: string }
        Returns: boolean
      }
      resolve_order_dispute: {
        Args: {
          _actor: string
          _dispute: string
          _note: string
          _outcome: string
          _stars_refunded?: boolean
        }
        Returns: boolean
      }
      run_draw: { Args: { _actor: string; _draw: string }; Returns: number }
      set_growth_status: {
        Args: { _actor: string; _campaign: string; _status: string }
        Returns: undefined
      }
      settle_stars_orders: {
        Args: {
          _actor: string
          _amount: number
          _currency: string
          _orders: string[]
          _reference: string
        }
        Returns: string
      }
      spin_growth_campaign: {
        Args: {
          _campaign: string
          _random: number
          _request: string
          _user: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
