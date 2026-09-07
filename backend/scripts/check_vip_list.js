import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';

const rawInput = `06/09/2026 19:09:50,Sanjay Amipara,Kiran amipara ,9909567904,https://drive.google.com/open?id=1ijF8U5h3GBRfgja8AAULPm4i2i_MbCiN
06/09/2026 19:11:18,Satish koladiya,Kiran koladiya,9377571161,https://drive.google.com/open?id=1zondksaq5IGfTPxRvcJ6LHl_TGac1_pt
06/09/2026 19:16:22,Mukesh Shekhada ,Bharti Shekhada ,9979943890,https://drive.google.com/open?id=1lKgnBjyTGgCu3YQoLegc4mYmBZ2IKLaO
06/09/2026 19:17:23,Nitin,Madhavi,9624552121,https://drive.google.com/open?id=1cAwRnibnL7EbsZztafIOK5UDW3L9UtuQ
06/09/2026 19:22:02,Naresh chhatraya ,Urmila chhatraya ,9375353897,https://drive.google.com/open?id=14gc8nLEvT83mLumVq8XvxCwb_qNM9vo1
06/09/2026 19:24:23,Vijay,Poonam,9819877354,https://drive.google.com/open?id=1avQzZKlNxgGPJlkYmn1Vpvh09Wii9pu9
06/09/2026 19:30:42,Sanjay Patel,Sejal Patel,9712950659,https://drive.google.com/open?id=13rS2EsbAI2MF-ioho5mAC3QbzUyDpNUk
06/09/2026 19:36:21,Amit desai,Nima desai,9825982206,https://drive.google.com/open?id=1hVgU3KI-lZ9gSUj0Kc3MNKMKIkoe0ric
06/09/2026 19:40:41,Mukesh himmatbhai narola,Tejal mukesh narola,7383236883,https://drive.google.com/open?id=16tzA0ONLnzLCWHkgSPgzaob8jIAwzDV1
06/09/2026 19:43:53,DILIP CHOVATIYA ,PARUL CHOVATIYA ,8866615588,https://drive.google.com/open?id=1_O2Rk-R3yvTmhWrjsUyGZh2qMA1ppw44
06/09/2026 19:52:45,Ankur Vekariya ,Jalpa Vekariya ,9925123334,https://drive.google.com/open?id=1RjjIdkBBp1MLK7rEmNm2H2vPxg3X5kkB
06/09/2026 19:55:51,Jaydip ,Mansi ,9624546317,https://drive.google.com/open?id=1_wClg00pEKr5pB-5Y9352QdnD6x4PBUH
06/09/2026 20:24:26,Mahesh kalkani,Sonal kalkani,9723996037,https://drive.google.com/open?id=1ZDH-LmkW17-2scMo_mvEn0AD7AgW1HUh
06/09/2026 20:41:27,Mukesh Goti,Chetana goti,9227104214,https://drive.google.com/open?id=1EOKSGoGCx0wK7-AgnpkAJ31HpciTjIBK
06/09/2026 20:42:42,Piyush,Radhika,9574299597,https://drive.google.com/open?id=1_XfzWCvUI2ElZp0E4U1zNAWouJsJUR0Q
06/09/2026 20:50:26,PANKAJ NAKRANI ,RINKU NAKRANI ,8200236323,https://drive.google.com/open?id=1UtQu3cA_He7z7c5MxOoCIpByORGS__oy
06/09/2026 20:55:06,Mahesh Goti,Palak Goti,9510389891,https://drive.google.com/open?id=1J8zUzlHaFi3PWDkVwN0vGRVJgVQNCw6c
06/09/2026 20:57:34,Manoj bharoy,Asha Bharodiya ,9898494154,https://drive.google.com/open?id=1_vdQ1iPlbki_m3mu2Fc2GSuwIbfBDLJh
06/09/2026 20:59:16,Jayesh bhai ,Vanita ben,9909781538,https://drive.google.com/open?id=10ZRtPbk4AjZmFWnyfCuP6J3HJpOW8AXA
06/09/2026 21:00:13,Paresh Nakrani,Alpa Nakrani,9913387575,https://drive.google.com/open?id=1sdGD72ftgt_u9guQZgbrcz8HTA_fkdn1
06/09/2026 21:00:30,Sanket maniya,Heena maniya,8141414951,https://drive.google.com/open?id=18ix_TlQLyXGFkfUVRbRSYXn9MpID1tes
06/09/2026 21:00:33,Rajesh Devani ,Jalpa Devani ,9904533703,https://drive.google.com/open?id=1tzKIpe0KooCjuWJzQmFZe5z2mgdeM-D8
06/09/2026 21:02:11,Mehul Virani ,Simpal Virani,9824186190,https://drive.google.com/open?id=1Rnd5fPpkOFgeh2mNJcGBsFDDv5G1HN2y
06/09/2026 21:14:16,Pradip Ajugiya ,Madhavi,7016389606,https://drive.google.com/open?id=1Be5fhKRIpl72VKMmcy2_1OXo_g2Dzs9g
06/09/2026 21:17:52,Jignesh Manani,Parul,7778910000,https://drive.google.com/open?id=192NdwcmGExtHUTDtMCt7fG743T9VfrCs
06/09/2026 21:21:26,Manish,Rushita,9825667839,https://drive.google.com/open?id=1ngykkWeS8G0XdCKmAYEem3aGP_8r9Lj4
06/09/2026 21:23:44,Manoj Makwana,Vasant Makwana,798446031,https://drive.google.com/open?id=1NKxzTg-1MQ7t62fvtmekA91Snq05d_da
06/09/2026 21:26:12,Jignesh Hirani ,Bhumika Hirani,9925437372,https://drive.google.com/open?id=1t0rkZQajWSL9GQziEqDyarEQ_SrenRGH
06/09/2026 21:27:50,Ramil Patel,Jigna Patel,9328035234,https://drive.google.com/open?id=1MFYu009jlunIAvtPBv5E2dQshnHnc6R7
06/09/2026 22:26:54,Lalji Lakkad ,Vilas Lakkad ,9824349958,https://drive.google.com/open?id=1PTj0ZkTRIiJAss7gzQonb5bDuPynIxfl
06/09/2026 23:23:33,Sohan Kalsariya,Surbhi Kalsariya ,8866688141,https://drive.google.com/open?id=10snmxi565Q290NvKjObsekTKTJwDRgWA
07/09/2026 00:34:22,Rasik Narola,Asha Narola ,9327147320,https://drive.google.com/open?id=1ZQqVDpSBKdjDw54cV9ozKxvU6aEGXmKV
07/09/2026 00:35:13,Kalpesh Dobariya ,Kiran Dobariya ,9974641956,https://drive.google.com/open?id=1FsEXCZp4KHvOcf9DZR-DfB1lkIQCd4Qf
07/09/2026 08:39:02,Satin italiya,Jalpa italiya,8866316499,https://drive.google.com/open?id=1lyCljaxeDtGIKkbgbH4BAk0___HlGBYm`;

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  console.log('Connected to Prod MongoDB\n');

  const lines = rawInput.trim().split('\n');
  console.log(`Total rows in input: ${lines.length}`);

  const parsed = [];
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const timestamp = parts[0]?.trim();
    const husband = parts[1]?.trim();
    const wife = parts[2]?.trim();
    const phone = parts[3]?.trim();
    const photoUrl = parts[4]?.trim();

    // Check if phone exists in DB
    const existing = await Registration.find({
      phoneNumber: { $regex: phone.slice(-10) }
    }).lean();

    parsed.push({
      row: i + 1,
      husband,
      wife,
      phone,
      digits: phone.replace(/\D/g, '').length,
      photoUrl,
      existingCount: existing.length,
      existingInquiries: existing.map(e => `${e.inquiryId} (${e.programId}, status: ${e.status})`)
    });
  }

  for (const p of parsed) {
    const warn = p.digits !== 10 ? `⚠️ PHONE LENGTH: ${p.digits} DIGITS!` : '';
    const dupWarn = p.existingCount > 0 ? `⚠️ ALREADY EXISTS: ${p.existingInquiries.join('; ')}` : 'NEW';
    console.log(`Row ${p.row}: ${p.husband} & ${p.wife} | Phone: ${p.phone} | ${dupWarn} ${warn}`);
  }

  process.exit(0);
}

main().catch(console.error);
