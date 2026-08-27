import { createRazorpayOrder, getRazorpayKeyId } from './services/razorpay.js';

console.log('Testing Razorpay Order Creation...');
console.log('Razorpay Key ID loaded:', getRazorpayKeyId());

try {
  const order = await createRazorpayOrder({
    inquiryId: 'EKTEST-01',
    amount: 1, // 1 INR (100 paise)
    currency: 'INR'
  });
  console.log('✅ Razorpay Live Order successfully created on Razorpay servers!');
  console.log('Order ID:', order.id);
  console.log('Amount (in paise):', order.amount);
  console.log('Status:', order.status);
} catch (err) {
  console.error('❌ Razorpay Order creation failed:', err.message);
  process.exit(1);
}
