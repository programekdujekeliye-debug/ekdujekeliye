import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';

try {
    const envContent = fs.readFileSync(path.resolve('.env'), 'utf-8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            const k = trimmed.slice(0, idx).trim();
            const v = trimmed.slice(idx + 1).trim();
            if (!process.env[k]) process.env[k] = v;
        }
    }
} catch (e) { }

const uri = process.env.PROD_MONGO_URI || process.env.MONGO_URI;

async function verify() {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('ekdujekeliye');

    const eventDoc = await db.collection('program').findOne({
        $or: [{ id: 'prog-2026-09-11' }, { date: '2026-09-11' }]
    });

    const eventAliases = ['prog-2026-09-11', eventDoc?.slug, '2026-09-11'].filter(Boolean);

    const eventRegMatch = {
        $or: [
            { programId: { $in: eventAliases } },
            ...(eventDoc?.date ? [{ programDate: eventDoc.date }] : [])
        ],
        isDeleted: { $ne: true }
    };

    const eventRegs = await db.collection('submission').find(eventRegMatch).project({ inquiryId: 1, _id: 1 }).toArray();
    const regIds = eventRegs.map(r => r.inquiryId).filter(Boolean);
    const regObjectIds = eventRegs.map(r => r._id).filter(Boolean);

    const eventMsgMatch = {
        $or: [
            { eventId: { $in: eventAliases } },
            ...(eventDoc?.date ? [{ eventDate: eventDoc.date }] : []),
            ...(regIds.length > 0 ? [{ inquiryId: { $in: regIds } }] : []),
            ...(regObjectIds.length > 0 ? [{ registrationId: { $in: regObjectIds } }] : [])
        ]
    };

    // Run the aggregation exactly as in controller
    const breakdown = await db.collection('whatsapp_messages').aggregate([
        { $match: eventMsgMatch },
        {
            $group: {
                _id: { messageType: '$messageType', templateName: '$templateName', status: '$status' },
                count: { $sum: 1 }
            }
        }
    ]).toArray();

    const totalRegistrations = 679;
    const confirmedRegistrations = 577;
    const attendedRegistrations = 512;

    const messageTypeStats = {
        payment_pending: { eligible: 102, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
        payment_confirmation: { eligible: confirmedRegistrations, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
        reminder: { eligible: confirmedRegistrations, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
        invitation: { eligible: confirmedRegistrations, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
        post_event: { eligible: attendedRegistrations, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 }
    };

    breakdown.forEach(item => {
        let type = item._id?.messageType;
        const tpl = item._id?.templateName;
        const status = item._id?.status;
        const count = item.count || 0;

        if (
            tpl === 'edkl_post_event_memories_feedback_v1' ||
            type === 'post_event' ||
            type === 'feedback_request' ||
            type === 'gallery_ready'
        ) {
            type = 'post_event';
        } else if (tpl === 'edkl_event_pass_reminder_v2' || type === 'reminder') {
            type = 'reminder';
        } else if (tpl === 'edkl_personal_invitation_24h_v2' || type === 'invitation') {
            type = 'invitation';
        } else if (tpl === 'edkl_payment_confirmed_pass_v1' || type === 'payment_confirmation' || type === 'pass_delivery') {
            type = 'payment_confirmation';
        } else if (
            tpl === 'edkl_payment_pending_v1' ||
            tpl === 'edkl_polite_payment_pending_v1' ||
            type === 'payment_pending'
        ) {
            type = 'payment_pending';
        }

        if (messageTypeStats[type]) {
            if (status === 'QUEUED' || status === 'SENDING') messageTypeStats[type].queued += count;
            if (status === 'SENT' || status === 'DELIVERED' || status === 'READ') messageTypeStats[type].sent += count;
            if (status === 'DELIVERED' || status === 'READ') messageTypeStats[type].delivered += count;
            if (status === 'READ') messageTypeStats[type].read += count;
            if (status === 'FAILED') messageTypeStats[type].failed += count;
        }
    });

    Object.keys(messageTypeStats).forEach(type => {
        const s = messageTypeStats[type];
        s.deliveryRate = s.sent > 0 ? Math.round((s.delivered / s.sent) * 100) : 0;
        s.readRate = s.delivered > 0 ? Math.round((readRate => readRate)(s.read / s.delivered) * 100) : 0;
    });

    console.log('Simulated Controller messageTypeStats:');
    console.table(messageTypeStats);

    await client.close();
}

verify().catch(console.error);
