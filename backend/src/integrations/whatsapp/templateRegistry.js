/**
 * Central Meta WhatsApp Template Registry for Ek Duje Ke Liye (EDKL)
 * Strict Meta UTILITY categorization compliance (zero promotional copy, URL button for pass delivery, sequential variables)
 */

export const CORE_TEMPLATES = {
  // 1. Payment Confirmed + Digital Pass (Primary Pass Delivery - v1 Fallback)
  edkl_payment_confirmed_pass_v1: {
    key: 'edkl_payment_confirmed_pass_v1',
    metaName: 'edkl_payment_confirmed_pass_v1',
    category: 'UTILITY',
    section: 'FALLBACK',
    isFallbackOnly: true,
    language: 'en_US',
    purpose: 'Sent immediately after payment is captured/verified to deliver registration confirmation & digital pass (v1 Fallback)',
    trigger: 'payment_verified',
    bodyVariables: ['customerName', 'eventName', 'eventDate', 'eventTime', 'venue', 'registrationId'],
    buttonVariables: ['inquiryId'],
    requiredVariables: ['customerName', 'eventName', 'eventDate', 'eventTime', 'venue', 'registrationId', 'inquiryId'],
    components: [
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nYour payment and registration for {{2}} have been confirmed.\n\nDate: {{3}}\nTime: {{4}}\nVenue: {{5}}\nRegistration ID: {{6}}\n\nPlease keep your digital QR pass ready at the event entrance.\n\nEk Duje Ke Liye',
        example: {
          body_text: [
            [
              'Jaynesh',
              'Ek Duje Ke Liye Seminar',
              '15 September 2026',
              '8:30 PM',
              'Sardar Smruti Bhavan, Surat',
              'EK06-02'
            ]
          ]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'View Digital Pass',
            url: 'https://www.ekdujekeliye.in/pass/{{1}}',
            example: ['EK06-02']
          }
        ]
      }
    ]
  },

  // 2. Polite Bilingual Gujarati + English Registration Received & Payment Pending (with Direct Pay Now Button)
  edkl_polite_payment_pending_v1: {
    key: 'edkl_polite_payment_pending_v1',
    metaName: 'edkl_polite_payment_pending_v1',
    category: 'UTILITY',
    section: 'CORE',
    language: 'en_US',
    purpose: 'Polite bilingual Gujarati and English registration confirmation with direct payment link',
    trigger: 'registration_created',
    bodyVariables: ['customerName', 'eventName', 'registrationId', 'eventDate', 'eventTime', 'venue', 'feeAmount'],
    buttonVariables: ['inquiryId'],
    requiredVariables: ['customerName', 'eventName', 'registrationId', 'eventDate', 'eventTime', 'venue', 'feeAmount', 'inquiryId'],
    components: [
      {
        type: 'BODY',
        text: 'નમસ્તે {{1}},\n\nએક દુજે કે લિયે સેમિનારમાં આપનું હાર્દિક સ્વાગત છે. આપનું {{2}} માટેનું રજીસ્ટ્રેશન સફળતાપૂર્વક સ્વીકારવામાં આવ્યું છે.\n(Welcome to Ek Duje Ke Liye. Your registration for {{2}} has been received.)\n\n📌 રજીસ્ટ્રેશન વિગત (Details):\n• Registration ID: {{3}}\n• Date (તારીખ): {{4}}\n• Time (સમય): {{5}}\n• Venue (સ્થળ): {{6}}\n• Fee (ફી): {{7}}\n\nઆપનો કપલ પાસ કન્ફર્મ કરવા માટે કૃપા કરીને નીચે આપેલ બટન પર ક્લિક કરીને પેમેન્ટ પૂર્ણ કરવા નમ્ર વિનંતી છે.\n(Kindly complete your payment using the button below to confirm your couple pass.)\n\nઆભાર (Thank You),\nએક દુજે કે લિયે (Ek Duje Ke Liye)',
        example: {
          body_text: [
            [
              'Jaynesh & Pooja',
              'Ek Duje Ke Liye Seminar',
              'EK01-02',
              '15 September 2026',
              '8:30 PM',
              'Sardar Smruti Bhavan, Surat',
              '₹1500'
            ]
          ]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Complete Payment',
            url: 'https://www.ekdujekeliye.in/payment/{{1}}',
            example: ['EK01-02']
          }
        ]
      }
    ]
  },

  // 2b. Registration Received (Standard)
  edkl_registration_received_v1: {
    key: 'edkl_registration_received_v1',
    metaName: 'edkl_registration_received_v1',
    category: 'UTILITY',
    section: 'OPERATIONS',
    language: 'en_US',
    purpose: 'Sent immediately after a user submits an EDKL registration form',
    trigger: 'registration_submitted',
    bodyVariables: ['customerName', 'eventName', 'registrationId', 'eventDate', 'eventTime', 'venue', 'statusText'],
    buttonVariables: [],
    requiredVariables: ['customerName', 'eventName', 'registrationId', 'eventDate', 'eventTime', 'venue', 'statusText'],
    components: [
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nWe have received your registration for {{2}}.\n\nRegistration ID: {{3}}\nEvent Date: {{4}}\nEvent Time: {{5}}\nVenue: {{6}}\n\nYour registration status is currently {{7}}.\n\nEk Duje Ke Liye',
        example: {
          body_text: [
            [
              'Jaynesh',
              'Ek Duje Ke Liye Seminar',
              'EK06-02',
              '15 September 2026',
              '8:30 PM',
              'Sardar Smruti Bhavan, Surat',
              'Pending Payment'
            ]
          ]
        }
      }
    ]
  },

  // 3. Payment Failed
  edkl_payment_failed_v1: {
    key: 'edkl_payment_failed_v1',
    metaName: 'edkl_payment_failed_v1',
    category: 'UTILITY',
    section: 'OPERATIONS',
    language: 'en_US',
    purpose: 'Sent when online payment fails or is dismissed without completing transaction',
    trigger: 'payment_failed',
    bodyVariables: ['customerName', 'eventName', 'registrationId'],
    buttonVariables: ['inquiryId'],
    requiredVariables: ['customerName', 'eventName', 'registrationId', 'inquiryId'],
    components: [
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nWe could not confirm the payment for your registration for {{2}}.\n\nRegistration ID: {{3}}\n\nNo successful payment has been recorded for this registration. You can return to your registration page to check the current payment status.\n\nEk Duje Ke Liye',
        example: {
          body_text: [
            [
              'Jaynesh',
              'Ek Duje Ke Liye Seminar',
              'EK06-02'
            ]
          ]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Check Payment Status',
            url: 'https://www.ekdujekeliye.in/payment/{{1}}',
            example: ['EK06-02']
          }
        ]
      }
    ]
  },

  // 4. Event Reminder (v1 Fallback for edkl_event_pass_reminder_v2)
  edkl_event_reminder_v1: {
    key: 'edkl_event_reminder_v1',
    metaName: 'edkl_event_reminder_v1',
    category: 'UTILITY',
    section: 'FALLBACK',
    isFallbackOnly: true,
    language: 'en_US',
    purpose: 'Reminder sent only to confirmed registered participants before the event (v1 Fallback)',
    trigger: 'event_reminder',
    bodyVariables: ['customerName', 'eventName', 'eventDate', 'eventTime', 'venue', 'registrationId'],
    buttonVariables: ['inquiryId'],
    requiredVariables: ['customerName', 'eventName', 'eventDate', 'eventTime', 'venue', 'registrationId', 'inquiryId'],
    components: [
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nThis is a reminder for your confirmed registration for {{2}}.\n\nDate: {{3}}\nTime: {{4}}\nVenue: {{5}}\nRegistration ID: {{6}}\n\nPlease keep your digital QR pass ready at entry.\n\nEk Duje Ke Liye',
        example: {
          body_text: [
            [
              'Jaynesh',
              'Ek Duje Ke Liye Seminar',
              '15 September 2026',
              '8:30 PM',
              'Sardar Smruti Bhavan, Surat',
              'EK06-02'
            ]
          ]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'View Digital Pass',
            url: 'https://www.ekdujekeliye.in/pass/{{1}}',
            example: ['EK06-02']
          }
        ]
      }
    ]
  },

  // 5. Event Update (Date/Time/Venue change for confirmed attendees)
  edkl_event_update_v1: {
    key: 'edkl_event_update_v1',
    metaName: 'edkl_event_update_v1',
    category: 'UTILITY',
    section: 'OPERATIONS',
    language: 'en_US',
    purpose: 'Notification when event schedule or venue details are updated for existing registrations',
    trigger: 'event_details_updated',
    bodyVariables: ['customerName', 'eventName', 'updatedDate', 'updatedTime', 'updatedVenue', 'registrationId'],
    buttonVariables: ['inquiryId'],
    requiredVariables: ['customerName', 'eventName', 'updatedDate', 'updatedTime', 'updatedVenue', 'registrationId', 'inquiryId'],
    components: [
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nThere has been an update to your registered event {{2}}.\n\nUpdated Date: {{3}}\nUpdated Time: {{4}}\nUpdated Venue: {{5}}\nRegistration ID: {{6}}\n\nPlease refer to your digital pass for the latest event information.\n\nEk Duje Ke Liye',
        example: {
          body_text: [
            [
              'Jaynesh',
              'Ek Duje Ke Liye Seminar',
              '16 September 2026',
              '8:30 PM',
              'Sardar Smruti Bhavan, Surat',
              'EK06-02'
            ]
          ]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'View Updated Pass',
            url: 'https://www.ekdujekeliye.in/pass/{{1}}',
            example: ['EK06-02']
          }
        ]
      }
    ]
  },

  // 6. Event Cancelled
  edkl_event_cancelled_v1: {
    key: 'edkl_event_cancelled_v1',
    metaName: 'edkl_event_cancelled_v1',
    category: 'UTILITY',
    section: 'OPERATIONS',
    language: 'en_US',
    purpose: 'Notification when an event batch is cancelled with factual instructions',
    trigger: 'event_cancelled',
    bodyVariables: ['customerName', 'eventName', 'registrationId', 'eventDate'],
    buttonVariables: [],
    requiredVariables: ['customerName', 'eventName', 'registrationId', 'eventDate'],
    components: [
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nWe are informing you that {{2}}, associated with registration {{3}}, has been cancelled.\n\nEvent Date: {{4}}\n\nFor information regarding your registration or applicable refund/cancellation process, please use the support details available on the Ek Duje Ke Liye website.\n\nEk Duje Ke Liye',
        example: {
          body_text: [
            [
              'Jaynesh',
              'Ek Duje Ke Liye Seminar',
              'EK06-02',
              '15 September 2026'
            ]
          ]
        }
      }
    ]
  },

  // 7. Pass Reissued
  edkl_pass_reissued_v1: {
    key: 'edkl_pass_reissued_v1',
    metaName: 'edkl_pass_reissued_v1',
    category: 'UTILITY',
    section: 'OPERATIONS',
    language: 'en_US',
    purpose: 'Notification when a pass or token is re-issued for security or attendee correction',
    trigger: 'pass_reissued',
    bodyVariables: ['customerName', 'eventName', 'registrationId'],
    buttonVariables: ['inquiryId'],
    requiredVariables: ['customerName', 'eventName', 'registrationId', 'inquiryId'],
    components: [
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nA new digital entry pass has been issued for your registration for {{2}}.\n\nRegistration ID: {{3}}\n\nYour previous pass should no longer be used. Please use the new digital QR pass at entry.\n\nEk Duje Ke Liye',
        example: {
          body_text: [
            [
              'Jaynesh',
              'Ek Duje Ke Liye Seminar',
              'EK06-02'
            ]
          ]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'View New Pass',
            url: 'https://www.ekdujekeliye.in/pass/{{1}}',
            example: ['EK06-02']
          }
        ]
      }
    ]
  },

  // 8. 48-Hour Personalized Couple Invitation (v1 Fallback for edkl_personal_invitation_24h_v2)
  edkl_personal_invitation_48h_v1: {
    key: 'edkl_personal_invitation_48h_v1',
    metaName: 'edkl_personal_invitation_48h_v1',
    category: 'UTILITY',
    section: 'FALLBACK',
    isFallbackOnly: true,
    language: 'en_US',
    purpose: 'Sent approximately 48 hours before event with personalized couple invitation card attached as header image (v1 Fallback)',
    trigger: 'invitation_48h',
    headerType: 'IMAGE',
    bodyVariables: ['customerName', 'eventDate', 'eventTime', 'venue', 'registrationId'],
    buttonVariables: ['inquiryId'],
    requiredVariables: ['customerName', 'eventDate', 'eventTime', 'venue', 'registrationId', 'inquiryId'],
    components: [
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nWe look forward to welcoming you to your registered Ek Duje Ke Liye event.\n\nDate: {{2}}\nTime: {{3}}\nVenue: {{4}}\nRegistration ID: {{5}}\n\nYour personalized invitation is attached.\n\nEk Duje Ke Liye',
        example: {
          body_text: [
            [
              'Jaynesh & Pooja',
              '15 September 2026',
              '8:30 PM',
              'Sardar Smruti Bhavan, Surat',
              'EK06-02'
            ]
          ]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'View Digital Pass',
            url: 'https://www.ekdujekeliye.in/pass/{{1}}',
            example: ['EK06-02']
          }
        ]
      }
    ]
  },

  // 11. Post-Event Feedback Request (DEPRECATED - Replaced by edkl_post_event_memories_feedback_v1)
  edkl_event_feedback_v1: {
    key: 'edkl_event_feedback_v1',
    metaName: 'edkl_event_feedback_v1',
    category: 'UTILITY',
    section: 'DEPRECATED',
    isDeprecated: true,
    language: 'en_US',
    purpose: 'Deprecated standalone feedback template (Replaced by edkl_post_event_memories_feedback_v1)',
    trigger: 'event_feedback',
    bodyVariables: ['customerName', 'eventName', 'registrationId'],
    buttonVariables: ['feedbackToken'],
    requiredVariables: ['customerName', 'eventName', 'registrationId', 'feedbackToken'],
    components: [
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nThank you for attending {{2}}.\n\nWe would appreciate your feedback about your experience.\n\nRegistration ID: {{3}}\n\nEk Duje Ke Liye',
        example: {
          body_text: [
            [
              'Jaynesh & Pooja',
              'Ek Duje Ke Liye Seminar',
              'EK06-02'
            ]
          ]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Share Feedback',
            url: 'https://www.ekdujekeliye.in/feedback/{{1}}',
            example: ['fb-789a6b12']
          }
        ]
      }
    ]
  },

  // =========================================================================
  // CORE LIFECYCLE V2 TEMPLATES (Mixed Gujarati + English & Evergreen Invitation)
  // =========================================================================

  // Core 2: Payment Confirmed + Digital Pass (Mixed Gujarati + English)
  edkl_payment_confirmed_pass_v2: {
    key: 'edkl_payment_confirmed_pass_v2',
    metaName: 'edkl_payment_confirmed_pass_v2',
    category: 'UTILITY',
    section: 'CORE',
    language: 'en_US',
    purpose: 'Authoritative payment confirmation and Digital Pass delivery (Mixed Gujarati + English)',
    trigger: 'payment_verified',
    bodyVariables: ['customerName', 'eventName', 'eventDate', 'eventTime', 'venue', 'registrationId'],
    buttonVariables: ['inquiryId'],
    requiredVariables: ['customerName', 'eventName', 'eventDate', 'eventTime', 'venue', 'registrationId', 'inquiryId'],
    fallbackTemplateKey: 'edkl_payment_confirmed_pass_v1',
    components: [
      {
        type: 'BODY',
        text: 'નમસ્તે {{1}},\n\n{{2}} માટે તમારું રજીસ્ટ્રેશન અને પેમેન્ટ સફળતાપૂર્વક કન્ફર્મ થઈ ગયું છે.\n(Your registration and payment have been successfully confirmed.)\n\nતારીખ (Date): {{3}}\nસમય (Time): {{4}}\nસ્થળ (Venue): {{5}}\nRegistration ID: {{6}}\n\nતમારી સીટ કન્ફર્મ છે. કૃપા કરીને કાર્યક્રમમાં પ્રવેશ સમયે તમારો Digital QR Pass તૈયાર રાખશો.\n(Your seat is confirmed. Please keep your Digital QR Pass ready at the event entrance.)\n\nઆભાર,\nએક દુજે કે લિયે\nEk Duje Ke Liye',
        example: {
          body_text: [
            [
              'Jaynesh & Pooja',
              'Ek Duje Ke Liye Seminar',
              '7 September 2026',
              '8:30 PM',
              'Sardar Patel Smruti Bhavan, Surat',
              'EK06-02'
            ]
          ]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'View Digital Pass',
            url: 'https://www.ekdujekeliye.in/pass/{{1}}',
            example: ['EK06-02']
          }
        ]
      }
    ]
  },

  // Core 3: 48-Hour Pass / Event Reminder (Mixed Gujarati + English)
  edkl_event_pass_reminder_v2: {
    key: 'edkl_event_pass_reminder_v2',
    metaName: 'edkl_event_pass_reminder_v2',
    category: 'UTILITY',
    section: 'CORE',
    language: 'en_US',
    purpose: '48-hour event reminder with digital pass check-in link (Mixed Gujarati + English)',
    trigger: 'scheduled_48h_pass_reminder',
    bodyVariables: ['customerName', 'eventName', 'eventDate', 'eventTime', 'venue', 'registrationId'],
    buttonVariables: ['inquiryId'],
    requiredVariables: ['customerName', 'eventName', 'eventDate', 'eventTime', 'venue', 'registrationId', 'inquiryId'],
    fallbackTemplateKey: 'edkl_event_reminder_v1',
    components: [
      {
        type: 'BODY',
        text: 'નમસ્તે {{1}},\n\n{{2}} માટે હવે માત્ર 48 કલાક બાકી છે.\n(Your Ek Duje Ke Liye event is coming up in 48 hours.)\n\nતારીખ (Date): {{3}}\nસમય (Time): {{4}}\nસ્થળ (Venue): {{5}}\nRegistration ID: {{6}}\n\nકૃપા કરીને તમારો Digital QR Pass તૈયાર રાખશો.\n(Please keep your Digital QR Pass ready for entry.)\n\nઆભાર,\nએક દુજે કે લિયે\nEk Duje Ke Liye',
        example: {
          body_text: [
            [
              'Jaynesh & Pooja',
              'Ek Duje Ke Liye Seminar',
              '7 September 2026',
              '8:30 PM',
              'Sardar Patel Smruti Bhavan, Surat',
              'EK06-02'
            ]
          ]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'View Digital Pass',
            url: 'https://www.ekdujekeliye.in/pass/{{1}}',
            example: ['EK06-02']
          }
        ]
      }
    ]
  },

  // Core 4: 24-Hour / Catch-Up Personalized Invitation with IMAGE HEADER (Evergreen wording, NO "tomorrow")
  edkl_personal_invitation_24h_v2: {
    key: 'edkl_personal_invitation_24h_v2',
    metaName: 'edkl_personal_invitation_24h_v2',
    category: 'UTILITY',
    section: 'CORE',
    language: 'en_US',
    purpose: '24-hour & late-registration catch-up invitation with rendered IMAGE header card',
    trigger: 'scheduled_24h_invitation',
    headerType: 'IMAGE',
    bodyVariables: ['customerName', 'eventName', 'eventDate', 'eventTime', 'venue', 'registrationId'],
    buttonVariables: ['inquiryId'],
    requiredVariables: ['customerName', 'eventName', 'eventDate', 'eventTime', 'venue', 'registrationId', 'inquiryId'],
    fallbackTemplateKey: 'edkl_personal_invitation_48h_v1',
    components: [
      {
        type: 'HEADER',
        format: 'IMAGE',
        example: {
          header_handle: ['https://www.ekdujekeliye.in/sample_couple.png']
        }
      },
      {
        type: 'BODY',
        text: 'નમસ્તે {{1}},\n\n{{2}} કાર્યક્રમમાં આપનું હાર્દિક સ્વાગત છે.\n(We look forward to welcoming you to your Ek Duje Ke Liye event.)\n\nતારીખ (Date): {{3}}\nસમય (Time): {{4}}\nસ્થળ (Venue): {{5}}\nRegistration ID: {{6}}\n\nતમારા માટે ખાસ તૈયાર કરેલું Personalized Invitation ઉપર આપેલ છે.\n(Your personalized invitation is attached above.)\n\nકૃપા કરીને પ્રવેશ સમયે તમારો Digital QR Pass તૈયાર રાખશો.\n(Please keep your Digital QR Pass ready at entry.)\n\nઆભાર,\nએક દુજે કે લિયે\nEk Duje Ke Liye',
        example: {
          body_text: [
            [
              'Jaynesh & Pooja',
              'Ek Duje Ke Liye Seminar',
              '7 September 2026',
              '8:30 PM',
              'Sardar Patel Smruti Bhavan, Surat',
              'EK06-02'
            ]
          ]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'View Digital Pass',
            url: 'https://www.ekdujekeliye.in/pass/{{1}}',
            example: ['EK06-02']
          }
        ]
      }
    ]
  },

  // Core 5: Combined Post-Event Memories + Feedback (Sent ONLY to PRESENT Attendees)
  edkl_post_event_memories_feedback_v1: {
    key: 'edkl_post_event_memories_feedback_v1',
    metaName: 'edkl_post_event_memories_feedback_v1',
    category: 'UTILITY',
    section: 'CORE',
    language: 'en_US',
    purpose: 'Single post-event message sent to present attendees combining thank you, photo gallery, and feedback',
    trigger: 'post_event_memories_feedback',
    bodyVariables: ['customerName', 'eventName', 'registrationId'],
    buttonVariables: ['galleryToken', 'feedbackToken'],
    requiredVariables: ['customerName', 'eventName', 'registrationId', 'galleryToken', 'feedbackToken'],
    fallbackTemplateKey: 'edkl_event_feedback_v1',
    components: [
      {
        type: 'BODY',
        text: 'નમસ્તે {{1}},\n\n{{2}} કાર્યક્રમમાં જોડાવા બદલ આપનો દિલથી આભાર.\n(Thank you for being part of the event.)\n\nતમારી સાથે વિતાવેલી સુંદર પળોની યાદો હવે તૈયાર છે.\n(Your event memories are now available.)\n\nRegistration ID: {{3}}\n\nતમારા ફોટા જોવા માટે નીચેના "View Event Photos" બટનનો ઉપયોગ કરો. તમારો અનુભવ અમારે માટે મહત્વનો છે. કૃપા કરીને "Give Feedback" દ્વારા તમારો પ્રતિભાવ આપશો.\n(Your feedback is valuable to us.)\n\nઆભાર,\nએક દુજે કે લિયે\nEk Duje Ke Liye',
        example: {
          body_text: [
            [
              'Jaynesh & Pooja',
              'Ek Duje Ke Liye Seminar',
              'EK06-02'
            ]
          ]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'View Event Photos',
            url: 'https://www.ekdujekeliye.in/gallery/{{1}}',
            example: ['EK06-02']
          },
          {
            type: 'URL',
            text: 'Give Feedback',
            url: 'https://www.ekdujekeliye.in/feedback/{{1}}',
            example: ['fb-789a6b12']
          }
        ]
      }
    ]
  }
};

export const TEMPLATE_REGISTRY = CORE_TEMPLATES;

/**
 * Validate variables before dispatching
 */
export function validateTemplateVariables(templateKey, providedVariables = {}) {
  const template = TEMPLATE_REGISTRY[templateKey];
  if (!template) {
    return { valid: false, error: `Template '${templateKey}' is not registered.` };
  }

  const missing = [];
  for (const varName of template.requiredVariables) {
    const val = providedVariables[varName];
    if (val === undefined || val === null || String(val).trim() === '') {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing required template variables for '${templateKey}': ${missing.join(', ')}`,
      missing
    };
  }

  return { valid: true };
}

/**
 * Render human-readable template text preview with variables substituted
 */
export function renderTemplatePreview(templateKey, variables = {}) {
  const template = TEMPLATE_REGISTRY[templateKey];
  if (!template) return '';
  const bodyComp = template.components?.find(c => c.type === 'BODY');
  if (!bodyComp || !bodyComp.text) return template.metaName || templateKey;
  let text = bodyComp.text;
  const bodyVars = template.bodyVariables || template.requiredVariables || [];
  bodyVars.forEach((varKey, index) => {
    const placeholder = new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g');
    const val = variables[varKey] !== undefined ? String(variables[varKey]) : `[${varKey}]`;
    text = text.replace(placeholder, val);
  });
  return text;
}
