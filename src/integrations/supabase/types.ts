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
      orders: {
        Row: {
          affiliate_percent: number
          affiliate_user_id: string | null
          buyer_id: string
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
          id: string
          invoice_id: string | null
          invoice_url: string | null
          note: string | null
          order_number: number
          paid_at: string | null
          pay_currency: string | null
          payment_id: string | null
          payment_status: string | null
          product_id: string
          product_image: string | null
          product_name: string
          quantity: number
          shop_id: string
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
          buyer_id: string
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
          id?: string
          invoice_id?: string | null
          invoice_url?: string | null
          note?: string | null
          order_number?: never
          paid_at?: string | null
          pay_currency?: string | null
          payment_id?: string | null
          payment_status?: string | null
          product_id: string
          product_image?: string | null
          product_name: string
          quantity?: number
          shop_id: string
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
          buyer_id?: string
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
          id?: string
          invoice_id?: string | null
          invoice_url?: string | null
          note?: string | null
          order_number?: never
          paid_at?: string | null
          pay_currency?: string | null
          payment_id?: string | null
          payment_status?: string | null
          product_id?: string
          product_image?: string | null
          product_name?: string
          quantity?: number
          shop_id?: string
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
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      product_codes: {
        Row: {
          content: string
          created_at: string
          id: string
          order_id: string | null
          product_id: string
          sold_at: string | null
          status: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          order_id?: string | null
          product_id: string
          sold_at?: string | null
          status?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          order_id?: string | null
          product_id?: string
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
          category: string | null
          created_at: string
          currency: string
          description: string | null
          escrow_release_days: number
          flash_sale_end: string | null
          flash_sale_price: number | null
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
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          escrow_release_days?: number
          flash_sale_end?: string | null
          flash_sale_price?: number | null
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
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          escrow_release_days?: number
          flash_sale_end?: string | null
          flash_sale_price?: number | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_order_paid: {
        Args: { _order_id: string; _pay_currency: string; _payment_id: string }
        Returns: boolean
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
