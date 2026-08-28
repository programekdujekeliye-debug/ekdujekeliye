export interface WhatsappTemplate {
  _id: string;
  name: string;
  text: string;
  type: 'pass_delivery' | 'payment_request' | 'photo_delivery';
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MetaTemplate {
  key: string;
  metaName: string;
  category: string;
  language: string;
  purpose: string;
  trigger: string;
  bodyText: string;
  buttons: Array<{
    type: string;
    text: string;
    url?: string;
  }>;
  requiredVariables: string[];
  status: string;
  channel: string;
}
