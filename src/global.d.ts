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
  methods?: string[];
  metadata?: Record<string, string>;
  save_card?: boolean;        // when true, Moyasar renders a "save this card" option
  on_completed?: (payment: MoyasarPayment) => void | Promise<void>;
  on_failure?: (payment: MoyasarPayment) => void;
}

declare const Moyasar: {
  init: (config: MoyasarInitConfig) => void;
};