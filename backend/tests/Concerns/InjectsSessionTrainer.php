<?php

namespace Tests\Concerns;

use App\Models\Role;
use App\Models\Trainer;
use App\Models\User;

/**
 * T8.5 rend le formateur obligatoire à la création d'une session. Les tests
 * qui vérifient un autre comportement n'ont pas à répéter un formateur : ce
 * trait l'ajoute quand la requête crée une session sans en fournir.
 */
trait InjectsSessionTrainer
{
    private ?Trainer $injectedSessionTrainer = null;

    public function postJson($uri, array $data = [], array $headers = [], $options = 0)
    {
        if (rtrim((string) $uri, '/') === '/api/training-sessions'
            && empty($data['trainer_id'])
            && empty($data['trainer_user_id'])) {
            $data['trainer_id'] = $this->injectedSessionTrainer()->id;
        }

        return parent::postJson($uri, $data, $headers, $options);
    }

    private function injectedSessionTrainer(): Trainer
    {
        if ($this->injectedSessionTrainer) {
            return $this->injectedSessionTrainer;
        }

        $user = User::factory()->create([
            'role_id' => Role::where('name', 'formateur')->value('id'),
        ]);

        return $this->injectedSessionTrainer = Trainer::create([
            'user_id' => $user->id,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'is_active' => true,
        ]);
    }
}
