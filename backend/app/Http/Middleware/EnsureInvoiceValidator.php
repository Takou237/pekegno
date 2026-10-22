<?php

namespace App\Http\Middleware;

use App\Support\InvoiceValidators;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureInvoiceValidator
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(
            InvoiceValidators::allows($request->user()?->role?->name),
            403,
            'Seuls le super-administrateur, le directeur général et le caissier peuvent valider les factures.'
        );

        return $next($request);
    }
}
