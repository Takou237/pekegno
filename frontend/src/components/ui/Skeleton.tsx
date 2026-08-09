import type { CSSProperties } from 'react';

type SkeletonProps = {
  className?: string;
  style?: CSSProperties;
};

function baseClass(className?: string) {
  return `animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--color-gray-200)_25%,var(--color-gray-100)_50%,var(--color-gray-200)_75%)] bg-[length:400px_100%] bg-no-repeat dark:bg-[linear-gradient(90deg,rgb(29,41,57)_25%,rgb(38,50,70)_50%,rgb(29,41,57)_75%)] ${
    className ?? ''
  }`;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return <div aria-hidden="true" className={baseClass(className)} style={style} />;
}

export function SkeletonText({ className }: SkeletonProps) {
  return <Skeleton className={`h-3.5 ${className ?? ''}`} />;
}

export function SkeletonCircle({ className }: SkeletonProps) {
  return <Skeleton className={`h-10 w-10 rounded-full ${className ?? ''}`} />;
}

export function SkeletonButton({ className }: SkeletonProps) {
  return <Skeleton className={`h-10 w-28 ${className ?? ''}`} />;
}

export function SkeletonPageHeader({ className }: SkeletonProps) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 ${className ?? ''}`}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex gap-3">
        <SkeletonButton />
        <SkeletonButton />
      </div>
    </div>
  );
}

export function SkeletonCards({ count = 6, className }: { count?: number } & SkeletonProps) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${className ?? ''}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center gap-3">
            <SkeletonCircle className="h-12 w-12" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 w-32" />
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, className }: { rows?: number } & SkeletonProps) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex gap-6 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-3.5 w-20" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-6 border-b border-gray-50 px-4 py-3.5 last:border-0 dark:border-gray-800/60"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonDetail({ className }: SkeletonProps) {
  return (
    <div className={`flex flex-col gap-6 ${className ?? ''}`}>
      <SkeletonPageHeader />
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-4">
          <SkeletonCircle className="h-16 w-16" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonDashboard({ className }: SkeletonProps) {
  return (
    <div className={`flex flex-col gap-6 ${className ?? ''}`}>
      <SkeletonPageHeader />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
          >
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <Skeleton className="h-5 w-40" />
        <div className="mt-6 flex h-56 items-end gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton
              key={index}
              className="w-full rounded-b-md"
              style={{ height: `${35 + ((index * 13) % 55)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonForm({ className }: SkeletonProps) {
  return (
    <div className={`flex flex-col gap-6 ${className ?? ''}`}>
      <SkeletonPageHeader />
      <div className="flex max-w-3xl flex-col gap-5 rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <div className="flex gap-3 pt-2">
          <SkeletonButton className="w-32" />
          <SkeletonButton className="w-32" />
        </div>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex min-h-[50vh] flex-col gap-6 p-4 sm:p-6">
      <SkeletonPageHeader />
      <SkeletonTable rows={4} />
    </div>
  );
}
