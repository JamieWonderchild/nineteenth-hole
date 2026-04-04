// types/patient.ts
import { Id } from 'convex/_generated/dataModel';

export interface PatientProfileSummary {
  lastEncounterDate: string;
  encounterCount: number;
  activeProblems: Array<{
    condition: string;
    status: string;
    icd10Code?: string;
  }>;
  allergies: Array<{
    allergen: string;
    reaction?: string;
    severity?: string;
  }>;
  buildStatus?: string;
}

export interface Patient {
  _id: Id<"patients">;
  name: string;
  dateOfBirth?: string;
  age: string;
  sex?: string;
  weight?: string;
  weightUnit?: string;
  mrn?: string;
  lastVisit?: string;
  profile?: PatientProfileSummary | null;
  medicalHistory?: Array<{
    date: string;
    type: string;
    notes: string;
    diagnosis?: string;
    treatment?: string;
    medications?: string[];
  }>;
}

export interface ConvexPatient {
  _id: Id<"patients">;
  name: string;
  dateOfBirth?: string;
  age?: string;
  sex?: string;
  mrn?: string;
  lastVisit?: string;
  profile?: PatientProfileSummary | null;
  medicalHistory: Array<{
    date: string;
    type: string;
    notes: string;
    diagnosis?: string;
    treatment?: string;
    medications?: string[];
  }>;
}

export const transformPatientData = (convexPatient: ConvexPatient): Patient => {
  // Build age display: prefer raw age string, then compute from DOB, then "Unknown"
  let age = "";
  if (convexPatient.age) {
    age = convexPatient.age;
  } else if (convexPatient.dateOfBirth) {
    const computed = computePatientAge(convexPatient.dateOfBirth);
    if (!isNaN(computed) && computed >= 0) {
      age = computed === 1 ? "1 year" : `${computed} years`;
    }
  }

  return {
    _id: convexPatient._id,
    name: convexPatient.name,
    dateOfBirth: convexPatient.dateOfBirth,
    age,
    sex: convexPatient.sex,
    mrn: convexPatient.mrn,
    lastVisit: convexPatient.lastVisit,
    profile: convexPatient.profile,
    medicalHistory: convexPatient.medicalHistory,
  };
};

// Helper function to compute age from dateOfBirth
export function computePatientAge(dateOfBirth: string): number {
  const birthDate = new Date(dateOfBirth);
  if (isNaN(birthDate.getTime())) return NaN;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}
