"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useAction } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { MapPin, Globe, Phone, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Colour swatch for a tee name
const TEE_COLOUR_MAP: Record<string, string> = {
  white: "#f9fafb",
  yellow: "#fbbf24",
  red: "#ef4444",
  blue: "#3b82f6",
  black: "#111827",
  gold: "#d97706",
  silver: "#9ca3af",
  green: "#16a34a",
  other: "#6b7280",
};

function teeDotStyle(colour: string): React.CSSProperties {
  return {
    display: "inline-block",
    width: 10,
    height: 10,
    borderRadius: "50%",
    backgroundColor: TEE_COLOUR_MAP[colour] ?? TEE_COLOUR_MAP.other,
    border: "1px solid rgba(0,0,0,0.15)",
    flexShrink: 0,
  };
}

type Tee = {
  _id: string;
  name: string;
  colour: string;
  gender: string;
  par: number;
  courseRating?: number;
  slopeRating?: number;
  totalYards?: number;
};

type CourseWithTees = {
  _id: string;
  name: string;
  venueName?: string;
  slug: string;
  city?: string;
  county?: string;
  country: string;
  address?: string;
  numberOfHoles: number;
  par?: number;
  courseType?: string;
  website?: string;
  phone?: string;
  tees: Tee[];
};

function HandicapCalculator({ tees, coursePar }: { tees: Tee[]; coursePar?: number }) {
  const [handicapIndex, setHandicapIndex] = useState<string>("");

  const ratedTees = tees.filter(t => t.courseRating != null && t.slopeRating != null);

  const hcpValue = parseFloat(handicapIndex);
  const hasValidHcp = !isNaN(hcpValue) && hcpValue >= 0 && hcpValue <= 54;

  function calcPlayingHcp(tee: Tee): number {
    const slope = tee.slopeRating!;
    const cr = tee.courseRating!;
    const par = tee.par ?? coursePar ?? 72;
    return Math.round(hcpValue * (slope / 113) + (cr - par));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Playing Handicap Calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="hcp-input">Handicap Index</Label>
          <Input
            id="hcp-input"
            type="number"
            min={0}
            max={54}
            step={0.1}
            placeholder="e.g. 14.2"
            value={handicapIndex}
            onChange={e => setHandicapIndex(e.target.value)}
            className="w-36"
          />
        </div>

        {ratedTees.length === 0 ? (
          <p className="text-sm text-gray-400">No rating data available for this course yet</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">Tee</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500">Playing HC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ratedTees.map(tee => (
                  <tr key={tee._id}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span style={teeDotStyle(tee.colour)} />
                        <span className="font-medium text-gray-800">{tee.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                      {hasValidHcp ? calcPlayingHcp(tee) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CourseDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const data = useQuery(api.golfCourses.getBySlug, slug ? { slug } : "skip");
  const ensureDetail = useAction(api.golfCourses.ensureDetail);

  // Lazily fetch tee data the first time someone views a course with no tees
  useEffect(() => {
    if (data && (data as any).tees?.length === 0 && (data as any)._id) {
      ensureDetail({ courseId: (data as any)._id });
    }
  }, [(data as any)?._id, (data as any)?.tees?.length]);

  if (data === undefined) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        <div className="h-52 rounded-2xl bg-gray-200 animate-pulse" />
        <div className="h-48 rounded-xl bg-gray-100 animate-pulse" />
        <div className="h-32 rounded-xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-500 font-medium">Course not found</p>
        <Link href="/courses" className="text-sm text-green-700 hover:underline mt-2 inline-block">
          ← Back to courses
        </Link>
      </div>
    );
  }

  const course = data as CourseWithTees;

  // Sort tees by yardage descending (longest first), male/both before female
  const sortedTees = [...course.tees].sort((a, b) => {
    const genderA = a.gender === "female" ? 1 : 0;
    const genderB = b.gender === "female" ? 1 : 0;
    if (genderA !== genderB) return genderA - genderB;
    return (b.totalYards ?? -1) - (a.totalYards ?? -1);
  });

  // Prefer par from tees (more accurate for WHS) over course-level par
  const displayPar = sortedTees.length > 0
    ? (sortedTees.find(t => t.gender === "male")?.par ?? sortedTees[0].par)
    : course.par;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Breadcrumb */}
      <Link href="/courses" className="text-sm text-green-700 hover:underline inline-flex items-center gap-1">
        ← Golf Courses
      </Link>

      {/* Hero */}
      <div className="bg-green-900 rounded-2xl p-7 text-white space-y-3">
        <div>
          <h1 className="text-2xl font-bold leading-snug">{course.name}</h1>
          {course.venueName && (
            <p className="text-gray-300 text-sm mt-0.5">{course.venueName}</p>
          )}
        </div>

        {(course.city || course.county) && (
          <p className="flex items-center gap-1.5 text-gray-400 text-sm">
            <MapPin size={14} className="shrink-0" />
            {[course.city, course.county].filter(Boolean).join(", ")}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {course.courseType && course.courseType !== "other" && (
            <span className="bg-white/15 text-white text-xs font-medium px-2.5 py-1 rounded-full capitalize">
              {course.courseType}
            </span>
          )}
          <span className="bg-white/15 text-white text-xs font-medium px-2.5 py-1 rounded-full">
            {course.numberOfHoles} holes
          </span>
        </div>

        {displayPar && (
          <div className="flex items-center gap-2 pt-1">
            <Flag size={14} className="text-green-300" />
            <span className="text-lg font-bold">Par {displayPar}</span>
          </div>
        )}
      </div>

      {/* Tee Sets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tee Sets</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedTees.length === 0 ? (
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Tee data loading…</p>
              <p className="text-xs text-gray-400">
                Tee data is fetched automatically when this course is first used
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide">
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">Tee</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">Gender</th>
                    <th className="px-4 py-2.5 text-center font-medium text-gray-500">Par</th>
                    <th className="px-4 py-2.5 text-center font-medium text-gray-500">Course Rating</th>
                    <th className="px-4 py-2.5 text-center font-medium text-gray-500">Slope</th>
                    <th className="px-4 py-2.5 text-center font-medium text-gray-500">Yards</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedTees.map(tee => (
                    <tr key={tee._id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span style={teeDotStyle(tee.colour)} />
                          <span className="font-medium text-gray-800">{tee.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{tee.gender}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{tee.par}</td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {tee.courseRating ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {tee.slopeRating ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {tee.totalYards ? tee.totalYards.toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Handicap Calculator */}
      <HandicapCalculator tees={sortedTees} coursePar={displayPar} />

      {/* Course Info */}
      {(course.website || course.phone || course.address) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Course Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {course.website && (
              <a
                href={course.website.startsWith("http") ? course.website : `https://${course.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-sm text-green-700 hover:text-green-800 hover:underline"
              >
                <Globe size={15} className="shrink-0 text-gray-400" />
                {course.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            )}
            {course.phone && (
              <a
                href={`tel:${course.phone}`}
                className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-green-700"
              >
                <Phone size={15} className="shrink-0 text-gray-400" />
                {course.phone}
              </a>
            )}
            {course.address && (
              <p className="flex items-start gap-2.5 text-sm text-gray-600">
                <MapPin size={15} className="shrink-0 text-gray-400 mt-0.5" />
                {course.address}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Log a round CTA */}
      <div className="flex justify-start">
        <Button asChild className="bg-green-700 hover:bg-green-600 text-white">
          <Link href={`/rounds/new?courseId=${course._id}`}>
            <Flag size={15} className="mr-2" />
            Log a round here
          </Link>
        </Button>
      </div>
    </div>
  );
}
