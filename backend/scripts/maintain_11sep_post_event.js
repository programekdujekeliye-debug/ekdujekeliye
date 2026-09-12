import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';

// Parse .env manually
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

async function run() {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('ekdujekeliye');
    console.log('Connected to ekdujekeliye database.');

    const eventAliases = ['prog-2026-09-11', '2026-09-11'];

    // 1. Check 4 stuck SENDING messages
    const sendingMsgs = await db.collection('whatsapp_messages').find({
        eventId: { $in: eventAliases },
        templateName: 'edkl_post_event_memories_feedback_v1',
        status: 'SENDING',
        attemptCount: { $gte: 5 }
    }).toArray();
    console.log(`Found ${sendingMsgs.length} stuck SENDING messages with attemptCount >= 5:`, sendingMsgs.map(m => m.inquiryId));

    if (sendingMsgs.length > 0) {
        const updateRes = await db.collection('whatsapp_messages').updateMany(
            {
                _id: { $in: sendingMsgs.map(m => m._id) }
            },
            {
                $set: {
                    status: 'FAILED',
                    lockedAt: null,
                    lastErrorMessage: 'Message delivery timed out after 5 attempts without confirmation.',
                    updatedAt: new Date()
                }
            }
        );
        console.log(`Updated ${updateRes.modifiedCount} messages from SENDING to FAILED.`);
    }

    // 2. Canonicalize messageType to 'post_event' for all edkl_post_event_memories_feedback_v1 messages
    const canonicalizeRes = await db.collection('whatsapp_messages').updateMany(
        {
            eventId: { $in: eventAliases },
            templateName: 'edkl_post_event_memories_feedback_v1',
            messageType: { $ne: 'post_event' }
        },
        {
            $set: {
                messageType: 'post_event',
                updatedAt: new Date()
            }
        }
    );
    console.log(`Canonicalized ${canonicalizeRes.modifiedCount} messages to messageType: 'post_event'.`);

    // 3. Status summary after update
    const summary = await db.collection('whatsapp_messages').aggregate([
        {
            $match: {
                eventId: { $in: eventAliases },
                templateName: 'edkl_post_event_memories_feedback_v1'
            }
        },
        {
            $group: {
                _id: { status: '$status', messageType: '$messageType' },
                count: { $sum: 1 }
            }
        }
    ]).toArray();

    console.log('\nFinal Post-Event Status breakdown for 11 Sep:');
    console.table(summary.map(s => ({ status: s._id.status, messageType: s._id.messageType, count: s.count })));

    await client.close();
}

run().catch(console.error);
