<?php

namespace App\Services;

class TwoFactorService
{
    private const SECRET_LENGTH = 20;
    private const TOTP_PERIOD = 30;
    private const TOTP_DIGITS = 6;
    private const TOTP_WINDOW = 1;

    public function generateSecretKey(): string
    {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $secret = '';

        for ($i = 0; $i < self::SECRET_LENGTH; $i++) {
            $secret .= $chars[random_int(0, 31)];
        }

        return $secret;
    }

    public function getQRCodeUrl(string $email, string $secret, string $issuer = 'PEKEGNO'): string
    {
        $params = http_build_query([
            'secret' => $secret,
            'issuer' => $issuer,
            'algorithm' => 'SHA1',
            'digits' => self::TOTP_DIGITS,
            'period' => self::TOTP_PERIOD,
        ]);

        return 'otpauth://totp/' . rawurlencode($issuer) . ':' . rawurlencode($email) . '?' . $params;
    }

    public function verifyKey(string $secret, string $key): bool
    {
        $key = (string) $key;
        if (strlen($key) !== self::TOTP_DIGITS) {
            return false;
        }

        $currentTime = floor(time() / self::TOTP_PERIOD);

        for ($i = -self::TOTP_WINDOW; $i <= self::TOTP_WINDOW; $i++) {
            $calculatedKey = $this->generateTotp($secret, $currentTime + $i);

            if (hash_equals($calculatedKey, $key)) {
                return true;
            }
        }

        return false;
    }

    private function generateTotp(string $secret, int $time): string
    {
        $timeHex = str_pad(dechex($time), 16, '0', STR_PAD_LEFT);
        $timeBytes = hex2bin($timeHex);

        $hmac = hash_hmac('sha1', $timeBytes, $this->base32Decode($secret), true);

        $offset = ord($hmac[strlen($hmac) - 1]) & 0x0F;
        $hashPart = substr($hmac, $offset, 4);

        $value = unpack('N', $hashPart)[1];
        $value = $value & 0x7FFFFFFF;

        $otp = $value % pow(10, self::TOTP_DIGITS);

        return str_pad((string) $otp, self::TOTP_DIGITS, '0', STR_PAD_LEFT);
    }

    private function base32Decode(string $input): string
    {
        $map = [
            'A' => 0, 'B' => 1, 'C' => 2, 'D' => 3, 'E' => 4, 'F' => 5,
            'G' => 6, 'H' => 7, 'I' => 8, 'J' => 9, 'K' => 10, 'L' => 11,
            'M' => 12, 'N' => 13, 'O' => 14, 'P' => 15, 'Q' => 16, 'R' => 17,
            'S' => 18, 'T' => 19, 'U' => 20, 'V' => 21, 'W' => 22, 'X' => 23,
            'Y' => 24, 'Z' => 25, '2' => 26, '3' => 27, '4' => 28, '5' => 29,
            '6' => 30, '7' => 31,
        ];

        $input = strtoupper(trim($input, '='));
        $buffer = 0;
        $bitsLeft = 0;
        $output = '';

        for ($i = 0, $len = strlen($input); $i < $len; $i++) {
            $val = $map[$input[$i]] ?? null;
            if ($val === null) {
                continue;
            }

            $buffer = ($buffer << 5) | $val;
            $bitsLeft += 5;

            if ($bitsLeft >= 8) {
                $bitsLeft -= 8;
                $output .= chr(($buffer >> $bitsLeft) & 0xFF);
            }
        }

        return $output;
    }
}
