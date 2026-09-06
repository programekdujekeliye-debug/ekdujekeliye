import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { Registration } from '../models/Registration.js';
import { Event } from '../models/Event.js';
import { eventService } from '../modules/events/event.service.js';
import { storageService } from './storage.service.js';
import { r2Provider } from '../integrations/r2/r2.provider.js';

// In-Memory Template & SVG Caches for sub-10ms response times
const transparentTemplateCache = new Map();
const svgCardCache = new Map();

/**
 * Service to generate high-resolution, premium 1080x1350 personalized invitation cards
 */
export class InvitationCardService {
  /**
   * Compute deterministic fingerprint for invitation card
   */
  calculateInvitationHash(registration, event) {
    const husband = registration.husbandName || '';
    const wife = registration.wifeName || '';
    const surname = registration.surname || '';
    const coupleTitle = `${husband} & ${wife} ${surname}`.trim();
    const photo = registration.couplePhoto || '';
    const eventName = event?.name || registration.programName || '';
    const eventDate = event?.date || registration.programDate || '';
    const eventTime = event?.time || registration.programTime || '';
    const venue = event?.venue || '';
    const template = event?.cardTemplate || event?.cardTemplateUrl || registration?.cardTemplate || '';
    const heartCoords = `${event?.heartX ?? 157}_${event?.heartY ?? 91}_${event?.heartWidth ?? 260}_${event?.heartHeight ?? 312}_${event?.photoZoom ?? 0.55}_${event?.photoOffsetY ?? 0}`;
    const designVersion = 'v2_official_heart_template';

    return crypto
      .createHash('sha256')
      .update(`${coupleTitle}|${photo}|${eventName}|${eventDate}|${eventTime}|${venue}|${template}|${heartCoords}|${designVersion}`)
      .digest('hex');
  }

  /**
   * Generate an SVG composed 1080x1350 invitation card buffer
   */
  async generateCardBuffer(registration, event) {
    const width = 1080;
    const height = 1350;

    const husband = registration.husbandName || '';
    const wife = registration.wifeName || '';
    const surname = registration.surname || '';
    const coupleTitle = `${husband} & ${wife} ${surname}`.trim() || 'Respected Couple';

    const eventName = event?.name || registration.programName || 'Ek Duje Ke Liye Seminar';
    const eventDate = event?.date || registration.programDate || 'Upcoming Date';
    const eventTime = event?.time || registration.programTime || '8:30 PM';
    const venue = event?.venue || 'Sardar Smruti Bhavan, Surat';
    const inquiryId = registration.inquiryId;

    // Escape XML characters
    const escapeXml = (unsafe = '') => String(unsafe).replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });

    // Resolve couple photo base64: R2 buffer direct, remote URL, or local sample
    let couplePhotoDataUri = '';
    const r2Media = registration.r2Media;
    const photoSrc = registration.couplePhoto || '/sample_couple.png';

    try {
      if (r2Media && (r2Media.normalKey || r2Media.key)) {
        const targetBucket = r2Media.bucket || r2Provider.privateBucket;
        const targetKey = r2Media.normalKey || r2Media.key;
        const buf = await r2Provider.getObjectBuffer({ bucket: targetBucket, key: targetKey });
        const contentType = targetKey.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
        couplePhotoDataUri = `data:${contentType};base64,${buf.toString('base64')}`;
      } else if (photoSrc.startsWith('http')) {
        const photoRes = await fetch(photoSrc);
        if (photoRes.ok) {
          const arrBuf = await photoRes.arrayBuffer();
          const base64 = Buffer.from(arrBuf).toString('base64');
          const contentType = photoRes.headers.get('content-type') || 'image/jpeg';
          couplePhotoDataUri = `data:${contentType};base64,${base64}`;
        }
      } else if (photoSrc.startsWith('/') || photoSrc.includes('\\')) {
        const localPath = path.resolve(process.cwd(), '..', 'frontend', 'public', photoSrc.replace(/^\//, ''));
        if (fs.existsSync(localPath)) {
          const fileBuf = fs.readFileSync(localPath);
          couplePhotoDataUri = `data:image/png;base64,${fileBuf.toString('base64')}`;
        }
      }
    } catch (e) {
      console.warn('[InvitationCardService] Could not load couple photo for card:', e.message);
    }

    const svgTemplate = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#2a0813"/>
            <stop offset="40%" stop-color="#4c0e1e"/>
            <stop offset="100%" stop-color="#18040b"/>
          </linearGradient>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#f6d365"/>
            <stop offset="100%" stop-color="#fda085"/>
          </linearGradient>
          <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="100%" stop-color="#fdfbfb"/>
          </linearGradient>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.5"/>
          </filter>
          <clipPath id="photoClip">
            <rect x="290" y="240" width="500" height="420" rx="32"/>
          </clipPath>
        </defs>

        <!-- Background -->
        <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>

        <!-- Decorative Border -->
        <rect x="36" y="36" width="${width - 72}" height="${height - 72}" rx="36" fill="none" stroke="url(#goldGrad)" stroke-width="3" opacity="0.6"/>
        <rect x="48" y="48" width="${width - 96}" height="${height - 96}" rx="28" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.15"/>

        <!-- Header -->
        <text x="${width / 2}" y="120" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="bold" fill="#fcd34d" letter-spacing="6">
          EK DUJE KE LIYE
        </text>
        <text x="${width / 2}" y="175" text-anchor="middle" font-family="'Georgia', serif" font-size="44" font-weight="bold" fill="#ffffff" letter-spacing="2">
          You are Cordially Invited
        </text>

        <!-- Main Invitation Container -->
        <rect x="80" y="210" width="${width - 160}" height="1020" rx="32" fill="url(#cardGrad)" filter="url(#shadow)"/>

        <!-- Couple Photo Frame -->
        ${couplePhotoDataUri ? `
          <g clip-path="url(#photoClip)">
            <image href="${couplePhotoDataUri}" x="290" y="240" width="500" height="420" preserveAspectRatio="xMidYMid slice"/>
          </g>
          <rect x="290" y="240" width="500" height="420" rx="32" fill="none" stroke="#e2e8f0" stroke-width="3"/>
        ` : `
          <rect x="290" y="240" width="500" height="420" rx="32" fill="#fff1f2" stroke="#fecdd3" stroke-width="3"/>
          <text x="${width / 2}" y="460" text-anchor="middle" font-family="'Georgia', serif" font-size="32" font-weight="bold" fill="#e11d48">
            Ek Duje Ke Liye
          </text>
        `}

        <!-- Couple Name -->
        <text x="${width / 2}" y="730" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#e11d48" letter-spacing="3">
          HONORED GUESTS
        </text>
        <text x="${width / 2}" y="785" text-anchor="middle" font-family="'Georgia', serif" font-size="42" font-weight="bold" fill="#1e293b">
          ${escapeXml(coupleTitle)}
        </text>

        <!-- Divider -->
        <line x1="340" y1="820" x2="740" y2="820" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="8 6"/>

        <!-- Invitation Body -->
        <text x="${width / 2}" y="870" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="500" fill="#64748b">
          We look forward to welcoming you to
        </text>
        <text x="${width / 2}" y="920" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="30" font-weight="bold" fill="#0f172a">
          ${escapeXml(eventName)}
        </text>

        <!-- Schedule & Venue Details -->
        <rect x="140" y="960" width="${width - 280}" height="150" rx="20" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>

        <text x="${width / 2}" y="1010" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="bold" fill="#be123c">
          🗓️ ${escapeXml(eventDate)}  •  ⏰ ${escapeXml(eventTime)}
        </text>
        <text x="${width / 2}" y="1065" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="600" fill="#334155">
          📍 ${escapeXml(venue)}
        </text>

        <!-- Footer Reference -->
        <text x="${width / 2}" y="1175" text-anchor="middle" font-family="'Courier New', monospace" font-size="16" font-weight="bold" fill="#94a3b8" letter-spacing="2">
          REGISTRATION ID: ${escapeXml(inquiryId)}
        </text>
        <text x="${width / 2}" y="1295" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#fcd34d" letter-spacing="4">
          EK DUJE KE LIYE &#8226; A SPECIAL PROGRAM FOR COUPLES
        </text>
      </svg>
    `;

    return Buffer.from(svgTemplate);
  }

  /**
   * Ensure invitation card metadata is updated on Registration
   * and high-resolution official invitation card image is rendered
   */
  async ensureInvitationCard(registrationOrInquiryId, eventParam = null) {
    let reg = registrationOrInquiryId;
    if (typeof registrationOrInquiryId === 'string') {
      reg = await Registration.findOne({ inquiryId: { $regex: new RegExp(`^${registrationOrInquiryId}$`, 'i') } });
    }
    if (!reg) return null;

    let event = eventParam;
    if (!event) {
      event = await eventService.getEventBySlug(reg.programId);
    }
    if (!event?.cardTemplate && !event?.cardTemplateUrl) {
      const fresh = await Event.findOne({
        $or: [
          { id: reg.programId },
          { slug: reg.programId },
          ...(reg.programDate && reg.programDate !== 'TBD' ? [{ date: reg.programDate }] : [])
        ]
      }).lean();
      if (fresh && (fresh.cardTemplate || fresh.cardTemplateUrl)) {
        event = { ...(event || {}), ...fresh };
      }
    }

    const hash = this.calculateInvitationHash(reg, event);

    if (svgCardCache.has(hash)) {
      const cached = svgCardCache.get(hash);
      return {
        ...cached,
        registration: reg,
        event
      };
    }

    if (!reg.invitationHash || reg.invitationHash !== hash) {
      reg.invitationHash = hash;
      reg.invitationVersion = (reg.invitationVersion || 0) + 1;
      reg.invitationGeneratedAt = new Date();
      await reg.save();
    }

    // Ensure the official high-resolution composite card is created and uploaded
    let cardUrl = reg.invitationCardUrl;
    if (!cardUrl || reg.invitationHash !== hash) {
      try {
        const imgRes = await this.ensureInvitationCardImage(reg, event);
        if (imgRes && imgRes.cardUrl) {
          cardUrl = imgRes.cardUrl;
        }
      } catch (err) {
        console.warn('[InvitationCardService] ensureInvitationCard image upload warning:', err.message);
      }
    }

    const buffer = await this.generateCardBuffer(reg, event);
    const resultObj = {
      buffer,
      registration: reg,
      event,
      version: reg.invitationVersion || 1,
      hash: reg.invitationHash,
      cardUrl: cardUrl || reg.invitationCardUrl || null
    };
    svgCardCache.set(hash, resultObj);
    return resultObj;
  }

  /**
   * Invalidate invitation if event details changed
   */
  async invalidateInvitationIfNeeded(inquiryId, event) {
    const reg = await Registration.findOne({ inquiryId: { $regex: new RegExp(`^${inquiryId}$`, 'i') } });
    if (!reg) return false;

    const currentHash = this.calculateInvitationHash(reg, event);
    if (reg.invitationHash && reg.invitationHash !== currentHash) {
      reg.invitationHash = null; // Forces regeneration on next fetch
      reg.invitationCardUrl = null;
      await reg.save();
      return true;
    }
    return false;
  }

  /**
   * Generate official EDKL invitation card buffer by compositing the card template PNG,
   * the couple's photo inside the transparent heart window, and gold CPL inquiryId text
   */
  async generateOfficialCardBuffer(registration, event) {
    const width = 576;
    const height = 1024;
    const inquiryId = registration.inquiryId || 'EDKL';

    const hX = event?.heartX ?? 157;
    const hY = event?.heartY ?? 91;
    const hW = event?.heartWidth ?? 260;
    const hH = event?.heartHeight ?? 312;

    // 1. Resolve and prepare template image with transparent heart cutout (In-Memory Cached)
    const tplUrl = event?.cardTemplateUrl || event?.cardTemplate || '';
    const cacheKey = `${tplUrl}_${hX}_${hY}_${hW}_${hH}`;
    let transparentTemplateBuf = transparentTemplateCache.get(cacheKey) || null;

    if (!transparentTemplateBuf && tplUrl && tplUrl.startsWith('http')) {
      try {
        const res = await fetch(tplUrl);
        if (res.ok) {
          const templateBuf = Buffer.from(await res.arrayBuffer());
          const { data: tplPixels } = await sharp(templateBuf)
            .resize(width, height, { fit: 'fill' })
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

          // Cut out the white/cream heart area so couple photo shows through cleanly
          for (let y = hY; y < hY + hH && y < height; y++) {
            for (let x = hX; x < hX + hW && x < width; x++) {
              const idx = (y * width + x) * 4;
              const r = tplPixels[idx];
              const g = tplPixels[idx + 1];
              const b = tplPixels[idx + 2];
              if (r > 215 && g > 215 && b > 215) {
                tplPixels[idx + 3] = 0; // Transparent
              }
            }
          }

          transparentTemplateBuf = await sharp(tplPixels, {
            raw: { width, height, channels: 4 }
          }).png().toBuffer();

          transparentTemplateCache.set(cacheKey, transparentTemplateBuf);
        }
      } catch (err) {
        console.warn('[InvitationCardService] Error preparing transparent template:', err.message);
      }
    }

    // 2. Resolve couple photo buffer: Direct R2 Buffer -> Remote URL -> Local Sample
    let photoBuf = null;
    const r2Media = registration.r2Media;
    if (r2Media && (r2Media.normalKey || r2Media.key)) {
      try {
        const targetBucket = r2Media.bucket || r2Provider.privateBucket;
        const targetKey = r2Media.normalKey || r2Media.key;
        photoBuf = await r2Provider.getObjectBuffer({ bucket: targetBucket, key: targetKey });
      } catch (err) {
        console.warn(`[InvitationCardService] Error loading photo from R2 for ${inquiryId}:`, err.message);
      }
    }

    if (!photoBuf) {
      const photoSrc = registration.couplePhoto;
      if (photoSrc && photoSrc.startsWith('http')) {
        try {
          const res = await fetch(photoSrc);
          if (res.ok) photoBuf = Buffer.from(await res.arrayBuffer());
        } catch (_) {}
      }
    }

    if (!photoBuf) {
      const p1 = path.resolve(process.cwd(), 'public', 'sample_couple.png');
      const p2 = path.resolve(process.cwd(), '..', 'frontend', 'public', 'sample_couple.png');
      const localPhoto = fs.existsSync(p1) ? p1 : fs.existsSync(p2) ? p2 : null;
      if (localPhoto) {
        photoBuf = fs.readFileSync(localPhoto);
      }
    }

    // 3. Resize couple photo to cover the heart area
    let resizedPhotoBuf = null;
    if (photoBuf) {
      try {
        resizedPhotoBuf = await sharp(photoBuf)
          .resize(hW, hH, { fit: 'cover', position: 'center' })
          .toBuffer();
      } catch (err) {
        console.warn(`[InvitationCardService] Error resizing couple photo for ${inquiryId}, falling back to sample photo:`, err.message);
        try {
          const p1 = path.resolve(process.cwd(), 'public', 'sample_couple.png');
          const p2 = path.resolve(process.cwd(), '..', 'frontend', 'public', 'sample_couple.png');
          const localPhoto = fs.existsSync(p1) ? p1 : fs.existsSync(p2) ? p2 : null;
          if (localPhoto) {
            resizedPhotoBuf = await sharp(localPhoto)
              .resize(hW, hH, { fit: 'cover', position: 'center' })
              .toBuffer();
          }
        } catch (_) {}
      }
    }
    if (!resizedPhotoBuf) {
      resizedPhotoBuf = await sharp({
        create: { width: hW, height: hH, channels: 4, background: { r: 255, g: 241, b: 242, alpha: 1 } }
      }).png().toBuffer();
    }

    // 4. Gold CPL text overlay
    const textX = Math.round(hX + hW / 2);
    const textY = Math.max(32, hY - 18);

    const textSvg = `
      <svg width="${width}" height="${height}">
        <text
          x="${textX}"
          y="${textY}"
          text-anchor="middle"
          dominant-baseline="middle"
          font-family="sans-serif"
          font-size="28"
          font-weight="900"
          stroke="#000000"
          stroke-width="5"
          stroke-linejoin="round"
          fill="#D4AF37"
        >${inquiryId}</text>
        <text
          x="${textX}"
          y="${textY}"
          text-anchor="middle"
          dominant-baseline="middle"
          font-family="sans-serif"
          font-size="28"
          font-weight="900"
          fill="#D4AF37"
        >${inquiryId}</text>
      </svg>
    `;
    const textBuf = Buffer.from(textSvg);

    // 5. Composite layers
    const layers = [
      { input: resizedPhotoBuf, left: hX, top: hY }
    ];
    if (transparentTemplateBuf) {
      layers.push({ input: transparentTemplateBuf, left: 0, top: 0 });
    }
    layers.push({ input: textBuf, left: 0, top: 0 });

    return await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .composite(layers)
      .jpeg({ quality: 92 })
      .toBuffer();
  }

  /**
   * Ensure a rendered high-resolution JPEG invitation card is uploaded to Cloudinary
   * and return its permanent public image URL for WhatsApp IMAGE headers
   */
  async ensureInvitationCardImage(registrationOrInquiryId, eventParam = null) {
    let reg = registrationOrInquiryId;
    if (typeof registrationOrInquiryId === 'string') {
      reg = await Registration.findOne({ inquiryId: { $regex: new RegExp(`^${registrationOrInquiryId}$`, 'i') } });
    }
    if (!reg) return null;

    let event = eventParam;
    if (!event || (!event.cardTemplate && !event.cardTemplateUrl)) {
      const searchConditions = [];
      if (reg.programId) searchConditions.push({ id: reg.programId }, { slug: reg.programId });
      if (reg.programDate && reg.programDate !== 'TBD') searchConditions.push({ date: reg.programDate });
      if (event?.id) searchConditions.push({ id: event.id });
      if (event?.slug) searchConditions.push({ slug: event.slug });

      const freshEvent = await Event.findOne({ $or: searchConditions }).lean();
      if (freshEvent) {
        event = { ...(event || {}), ...freshEvent };
      }
    }

    const hash = this.calculateInvitationHash(reg, event);

    // If already generated and hash matches, return existing URL
    if (reg.invitationCardUrl && reg.invitationHash === hash) {
      return {
        cardUrl: reg.invitationCardUrl,
        hash,
        version: reg.invitationVersion || 1
      };
    }

    // Generate official EDKL card composite with transparent heart cutout and gold CPL text
    const jpegBuffer = await this.generateOfficialCardBuffer(reg, event);

    // 128-bit opaque media identifier (Correction #2)
    const opaqueMediaId = crypto.randomBytes(16).toString('hex');
    const nextVersion = (reg.invitationVersion || 0) + 1;
    const eventKey = String(event?.slug || event?.id || reg.programId || 'EK06').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const cleanInquiryId = String(reg.inquiryId || 'TEMP').replace(/[^a-zA-Z0-9_-]/g, '');

    // Server-controlled immutable versioned key (Correction #6)
    // Never overwrite v1 on regeneration
    const targetKey = `prod/events/${eventKey}/registrations/${cleanInquiryId}/invitation/${opaqueMediaId}/invitation-v${nextVersion}.jpg`;

    try {
      // Direct R2 Public Bucket Upload (Zero Cloudinary write fallback)
      await r2Provider.putObject({
        bucket: r2Provider.publicBucket,
        key: targetKey,
        body: jpegBuffer,
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000, immutable'
      });

      // R2 HEAD verification
      const head = await r2Provider.headObject({
        bucket: r2Provider.publicBucket,
        key: targetKey
      });

      if (!head.exists || (head.contentLength || 0) <= 0) {
        throw new Error(`R2 HEAD verification failed for invitation card: ${targetKey}`);
      }

      const cardUrl = r2Provider.getPublicUrl(targetKey);

      reg.invitationHash = hash;
      reg.invitationCardUrl = cardUrl;
      reg.invitationKey = targetKey;
      reg.invitationOpaqueId = opaqueMediaId;
      reg.invitationVersion = nextVersion;
      reg.invitationGeneratedAt = new Date();
      await reg.save();

      return {
        cardUrl,
        hash,
        version: nextVersion,
        key: targetKey
      };
    } catch (uploadErr) {
      console.error(`[InvitationCardService] Critical: R2 upload failed for invitation card ${targetKey}:`, uploadErr.message);

      // Queue retry state without corrupting communication state (Correction #31)
      if (reg.r2Media) {
        reg.r2Media.status = 'MEDIA_UPLOAD_RETRY';
        await reg.save();
      }

      throw new Error(`[MEDIA_UPLOAD_RETRY] Failed to upload invitation card to R2: ${uploadErr.message}`);
    }
  }
}

export const invitationCardService = new InvitationCardService();

