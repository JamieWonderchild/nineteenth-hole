// DrugBank Expert Integration
// Uses Corti's built-in DrugBank expert for clinical pharmacology

import type { CortiExpertReference, CortiTextPart } from '@/types/corti';
import type { Medication } from '@/types/agents';

/**
 * Configuration for Corti's built-in DrugBank expert
 * Customized with clinical-focused system prompt for human medicine
 */
export const DRUGBANK_EXPERT_CONFIG: CortiExpertReference = {
  type: 'reference',
  name: 'drugbank',
  systemPrompt: `You are a clinical pharmacology specialist. When querying drug information:

1. PATIENT-SPECIFIC CONSIDERATIONS:
   - Flag renal dose adjustments (use CrCl thresholds)
   - Flag hepatic dose adjustments (Child-Pugh class)
   - Note age-related considerations (pediatric, geriatric)
   - Highlight high-alert medications (anticoagulants, insulin, opioids, chemotherapy)

2. REQUIRED INFORMATION:
   - Mechanism of action
   - FDA-approved indications and formulations
   - Standard adult dosing (with renal/hepatic adjustments)
   - Route of administration options
   - Duration of treatment
   - Common and serious side effects
   - Drug interactions
   - Contraindications

3. SAFETY ALERTS:
   - Pregnancy category / teratogenicity risk
   - Breastfeeding safety
   - Pediatric dosing and safety
   - Geriatric adjustments (Beers Criteria flags)
   - Pharmacogenomic considerations (CYP2D6, CYP2C19, G6PD, etc.)

4. FORMATTING:
   - Provide doses in standard clinical units (mg, mcg, units)
   - Include frequency (once daily, BID, TID, etc.)
   - Note narrow therapeutic index drugs where applicable`
};

/**
 * High-alert drug safety flags for human medicine
 */
export const HIGH_ALERT_DRUGS: Record<string, string> = {
  'warfarin': 'Narrow therapeutic index — monitor INR closely; numerous drug and food interactions',
  'heparin': 'High-alert anticoagulant — verify weight-based dosing; risk of HIT',
  'insulin': 'High-alert — verify type, dose, and route; risk of hypoglycemia',
  'methotrexate': 'High-alert — weekly dosing for non-oncology indications; daily dosing errors are fatal',
  'lithium': 'Narrow therapeutic index — monitor serum levels; dehydration increases toxicity',
  'digoxin': 'Narrow therapeutic index — renal dose adjustment required; monitor levels',
  'aminoglycosides': 'Nephrotoxic and ototoxic — dose based on renal function; monitor peak/trough',
  'vancomycin': 'Nephrotoxic — dose based on renal function; monitor AUC/MIC',
  'phenytoin': 'Narrow therapeutic index — non-linear pharmacokinetics; monitor levels',
};

/**
 * Pharmacogenomic drug-gene pairs relevant in human medicine
 */
export const PHARMACOGENOMIC_FLAGS: Record<string, string> = {
  'codeine': 'CYP2D6 — poor metabolizers have reduced analgesia; ultra-rapid metabolizers risk toxicity',
  'tramadol': 'CYP2D6 — variable efficacy and safety based on metabolizer status',
  'clopidogrel': 'CYP2C19 — poor metabolizers have reduced antiplatelet effect; consider alternative',
  'warfarin': 'CYP2C9 / VKORC1 — genotype influences starting dose',
  'simvastatin': 'SLCO1B1 — poor function alleles increase myopathy risk at high doses',
  'abacavir': 'HLA-B*57:01 — test before prescribing; risk of severe hypersensitivity',
  'carbamazepine': 'HLA-B*15:02 — test in patients of Asian ancestry; risk of Stevens-Johnson syndrome',
};

/**
 * Build a drug information query for the DrugBank expert
 */
export function buildDrugQueryPrompt(params: {
  drug: string;
  indication?: string;
  weightKg?: number;
  age?: string;
  renalFunction?: string;
  hepaticFunction?: string;
  currentMedications?: string[];
}): string {
  const { drug, indication, weightKg, age, renalFunction, hepaticFunction, currentMedications } = params;

  let prompt = `Provide comprehensive clinical pharmacology information for ${drug}.`;

  if (age) {
    prompt += `\nPatient age: ${age}`;
  }

  if (weightKg) {
    prompt += `\nPatient weight: ${weightKg} kg`;
  }

  if (renalFunction) {
    prompt += `\nRenal function: ${renalFunction} — provide appropriate dose adjustment`;
  }

  if (hepaticFunction) {
    prompt += `\nHepatic function: ${hepaticFunction} — provide appropriate dose adjustment`;
  }

  if (indication) {
    prompt += `\nIndication: ${indication}`;
  }

  if (currentMedications && currentMedications.length > 0) {
    prompt += `\nCurrent medications (check interactions): ${currentMedications.join(', ')}`;
  }

  // Check for pharmacogenomic flags
  const drugLower = drug.toLowerCase();
  for (const [pgxDrug, pgxNote] of Object.entries(PHARMACOGENOMIC_FLAGS)) {
    if (drugLower.includes(pgxDrug)) {
      prompt += `\n⚠️ Pharmacogenomic note: ${pgxNote}`;
    }
  }

  // Check for high-alert flags
  for (const [alertDrug, alertNote] of Object.entries(HIGH_ALERT_DRUGS)) {
    if (drugLower.includes(alertDrug)) {
      prompt += `\n🔴 HIGH ALERT: ${alertNote}`;
    }
  }

  prompt += `

Please provide:
1. Mechanism of action
2. Standard adult dosing
3. Renal and hepatic dose adjustments
4. Route and frequency
5. Duration for this indication
6. Contraindications
7. Drug interactions
8. Side effects to monitor
9. Pregnancy / breastfeeding safety
10. Any pharmacogenomic or Beers Criteria considerations`;

  return prompt;
}

/**
 * Calculate dose based on weight
 */
export function calculateDose(params: {
  dosePerKg: number;
  weightKg: number;
  unit?: string;
  roundTo?: number;
}): { calculatedDose: number; calculation: string } {
  const { dosePerKg, weightKg, unit = 'mg', roundTo = 2 } = params;

  const rawDose = dosePerKg * weightKg;
  const calculatedDose = Math.round(rawDose * Math.pow(10, roundTo)) / Math.pow(10, roundTo);

  return {
    calculatedDose,
    calculation: `${dosePerKg} ${unit}/kg × ${weightKg} kg = ${calculatedDose} ${unit}`
  };
}

/**
 * Check for drug safety flags relevant to the patient
 */
export function checkContraindications(
  drug: string,
  patientContext?: { age?: string; renalFunction?: string; hepaticFunction?: string }
): string[] {
  const warnings: string[] = [];
  const drugLower = drug.toLowerCase();

  // Check high-alert drugs
  for (const [alertDrug, alertNote] of Object.entries(HIGH_ALERT_DRUGS)) {
    if (drugLower.includes(alertDrug)) {
      warnings.push(`🔴 HIGH ALERT: ${alertNote}`);
    }
  }

  // Check pharmacogenomic flags
  for (const [pgxDrug, pgxNote] of Object.entries(PHARMACOGENOMIC_FLAGS)) {
    if (drugLower.includes(pgxDrug)) {
      warnings.push(`⚠️ Pharmacogenomics: ${pgxNote}`);
    }
  }

  // Geriatric Beers Criteria flags
  if (patientContext?.age) {
    const ageNum = parseInt(patientContext.age);
    if (!isNaN(ageNum) && ageNum >= 65) {
      const beersFlagged: Record<string, string> = {
        'benzodiazepine': 'Beers Criteria: Avoid in older adults — fall risk, cognitive impairment',
        'diphenhydramine': 'Beers Criteria: Avoid in older adults — anticholinergic, sedation risk',
        'nsaid': 'Beers Criteria: Use with caution ≥65 — GI bleeding, renal, and cardiovascular risk',
        'meperidine': 'Beers Criteria: Avoid — neurotoxic metabolite accumulates in older adults',
      };
      for (const [flag, note] of Object.entries(beersFlagged)) {
        if (drugLower.includes(flag)) {
          warnings.push(`⚠️ ${note}`);
        }
      }
    }
  }

  return warnings;
}

/**
 * Parse drug information from DrugBank expert response
 */
export function parseDrugBankResponse(taskMessage: { parts: Array<CortiTextPart | { type: string }> }): Partial<Medication> {
  const textPart = taskMessage.parts.find((p): p is CortiTextPart => p.type === 'text');
  const text = textPart?.text || '';

  return {
    drug: extractField(text, 'drug name', 'name'),
    drugClass: extractField(text, 'class', 'mechanism'),
    dose: extractField(text, 'dose', 'dosing', 'dosage'),
    route: extractRoute(text),
    frequency: extractField(text, 'frequency', 'interval'),
    duration: extractField(text, 'duration', 'length of treatment'),
    contraindications: extractList(text, 'contraindication'),
    interactions: extractList(text, 'interaction'),
    sideEffects: extractList(text, 'side effect', 'adverse'),
    monitoringRequired: extractField(text, 'monitoring', 'monitor'),
  };
}

function extractField(text: string, ...keywords: string[]): string | undefined {
  for (const keyword of keywords) {
    const pattern = new RegExp(`${keyword}[s]?[:\\s]+([^\\n]+)`, 'i');
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}

function extractRoute(text: string): Medication['route'] | undefined {
  const routes: Array<{ pattern: RegExp; route: Medication['route'] }> = [
    { pattern: /\bPO\b|oral|by mouth/i, route: 'PO' },
    { pattern: /\bSQ\b|\bSC\b|subcutaneous/i, route: 'SQ' },
    { pattern: /\bIM\b|intramuscular/i, route: 'IM' },
    { pattern: /\bIV\b|intravenous/i, route: 'IV' },
    { pattern: /topical/i, route: 'topical' },
    { pattern: /ophthalmic|eye/i, route: 'ophthalmic' },
    { pattern: /otic|ear/i, route: 'otic' },
    { pattern: /rectal/i, route: 'rectal' },
  ];

  for (const { pattern, route } of routes) {
    if (pattern.test(text)) {
      return route;
    }
  }
  return undefined;
}

function extractList(text: string, ...keywords: string[]): string[] {
  const items: string[] = [];

  for (const keyword of keywords) {
    const pattern = new RegExp(`${keyword}[s]?[:\\s]*([^\\n]+(?:\\n[-•]\\s*[^\\n]+)*)`, 'gi');
    const matches = text.matchAll(pattern);

    for (const match of matches) {
      if (match[1]) {
        // Split by bullet points or newlines
        const listItems = match[1].split(/[-•]\s*|\n/).filter(item => item.trim());
        items.push(...listItems.map(item => item.trim()));
      }
    }
  }

  return [...new Set(items)]; // Remove duplicates
}

/**
 * Format drug information for display
 */
export function formatDrugInfo(medication: Partial<Medication>): string {
  const lines: string[] = [];

  if (medication.drug) lines.push(`**${medication.drug}**`);
  if (medication.drugClass) lines.push(`Class: ${medication.drugClass}`);
  if (medication.dose) lines.push(`Dose: ${medication.dose}`);
  if (medication.doseCalculation) lines.push(`Calculation: ${medication.doseCalculation}`);
  if (medication.route) lines.push(`Route: ${medication.route}`);
  if (medication.frequency) lines.push(`Frequency: ${medication.frequency}`);
  if (medication.duration) lines.push(`Duration: ${medication.duration}`);

  if (medication.contraindications && medication.contraindications.length > 0) {
    lines.push(`\n⚠️ Contraindications:\n- ${medication.contraindications.join('\n- ')}`);
  }

  if (medication.interactions && medication.interactions.length > 0) {
    lines.push(`\n💊 Interactions:\n- ${medication.interactions.join('\n- ')}`);
  }

  if (medication.sideEffects && medication.sideEffects.length > 0) {
    lines.push(`\n📋 Side Effects:\n- ${medication.sideEffects.join('\n- ')}`);
  }

  if (medication.monitoringRequired) {
    lines.push(`\n🔍 Monitoring: ${medication.monitoringRequired}`);
  }

  return lines.join('\n');
}
