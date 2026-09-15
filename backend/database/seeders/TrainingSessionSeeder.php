<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\Trainer;
use App\Models\TrainingSession;
use Illuminate\Database\Seeder;

/**
 * Sessions de formation de démonstration pour les cours existants.
 * Idempotent : ne crée pas de doublons si des sessions existent déjà pour un cours.
 */
class TrainingSessionSeeder extends Seeder
{
    public function run(): void
    {
        $trainer = Trainer::query()->first();

        $sessions = [
            [
                'course_code' => 'CRS-FRM-001',
                'label' => 'Session Octobre',
                'start_at' => now()->addDays(15)->setTime(9, 0),
                'end_at' => now()->addDays(15)->setTime(17, 0),
                'max_capacity' => 20,
                'price' => 50000,
            ],
            [
                'course_code' => 'CRS-FRM-001',
                'label' => 'Session Novembre',
                'start_at' => now()->addDays(45)->setTime(9, 0),
                'end_at' => now()->addDays(45)->setTime(17, 0),
                'max_capacity' => 25,
                'price' => 50000,
            ],
            [
                'course_code' => 'CRS-FRM-002',
                'label' => 'Session Octobre',
                'start_at' => now()->addDays(20)->setTime(9, 0),
                'end_at' => now()->addDays(20)->setTime(17, 0),
                'max_capacity' => 15,
                'price' => 75000,
            ],
            [
                'course_code' => 'CRS-FRM-002',
                'label' => 'Session Décembre',
                'start_at' => now()->addDays(75)->setTime(9, 0),
                'end_at' => now()->addDays(75)->setTime(17, 0),
                'max_capacity' => 20,
                'price' => 75000,
            ],
        ];

        foreach ($sessions as $data) {
            $course = Course::where('code', $data['course_code'])->first();

            if (! $course) {
                continue;
            }

            TrainingSession::updateOrCreate(
                [
                    'course_id' => $course->id,
                    'start_at' => $data['start_at'],
                ],
                [
                    'agency_id' => $course->agency_id,
                    'trainer_id' => $trainer?->id,
                    'end_at' => $data['end_at'],
                    'max_capacity' => $data['max_capacity'],
                    'price' => $data['price'],
                    'status' => 'planned',
                ],
            );
        }

        $this->command?->info(sprintf(
            'Sessions de formation créées : %d.',
            TrainingSession::count(),
        ));
    }
}
