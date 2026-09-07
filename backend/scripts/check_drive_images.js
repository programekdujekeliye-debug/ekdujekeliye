const driveIds = [
  '1ijF8U5h3GBRfgja8AAULPm4i2i_MbCiN',
  '1zondksaq5IGfTPxRvcJ6LHl_TGac1_pt',
  '1lKgnBjyTGgCu3YQoLegc4mYmBZ2IKLaO',
  '1cAwRnibnL7EbsZztafIOK5UDW3L9UtuQ',
  '14gc8nLEvT83mLumVq8XvxCwb_qNM9vo1',
  '1avQzZKlNxgGPJlkYmn1Vpvh09Wii9pu9',
  '13rS2EsbAI2MF-ioho5mAC3QbzUyDpNUk',
  '1hVgU3KI-lZ9gSUj0Kc3MNKMKIkoe0ric',
  '16tzA0ONLnzLCWHkgSPgzaob8jIAwzDV1',
  '1_O2Rk-R3yvTmhWrjsUyGZh2qMA1ppw44',
  '1RjjIdkBBp1MLK7rEmNm2H2vPxg3X5kkB',
  '1_wClg00pEKr5pB-5Y9352QdnD6x4PBUH',
  '1ZDH-LmkW17-2scMo_mvEn0AD7AgW1HUh',
  '1EOKSGoGCx0wK7-AgnpkAJ31HpciTjIBK',
  '1_XfzWCvUI2ElZp0E4U1zNAWouJsJUR0Q',
  '1UtQu3cA_He7z7c5MxOoCIpByORGS__oy',
  '1J8zUzlHaFi3PWDkVwN0vGRVJgVQNCw6c',
  '1_vdQ1iPlbki_m3mu2Fc2GSuwIbfBDLJh',
  '10ZRtPbk4AjZmFWnyfCuP6J3HJpOW8AXA',
  '1sdGD72ftgt_u9guQZgbrcz8HTA_fkdn1',
  '18ix_TlQLyXGFkfUVRbRSYXn9MpID1tes',
  '1tzKIpe0KooCjuWJzQmFZe5z2mgdeM-D8',
  '1Rnd5fPpkOFgeh2mNJcGBsFDDv5G1HN2y',
  '1Be5fhKRIpl72VKMmcy2_1OXo_g2Dzs9g',
  '192NdwcmGExtHUTDtMCt7fG743T9VfrCs',
  '1ngykkWeS8G0XdCKmAYEem3aGP_8r9Lj4',
  '1NKxzTg-1MQ7t62fvtmekA91Snq05d_da',
  '1t0rkZQajWSL9GQziEqDyarEQ_SrenRGH',
  '1MFYu009jlunIAvtPBv5E2dQshnHnc6R7',
  '1PTj0ZkTRIiJAss7gzQonb5bDuPynIxfl',
  '10snmxi565Q290NvKjObsekTKTJwDRgWA',
  '1ZQqVDpSBKdjDw54cV9ozKxvU6aEGXmKV',
  '1FsEXCZp4KHvOcf9DZR-DfB1lkIQCd4Qf',
  '1lyCljaxeDtGIKkbgbH4BAk0___HlGBYm'
];

async function main() {
  console.log(`Checking ${driveIds.length} drive images...`);
  let okCount = 0;
  for (let i = 0; i < driveIds.length; i++) {
    const id = driveIds[i];
    try {
      const res = await fetch(`https://lh3.googleusercontent.com/d/${id}`, { method: 'HEAD' });
      if (res.ok) {
        okCount++;
      } else {
        console.warn(`[FAIL] Index ${i + 1} (${id}): HTTP ${res.status}`);
      }
    } catch (e) {
      console.warn(`[ERROR] Index ${i + 1} (${id}): ${e.message}`);
    }
  }
  console.log(`\nResult: ${okCount} / ${driveIds.length} photos are accessible.`);
}

main();
