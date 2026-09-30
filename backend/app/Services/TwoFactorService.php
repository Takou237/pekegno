<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;

class TwoFactorService
{
    private const SECRET_LENGTH = 20;

    private const TOTP_PERIOD = 30;

    private const TOTP_DIGITS = 6;

    private const TOTP_WINDOW = 1;

    /** Durée de vie du code email (secondes). */
    public const EMAIL_CODE_TTL = 300;

    /** Tentatives maximales de saisie d'un code email. */
    public const EMAIL_MAX_ATTEMPTS = 5;

    /** Délai minimum entre deux envois (secondes). */
    public const EMAIL_RESEND_COOLDOWN = 60;

    private const EMAIL_CODE_KEY = '2fa_email_code:';

    private const EMAIL_SENT_AT_KEY = '2fa_email_sent_at:';

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

        return 'otpauth://totp/'.rawurlencode($issuer).':'.rawurlencode($email).'?'.$params;
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

    /**
     * Génère un code à 6 chiffres pour le canal email et stocke son hash en cache.
     * Le code en clair n'existe que le temps de l'envoi — jamais persisté.
     */
    public function issueEmailCode(User $user): string
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        Cache::put(self::EMAIL_CODE_KEY.$user->id, [
            'hash' => Hash::make($code),
            'attempts' => 0,
        ], self::EMAIL_CODE_TTL);

        Cache::put(self::EMAIL_SENT_AT_KEY.$user->id, now()->timestamp, self::EMAIL_RESEND_COOLDOWN);

        return $code;
    }

    /** Vérifie le code email ; consomme le code en cas de succès. */
    public function verifyEmailCode(User $user, string $code): bool
    {
        $code = trim($code);

        $payload = Cache::get(self::EMAIL_CODE_KEY.$user->id);

        if (! $payload || strlen($code) !== self::TOTP_DIGITS) {
            return false;
        }

        if (! Hash::check($code, $payload['hash'])) {
            $attempts = ($payload['attempts'] ?? 0) + 1;

            if ($attempts >= self::EMAIL_MAX_ATTEMPTS) {
                Cache::forget(self::EMAIL_CODE_KEY.$user->id);

                return false;
            }

            Cache::put(self::EMAIL_CODE_KEY.$user->id, array_merge($payload, ['attempts' => $attempts]), self::EMAIL_CODE_TTL);

            return false;
        }

        Cache::forget(self::EMAIL_CODE_KEY.$user->id);

        return true;
    }

    /** Secondes restantes avant de pouvoir renvoyer un code email (0 = autorisé). */
    public function emailResendCooldownRemaining(User $user): int
    {
        $sentAt = Cache::get(self::EMAIL_SENT_AT_KEY.$user->id);

        if (! $sentAt) {
            return 0;
        }

        return max(0, self::EMAIL_RESEND_COOLDOWN - (now()->timestamp - (int) $sentAt));
    }

    /** Supprime un code email en attente (ex. trop de tentatives). */
    public function forgetEmailCode(User $user): void
    {
        Cache::forget(self::EMAIL_CODE_KEY.$user->id);
    }

    /** Vérifie le code selon le canal configuré de l'utilisateur. */
    public function verifyCodeForUser(User $user, string $code): bool
    {
        if ($user->two_factor_channel === 'email') {
            return $this->verifyEmailCode($user, $code);
        }

        if (! $user->two_factor_secret) {
            return false;
        }

        return $this->verifyKey($this->decryptSecret($user->two_factor_secret), $code);
    }

    private function decryptSecret(string $encrypted): string
    {
        return Crypt::decrypt($encrypted);
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
