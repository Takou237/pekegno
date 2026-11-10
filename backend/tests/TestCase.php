<?php

namespace Tests;

use App\Models\TreasuryTransaction;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Les commandes de rattrapage désactivent le verrou de clôture : chaque
        // test repart avec le verrou actif.
        TreasuryTransaction::$enforceCashClosing = true;
    }
}
