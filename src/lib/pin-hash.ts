import { createHmac } from 'crypto';

function getPinSecret(): string {
    const secret = process.env.PIN_HASH_SECRET;
    if (!secret) {
        throw new Error('PIN_HASH_SECRET 환경변수가 설정되지 않았습니다');
    }
    return secret;
}

/**
 * PIN을 HMAC-SHA256으로 해시하여 반환합니다.
 * 4자리 숫자 PIN은 브루트포스에 취약하므로 서버측 시크릿(pepper)을 사용합니다.
 */
export function hashPin(pin: string): string {
    return createHmac('sha256', getPinSecret()).update(pin).digest('hex');
}
