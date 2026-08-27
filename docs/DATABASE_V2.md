# Database V2 Architecture & Schema Design

## 1. Overview & Compatibility Strategy

The Ek Duje Ke Liye V2 database strategy bridges current production data with enterprise multi-event modeling without breaking active collections.

* Active MongoDB Collections:
  * `program` (Mongoose Model: `Event` / `Program`)
  * `submission` (Mongoose Model: `Registration` / `Submission`)
  * `setting` (Mongoose Model: `Setting`)
  * `counter` (Mongoose Model: `Counter`)
  * `webhook_events` (Mongoose Model: `WebhookEvent`)
  * `whatsapp_template` (Mongoose Model: `WhatsappTemplate`)
  * `notifications` (Mongoose Model: `Notification`)
* New V2 Foundation Collections:
  * `payments` (Mongoose Model: `Payment`) - Dedicated financial transaction history
  * `audit_logs` (Mongoose Model: `AuditLog`) - Immutable security and change log
  * `jobs` (Mongoose Model: `Job`) - MongoDB-backed scheduled background jobs

---

## 2. Core Schemas

### `Event` (Collection: `program`)
```javascript
{
  id: String,                     // Unique identifier (e.g. 'prog-1787844365699-01')
  sequenceNumber: Number,         // Human-readable sequential ID (e.g. 6)
  name: String,                   // Event title
  slug: String,                   // URL-friendly identifier (e.g. 'surat-7-september-2026')
  city: String,                   // e.g. 'Surat'
  venue: String,                  // Full venue address
  mapUrl: String,                 // Google Maps URL
  description: String,            // Overview & seminar highlights
  heroImage: String,              // Cover image URL
  price: Number,                  // Couple pass price in INR (default: 1500)
  currency: String,               // 'INR'
  status: String,                 // 'upcoming' | 'few_seats' | 'housefull' | 'registration_closed' | 'completed' | 'archived'
  featured: Boolean,              // Homepage highlight flag
  registrationMode: String,       // 'internal' | 'external'
  externalRegistrationUrl: String,// Third-party registration link
  sortOrder: Number,              // Priority ordering
  date: String,                   // YYYY-MM-DD
  time: String,                   // e.g. '8:30 PM'
  capacity: Number,               // Maximum attendees (individual seats)
  bookingsCount: Number,          // Active registered seats
  isDateFinal: Boolean,           // Confirmed vs TBD
  cardTemplate: String,           // Badge background template URL
  heartX: Number, heartY: Number, // Heart crop coordinates for badge
  heartWidth: Number, heartHeight: Number,
  photoZoom: Number, photoOffsetY: Number,
  photoLink: String,
  isInquiryClosed: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### `Registration` (Collection: `submission`)
```javascript
{
  inquiryId: String,              // e.g. 'EK06-01' (Unique indexed)
  customerToken: String,          // Secure random token for client-side status lookup
  programId: String,              // Foreign key referencing Event.id (indexed)
  programName: String,
  programDate: String,
  programTime: String,
  husbandName: String,
  wifeName: String,
  surname: String,
  phoneNumber: String,            // 10 digits
  couplePhoto: String,            // Cloudinary / Drive secure URL
  paymentScreenshot: String,      // Optional legacy receipt
  status: String,                 // 'inquiry' | 'pending' | 'approved' | 'rejected'
  payment: {
    provider: String,             // 'razorpay' | 'legacy_upi' | 'cash' | 'free'
    status: String,               // 'created' | 'pending' | 'captured' | 'failed' | 'refunded'
    amount: Number,               // INR amount
    currency: String,             // 'INR'
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    paidAt: Date,
    createdAt: Date
  },
  attendance: Boolean,
  attendanceMarkedAt: Date,
  isDeleted: Boolean,
  deletedAt: Date,
  rejectionReason: String,
  photoZoom: Number,
  photoOffsetY: Number,
  paymentReminder: {
    count: Number,
    lastSentAt: Date,
    nextReminderAt: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

### `Payment` (Collection: `payments`)
```javascript
{
  paymentId: String,              // e.g. 'pay_RZP123456' or 'PAY-EK06-01'
  orderId: String,                // Razorpay order ID or internal order ID
  inquiryId: String,              // Foreign key to Registration
  eventId: String,                // Foreign key to Event
  amount: Number,                 // INR amount
  currency: String,               // 'INR'
  status: String,                 // 'created' | 'authorized' | 'captured' | 'failed' | 'refunded'
  method: String,                 // 'upi' | 'card' | 'netbanking' | 'wallet'
  provider: String,               // 'razorpay' | 'manual'
  rawResponse: Object,            // Authoritative gateway response metadata
  capturedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 3. Database Indexes

* `submission`:
  * `{ inquiryId: 1 }` (unique)
  * `{ programId: 1, status: 1, isDeleted: 1 }`
  * `{ phoneNumber: 1, programId: 1, status: 1 }` (compound per-event duplicate check)
  * `{ 'payment.razorpayOrderId': 1 }`
  * `{ 'payment.razorpayPaymentId': 1 }`
  * `{ createdAt: -1 }`
* `program`:
  * `{ id: 1 }` (unique)
  * `{ slug: 1 }` (unique, sparse)
  * `{ status: 1, date: 1 }`
* `payments`:
  * `{ paymentId: 1 }` (unique)
  * `{ orderId: 1 }`
  * `{ inquiryId: 1 }`
  * `{ eventId: 1, status: 1 }`
* `webhook_events`:
  * `{ provider: 1, eventId: 1 }` (unique)
