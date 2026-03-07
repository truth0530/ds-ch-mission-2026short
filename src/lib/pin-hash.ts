import { createHmac } from 'crypto';

const PIN_SECRET = process.env.PIN_HASH_SECRET || 'ds-ch-tour-2026-pin-secret';

/**
 * PIN을 HMAC-SHA256으로 해시하여 반환합니다.
 * 4자리 숫자 PIN은 브루트포스에 취약하므로 서버측 시크릿(pepper)을 사용합니다.
 */
export function hashPin(pin: string): string {
    return createHmac('sha256', PIN_SECRET).update(pin).digest('hex');
}
