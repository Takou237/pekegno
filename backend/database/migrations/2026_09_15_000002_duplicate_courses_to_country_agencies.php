<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Models\Course;

return new class extends Migration
{
    /**
     * Duplique les formations existantes dans toutes les agences du même pays,
     * afin que chaque agence du pays dispose de sa propre copie.
     */
    public function up(): void
    {
        $courses = DB::table('courses')->whereNull('deleted_at')->get();

        foreach ($courses as $course) {
            if (! $course->agency_id) {
                continue; // formation globale : déjà disponible partout
            }

            $countryId = DB::table('agencies')->where('id', $course->agency_id)->value('country_id');
            if (! $countryId) {
                continue;
            }

            $agencyIds = DB::table('agencies')
                ->where('country_id', $countryId)
                ->whereNull('deleted_at')
                ->where('id', '<>', $course->agency_id)
                ->pluck('id');

            foreach ($agencyIds as $agencyId) {
                $already = DB::table('courses')
                    ->where('agency_id', $agencyId)
                    ->where('code', $course->code)
                    ->whereNull('deleted_at')
                    ->exists();

                if ($already) {
                    continue;
                }

                $newId = (string) Str::uuid();

                DB::table('courses')->insert([
                    'id' => $newId,
                    'code' => Course::generateCode(),
                    'name' => $course->name,
                    'description' => $course->description,
                    'objective' => $course->objective,
                    'prerequisites' => $course->prerequisites,
                    'mode' => $course->mode,
                    'price' => $course->price,
                    'duration_hours' => $course->duration_hours,
                    'duration_type' => $course->duration_type,
                    'duration_months' => $course->duration_months,
                    'cover_image' => $course->cover_image,
                    'presentation_video' => $course->presentation_video,
                    'agency_id' => $agencyId,
                    'is_active' => $course->is_active,
                    'is_public' => $course->is_public,
                    'slug' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $categoryIds = DB::table('course_course_category')
                    ->where('course_id', $course->id)
                    ->pluck('course_category_id');

                foreach ($categoryIds as $categoryId) {
                    DB::table('course_course_category')->insert([
                        'course_id' => $newId,
                        'course_category_id' => $categoryId,
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        // Pas de retour arrière : suppression des copies manuelle (non reproductible).
    }
};