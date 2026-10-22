<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureInvoiceValidator
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(
            in_array($request->user()?->role?->name, ['super-admin', 'caissier'], true),
            403,
            'Seuls le super-administrateur et le caissier peuvent valider les factures.'
        );

        return $next($request);
    }
}
