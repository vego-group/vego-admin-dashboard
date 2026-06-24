declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

interface MoyasarPayment {
  id: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  source?: Record<string, unknown>;
}

interface MoyasarInitConfig {
  element: string | HTMLElement;
  amount: number;
  currency: string;
  description: string;
  publishable_api_key: string;
  callback_url: string;
  language?: string;          // 'ar' | 'en' — localizes Moyasar's form strings
  methods?: string[];
  metadata?: Record<string, string>;
  // Card-saving must be nested under credit_card — a top-level save_card is ignored.
  credit_card?: { save_card?: boolean };
  on_completed?: (payment: MoyasarPayment) => void | Promise<void>;
  on_failure?: (payment: MoyasarPayment) => void;
}

declare const Moyasar: {
  init: (config: MoyasarInitConfig) => void;
};