/**
 * 기존 평문 PIN(manage_token)을 HMAC-SHA256 해시로 변환하는 마이그레이션 스크립트
 *
 * 실행 방법:
 *   npx tsx scripts/migrate-pin-hash.ts
 *
 * 환경변수:
 *   NEXT_PUBLIC_SUPABASE_URL - Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service Role Key
 *   PIN_HASH_SECRET - (필수) 해시 시크릿
 *
 * 동작:
 *   1. active 상태의 예약 중 manage_token이 4자리 숫자인 행을 조회
 *   2. 각 행의 manage_token을 HMAC-SHA256 해시로 변환하여 업데이트
 *   3. 이미 해시된 값(64자 hex)은 건너뜀
 */

import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIN_SECRET = process.env.PIN_HASH_SECRET;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !PIN_SECRET) {
    console.error('환경변수를 설정해주세요: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PIN_HASH_SECRET');
    process.exit(1);
}

function hashPin(pin: string): string {
    return createHmac('sha256', PIN_SECRET!).update(pin).digest('hex');
}

async function main() {
    const client = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    // active 예약 조회
    const { data: reservations, error } = await client
        .from('tour_reservations')
        .select('id, name, manage_token, status')
        .eq('status', 'active');

    if (error) {
        console.error('조회 실패:', error.message);
        process.exit(1);
    }

    if (!reservations || reservations.length === 0) {
        console.log('변환할 active 예약이 없습니다.');
        return;
    }

    console.log(`총 ${reservations.length}개 active 예약 발견`);

    let updated = 0;
    let skipped = 0;

    for (const r of reservations) {
        // 이미 해시된 값(64자 hex)이면 건너뜀
        if (/^[0-9a-f]{64}$/.test(r.manage_token)) {
            console.log(`  [건너뜀] ${r.name} - 이미 해시됨`);
            skipped++;
            continue;
        }

        // 4자리 숫자 PIN인 경우만 변환
        if (/^\d{4}$/.test(r.manage_token)) {
            const hashed = hashPin(r.manage_token);
            const { error: updateError } = await client
                .from('tour_reservations')
                .update({ manage_token: hashed })
                .eq('id', r.id);

            if (updateError) {
                console.error(`  [실패] ${r.name}: ${updateError.message}`);
            } else {
                console.log(`  [변환] ${r.name}: ${r.manage_token} -> ${hashed.substring(0, 16)}...`);
                updated++;
            }
        } else {
            // 4자리 숫자도 아니고 해시도 아닌 경우 (이전 랜덤 hex 토큰 등)
            console.log(`  [경고] ${r.name}: 알 수 없는 형식 (${r.manage_token.substring(0, 8)}...) - 수동 확인 필요`);
            skipped++;
        }
    }

    console.log(`\n완료: ${updated}개 변환, ${skipped}개 건너뜀`);
}

main().catch(console.error);
