"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const UK_COUNTIES = [
  "London",
  "Surrey",
  "Kent",
  "Essex",
  "Middlesex",
  "Hampshire",
  "Yorkshire",
  "Lancashire",
  "Cheshire",
  "Warwickshire",
  "Berkshire",
  "Hertfordshire",
  "Oxfordshire",
  "Gloucestershire",
  "Wiltshire",
  "Somerset",
];

type GolfCourse = {
  _id: string;
  name: string;
  venueName?: string;
  slug: string;
  city?: string;
  county?: string;
  numberOfHoles: number;
  par?: number;
  courseType?: string;
};

function CourseCard({ course }: { course: GolfCourse }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="bg-white border border-gray-200 rounded-xl p-5 hover:border-green-400 hover:shadow-sm transition-all flex flex-col gap-2"
    >
      <div>
        <p className="font-semibold text-gray-900 leading-snug">{course.name}</p>
        {course.venueName && (
          <p className="text-sm text-gray-500 mt-0.5">{course.venueName}</p>
        )}
      </div>

      {(course.city || course.county) && (
        <p className="flex items-center gap-1 text-sm text-gray-500">
          <MapPin size={13} className="text-gray-400 shrink-0" />
          {[course.city, course.county].filter(Boolean).join(", ")}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap mt-auto pt-1">
        <span className="text-xs text-gray-600 font-medium">
          {course.numberOfHoles} holes
        </span>
        {course.courseType && course.courseType !== "other" && (
          <Badge variant="secondary" className="text-xs capitalize px-2 py-0.5">
            {course.courseType}
          </Badge>
        )}
      </div>
    </Link>
  );
}

export default function CoursesPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [county, setCounty] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const results = useQuery(
    api.golfCourses.search,
    debouncedQuery.length >= 2
      ? { query: debouncedQuery, county: county || undefined, limit: 30 }
      : "skip"
  );

  const hasQuery = debouncedQuery.length >= 2;

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Golf Courses</h1>
        <p className="text-gray-500 text-sm mt-0.5">Search 2,666 UK courses</p>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by course or club name…"
            className="pl-9"
          />
        </div>
        <select
          value={county}
          onChange={e => setCounty(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-48"
        >
          <option value="">All counties</option>
          {UK_COUNTIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Results */}
      {!hasQuery ? (
        <div className="text-center py-20 bg-white border border-dashed border-gray-200 rounded-xl">
          <Search size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Type to search courses</p>
          <p className="text-gray-400 text-sm mt-1">
            Enter at least 2 characters to find a course
          </p>
        </div>
      ) : results === undefined ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-500 font-medium">No courses found</p>
          <p className="text-gray-400 text-sm mt-1">
            Try a different name or remove the county filter
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400">
            {results.length} result{results.length !== 1 ? "s" : ""}
            {county ? ` in ${county}` : ""}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((course: GolfCourse) => (
              <CourseCard key={course._id} course={course} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
