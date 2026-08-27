export interface WhatsappTemplate {
  _id: string;
  name: string;
  text: string;
  type: 'pass_delivery' | 'payment_request' | 'photo_delivery';
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}
