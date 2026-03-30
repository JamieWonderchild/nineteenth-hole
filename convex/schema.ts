import { v } from "convex/values";
import { defineSchema, defineTable } from "convex/server";

export default defineSchema({
  // ============================================================================
  // Organizations & Billing
  // ============================================================================
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    clerkOrgId: v.optional(v.string()),
    // Billing
    plan: v.string(), // 'solo' | 'practice' | 'multi-location'
    billingStatus: v.string(), // 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete'
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    trialEndsAt: v.optional(v.string()),
    // Limits
    maxProviderSeats: v.number(),
    // Clinic info
    clinicName: v.optional(v.string()),
    clinicPhone: v.optional(v.string()),
    clinicEmail: v.optional(v.string()),
    clinicAddress: v.optional(v.string()),
    emergencyPhone: v.optional(v.string()),
    // Billing configuration
    billingCurrency: v.optional(v.string()), // "USD", "EUR", "GBP", "CAD", "AUD", "NZD", "ZAR"

    /**
     * Tax configuration for client invoices
     *
     * Two tax calculation modes:
     *
     * 1. TAX-EXCLUSIVE (includedInPrices: false)
     *    - Catalog prices DO NOT include tax
     *    - Tax is ADDED at checkout
     *    - Example: $100 item + 20% tax = $120 total
     *    - Formula: taxAmount = price * (rate / 100)
     *               total = price + taxAmount
     *
     * 2. TAX-INCLUSIVE (includedInPrices: true)
     *    - Catalog prices ALREADY include tax
     *    - Tax is EXTRACTED for display purposes only
     *    - Example: $100 item includes $16.67 tax (20%) = $100 total
     *    - Formula: taxAmount = price * (rate / (100 + rate))
     *               priceWithoutTax = price - taxAmount
     *               total = price (unchanged)
     *
     * Most countries use one approach consistently:
     * - USA, Canada: Tax-exclusive (added at checkout)
     * - EU, UK, Australia: Tax-inclusive (VAT included in prices)
     */
    taxSettings: v.optional(v.object({
      enabled: v.boolean(),
      rate: v.number(),              // 8.5 = 8.5% tax rate
      name: v.string(),              // "Sales Tax", "VAT", "GST"
      currency: v.string(),          // "USD", "EUR", "GBP", "CAD", etc.
      includedInPrices: v.boolean(), // true = tax-inclusive, false = tax-exclusive
    })),
    // Setup & Migration tracking
    needsLocationReview: v.optional(v.boolean()),
    migratedAt: v.optional(v.string()),
    lastPlanChange: v.optional(v.object({
      fromPlan: v.string(),
      toPlan: v.string(),
      changedAt: v.string(),
      wizardCompleted: v.boolean(),
    })),
    // Timestamps
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_clerk_org", ["clerkOrgId"])
    .index("by_slug", ["slug"])
    .index("by_stripe_customer", ["stripeCustomerId"])
    .index("by_billing_status", ["billingStatus"]),

  memberships: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(), // Clerk user ID
    role: v.string(), // 'owner' | 'admin' | 'practice-admin' | 'provider'
    status: v.string(), // 'active' | 'pending' | 'deactivated'
    locationIds: v.optional(v.array(v.id("locations"))), // null/empty = org-wide, [...] = location-scoped
    invitedBy: v.optional(v.string()),
    invitedAt: v.optional(v.string()),
    joinedAt: v.optional(v.string()),
    lastSeenAt: v.optional(v.string()), // Track first login for welcome experience
    archivedAt: v.optional(v.string()), // Set when membership is archived due to plan downgrade
    archivedReason: v.optional(v.string()), // Reason for archiving (e.g., 'plan_downgrade', 'removed_by_admin')
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["orgId", "userId"]),

  locations: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    isDefault: v.boolean(),
    archivedAt: v.optional(v.string()), // Set when location is archived due to plan downgrade
    archivedReason: v.optional(v.string()), // Reason for archiving (e.g., 'plan_downgrade')
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_org", ["orgId"]),

  usageRecords: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(),
    type: v.string(), // 'encounter' | 'companion' | 'document'
    billingPeriodStart: v.string(),
    createdAt: v.string(),
  }).index("by_org_period", ["orgId", "billingPeriodStart"])
    .index("by_org_type_period", ["orgId", "type", "billingPeriodStart"]),

  billingCatalog: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),              // "CBC Panel", "Comprehensive Exam"
    code: v.string(),              // "LAB-001", "EXAM-001"
    category: v.string(),          // 'em' | 'exam' | 'procedure' | 'critical-care' | 'observation' | 'lab' | 'medication' | 'supply' | 'imaging' | 'hospitalization' | 'other'
    basePrice: v.number(),         // In cents (4500 = $45.00)
    taxable: v.boolean(),          // Should tax be applied to this item?
    description: v.optional(v.string()),
    isActive: v.boolean(),         // Soft delete flag
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_active", ["orgId", "isActive"])
    .index("by_org_category", ["orgId", "category"])
    .index("by_org_code", ["orgId", "code"]),

  processedWebhookEvents: defineTable({
    eventId: v.string(),
    source: v.string(), // 'stripe' | 'clerk'
    processedAt: v.string(),
  }).index("by_event_id", ["eventId"]),

  invitations: defineTable({
    orgId: v.id("organizations"),
    email: v.string(),
    role: v.string(), // 'admin' | 'provider' | 'practice-admin'
    token: v.string(), // Secure random token
    status: v.string(), // 'pending' | 'accepted' | 'expired' | 'cancelled'
    invitedBy: v.string(), // Clerk user ID
    inviterName: v.string(), // For display in email
    locationIds: v.optional(v.array(v.id("locations"))), // For practice-admin
    acceptedBy: v.optional(v.string()), // Clerk user ID who accepted
    acceptedAt: v.optional(v.string()),
    expiresAt: v.string(), // 7 days from creation
    cancelledAt: v.optional(v.string()),
    createdAt: v.string(),
  }).index("by_token", ["token"])
    .index("by_org", ["orgId"])
    .index("by_email_org", ["email", "orgId"])
    .index("by_status", ["status"]),

  // ============================================================================
  // Providers
  // ============================================================================
  providers: defineTable({
    userId: v.string(),
    name: v.string(),
    email: v.string(),
    orgId: v.optional(v.id("organizations")), // Optional for migration
    specialties: v.optional(v.array(v.string())),
    license: v.optional(v.string()),
    npi: v.optional(v.string()), // National Provider Identifier
    dea: v.optional(v.string()), // DEA number for prescriptions
    practiceHours: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_org", ["orgId"]),

  // ============================================================================
  // Patients
  // ============================================================================
  patients: defineTable({
    name: v.string(),
    mrn: v.optional(v.string()), // Medical Record Number
    dateOfBirth: v.optional(v.string()),
    age: v.optional(v.string()),
    sex: v.optional(v.string()),
    // Insurance
    insurance: v.optional(v.object({
      provider: v.string(),
      memberId: v.optional(v.string()),
      groupId: v.optional(v.string()),
    })),
    // Emergency contact (replaces ownerName/ownerEmail/ownerPhone)
    emergencyContact: v.optional(v.object({
      name: v.string(),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      relationship: v.optional(v.string()),
    })),
    // Vitals snapshot (frequently updated from encounters)
    weight: v.optional(v.string()),      // e.g. "72 kg" or "160 lbs"
    weightUnit: v.optional(v.string()),  // "kg" | "lbs"
    // Clinical
    allergies: v.optional(v.array(v.string())),
    primaryCareProvider: v.optional(v.string()),
    providerId: v.string(),
    orgId: v.optional(v.id("organizations")), // Optional for migration
    locationId: v.optional(v.id("locations")), // Location assignment
    isActive: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
    medicalHistory: v.array(v.object({
      date: v.string(),
      type: v.string(),
      notes: v.string(),
      diagnosis: v.optional(v.string()),
      treatment: v.optional(v.string()),
      medications: v.optional(v.array(v.string())),
    })),
    labResults: v.optional(v.array(v.object({
      date: v.string(),
      testName: v.string(),
      results: v.string(),
      notes: v.optional(v.string()),
    }))),
    immunizations: v.optional(v.array(v.object({
      name: v.string(),
      date: v.string(),
      nextDueDate: v.optional(v.string()),
    }))),
  }).index("by_org", ["orgId"])
    .index("by_org_location", ["orgId", "locationId"]),

  // ============================================================================
  // Encounters
  // ============================================================================
  encounters: defineTable({
    patientId: v.id("patients"),
    providerId: v.string(),
    orgId: v.optional(v.id("organizations")), // Optional for migration
    locationId: v.optional(v.id("locations")), // Location assignment
    date: v.string(),
    transcription: v.optional(v.string()),
    physicalExam: v.optional(v.object({
      temperature: v.optional(v.number()),
      weight: v.optional(v.number()),
      weightUnit: v.optional(v.string()),
      heartRate: v.optional(v.number()),
      respiratoryRate: v.optional(v.number()),
      notes: v.optional(v.string()),
    })),
    diagnosis: v.optional(v.string()),
    treatment: v.optional(v.string()),
    followUp: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
    // Corti integration
    interactionId: v.optional(v.string()),
    facts: v.optional(v.array(v.object({
      id: v.string(),
      text: v.string(),
      group: v.string(),
    }))),
    diagnosisResult: v.optional(v.object({
      generatedAt: v.string(),
      triage: v.optional(v.object({
        urgencyLevel: v.string(),
        redFlags: v.array(v.string()),
        recommendedWorkflow: v.string(),
        reasoning: v.string(),
      })),
      patientContext: v.optional(v.object({
        ageCategory: v.string(),
        ageInYears: v.number(),
        weightKg: v.number(),
        riskFactors: v.optional(v.array(v.string())),
      })),
      differentials: v.optional(v.object({
        differentials: v.array(v.object({
          condition: v.string(),
          probability: v.string(),
          reasoning: v.string(),
          supportingEvidence: v.optional(v.array(v.string())),
          contradictingEvidence: v.optional(v.array(v.string())),
        })),
        keyFindings: v.array(v.string()),
      })),
      tests: v.optional(v.object({
        recommendedTests: v.array(v.object({
          test: v.string(),
          priority: v.string(),
          rationale: v.string(),
          targetConditions: v.optional(v.array(v.string())),
        })),
        suggestedPanel: v.optional(v.string()),
      })),
      treatments: v.optional(v.object({
        medications: v.array(v.object({
          drug: v.string(),
          drugClass: v.optional(v.string()),
          dose: v.string(),
          route: v.string(),
          frequency: v.string(),
          duration: v.string(),
          doseCalculation: v.optional(v.string()),
        })),
        supportiveCare: v.optional(v.array(v.string())),
        patientInstructions: v.optional(v.array(v.string())),
        warningSignsForPatient: v.optional(v.array(v.string())),
        followUpRecommendation: v.optional(v.object({
          timing: v.string(),
          purpose: v.string(),
        })),
      })),
      agentTrace: v.optional(v.array(v.object({
        agent: v.string(),
        status: v.string(),
        duration: v.number(),
      }))),
    })),
    generatedDocuments: v.optional(v.object({
      soapNote: v.optional(v.object({
        sections: v.array(v.object({
          key: v.string(),
          title: v.string(),
          content: v.string(),
        })),
        generatedAt: v.string(),
      })),
      afterVisitSummary: v.optional(v.object({
        sections: v.array(v.object({
          key: v.string(),
          title: v.string(),
          content: v.string(),
        })),
        generatedAt: v.string(),
      })),
      dischargeInstructions: v.optional(v.object({
        sections: v.array(v.object({
          key: v.string(),
          title: v.string(),
          content: v.string(),
        })),
        generatedAt: v.string(),
      })),
      referralLetter: v.optional(v.object({
        sections: v.array(v.object({
          key: v.string(),
          title: v.string(),
          content: v.string(),
        })),
        generatedAt: v.string(),
      })),
      prescription: v.optional(v.object({
        sections: v.array(v.object({
          key: v.string(),
          title: v.string(),
          content: v.string(),
        })),
        generatedAt: v.string(),
      })),
      followUpPlan: v.optional(v.object({
        sections: v.array(v.object({
          key: v.string(),
          title: v.string(),
          content: v.string(),
        })),
        generatedAt: v.string(),
      })),
      labOrder: v.optional(v.object({
        sections: v.array(v.object({
          key: v.string(),
          title: v.string(),
          content: v.string(),
        })),
        generatedAt: v.string(),
      })),
      shiftHandoff: v.optional(v.object({
        sections: v.array(v.object({
          key: v.string(),
          title: v.string(),
          content: v.string(),
        })),
        generatedAt: v.string(),
      })),
      invoice: v.optional(v.object({
        sections: v.array(v.object({
          key: v.string(),
          title: v.string(),
          content: v.string(),
        })),
        generatedAt: v.string(),
        totalAmount: v.number(),
        taxAmount: v.optional(v.number()),
        subtotal: v.number(),
      })),
    })),
    providerNotes: v.optional(v.object({
      diagnosis: v.optional(v.string()),
      treatmentPlan: v.optional(v.string()),
    })),
    invoiceMetadata: v.optional(v.object({
      invoiceNumber: v.string(), // "INV-202603-0042"
      invoiceDate: v.string(),
      dueDate: v.optional(v.string()),

      // Line items snapshot
      lineItems: v.array(v.object({
        billingItemId: v.id("billingItems"),
        description: v.string(),
        quantity: v.number(),
        unitPrice: v.number(), // cents
        taxable: v.boolean(),
        total: v.number(),
      })),

      // Totals
      subtotal: v.number(), // cents
      taxAmount: v.number(),
      taxRate: v.number(), // percentage
      grandTotal: v.number(),

      // Revenue recovery tracking
      revenueRecoveryPrompts: v.optional(v.array(v.object({
        itemDescription: v.string(),
        action: v.string(), // 'skipped' | 'added'
      }))),

      // Status
      status: v.string(), // 'draft' | 'finalized'
      finalizedAt: v.optional(v.string()),
    })),
    companionSessionId: v.optional(v.string()),
    status: v.optional(v.string()), // 'draft' | 'in-progress' | 'review' | 'published'
    lastGeneratedAt: v.optional(v.string()), // ISO timestamp of last document generation
    publishedAt: v.optional(v.string()), // ISO timestamp
    publishedBy: v.optional(v.string()), // Clerk userId
    appointmentTime: v.optional(v.string()), // scheduled appointment time
    reasonForVisit: v.optional(v.string()), // legacy field — use chiefComplaint
    chiefComplaint: v.optional(v.string()),
    encounterType: v.optional(v.string()), // 'ed' | 'inpatient' | 'outpatient' | 'telehealth'
    admissionStatus: v.optional(v.string()), // 'ambulatory' | 'admitted' | 'transferred' | 'discharged'
    icd10Codes: v.optional(v.array(v.string())),
    cptCodes: v.optional(v.array(v.string())),
    epicPatientId: v.optional(v.string()),    // FHIR Patient ID from Epic SMART launch
    epicEncounterId: v.optional(v.string()),  // FHIR Encounter ID from Epic SMART launch
    extractedPatientInfo: v.optional(v.object({
      name: v.optional(v.string()),
      age: v.optional(v.string()),
      weight: v.optional(v.string()),
      sex: v.optional(v.string()),
    })),
    factReconciliation: v.optional(v.object({
      reconciledFacts: v.array(v.object({
        factId: v.string(),
        text: v.string(),
        group: v.string(),
        status: v.string(), // 'confirmed' | 'updated' | 'contradicted' | 'new' | 'unchanged'
        recordingIndex: v.number(),
        priorFactId: v.optional(v.string()),
        priorText: v.optional(v.string()),
        priorRecordingIndex: v.optional(v.number()),
        resolution: v.optional(v.string()), // 'accept-new' | 'keep-old'
        resolvedAt: v.optional(v.string()),
      })),
      summary: v.object({
        confirmed: v.number(),
        updated: v.number(),
        contradicted: v.number(),
        new: v.number(),
        unchanged: v.number(),
      }),
      reconciledAt: v.string(),
      triggerRecordingCount: v.number(),
    })),
    caseReasoning: v.optional(v.object({
      differentials: v.optional(v.object({
        result: v.object({
          differentials: v.array(v.object({
            condition: v.string(),
            probability: v.string(),
            reasoning: v.string(),
            supportingEvidence: v.optional(v.array(v.string())),
            contradictingEvidence: v.optional(v.array(v.string())),
            literatureReferences: v.optional(v.array(v.object({
              title: v.string(),
              authors: v.optional(v.string()),
              journal: v.optional(v.string()),
              year: v.optional(v.number()),
              pmid: v.optional(v.string()),
              summary: v.optional(v.string()),
            }))),
          })),
          keyFindings: v.array(v.string()),
          uncertainties: v.optional(v.array(v.string())),
        }),
        generatedAt: v.string(),
        duration: v.number(),
      })),
      diagnosticTests: v.optional(v.object({
        result: v.object({
          recommendedTests: v.array(v.object({
            test: v.string(),
            rationale: v.string(),
            priority: v.string(),
            targetConditions: v.optional(v.array(v.string())),
            estimatedCost: v.optional(v.string()),
          })),
          interpretations: v.optional(v.array(v.object({
            test: v.string(),
            result: v.string(),
            referenceRange: v.string(),
            significance: v.string(),
            interpretation: v.string(),
            clinicalImplications: v.optional(v.array(v.string())),
          }))),
          suggestedPanel: v.optional(v.string()),
        }),
        generatedAt: v.string(),
        duration: v.number(),
        usedDifferentials: v.optional(v.boolean()),
      })),
      drugInteractions: v.optional(v.object({
        result: v.object({
          medications: v.array(v.object({
            drug: v.string(),
            drugClass: v.optional(v.string()),
            dose: v.string(),
            route: v.string(),
            frequency: v.string(),
            duration: v.string(),
            contraindications: v.optional(v.array(v.string())),
            interactions: v.optional(v.array(v.string())),
            sideEffects: v.optional(v.array(v.string())),
          })),
          interactions: v.array(v.object({
            drugs: v.array(v.string()),
            severity: v.string(),
            description: v.string(),
            recommendation: v.string(),
          })),
          contraindications: v.array(v.object({
            drug: v.string(),
            reason: v.string(),
            severity: v.string(),
          })),
        }),
        generatedAt: v.string(),
        duration: v.number(),
      })),
      literatureSearch: v.optional(v.object({
        result: v.object({
          references: v.array(v.object({
            title: v.string(),
            authors: v.optional(v.string()),
            journal: v.optional(v.string()),
            year: v.optional(v.number()),
            pmid: v.optional(v.string()),
            summary: v.optional(v.string()),
          })),
          summary: v.string(),
          query: v.string(),
        }),
        generatedAt: v.string(),
        duration: v.number(),
      })),
    })),
    addenda: v.optional(v.array(v.object({
      text: v.string(),
      providerId: v.string(),
      createdAt: v.string(),
    }))),
  }).index("by_org", ["orgId"])
    .index("by_org_location", ["orgId", "locationId"])
    .index("by_patient", ["patientId"])
    .index("by_status_org", ["status", "orgId"])
    .index("by_patient_status", ["patientId", "status"]),

  // ============================================================================
  // Patient Companion Sessions
  // ============================================================================
  companionSessions: defineTable({
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    providerId: v.string(),
    orgId: v.optional(v.id("organizations")), // Optional for migration
    locationId: v.optional(v.id("locations")), // Location assignment
    accessToken: v.string(),
    context: v.object({
      patientName: v.string(),
      age: v.optional(v.string()),
      visitSummary: v.string(),
      icd10Codes: v.optional(v.array(v.string())),
      visitDate: v.string(),
      diagnosis: v.optional(v.string()),
      treatmentPlan: v.optional(v.string()),
      medications: v.optional(v.array(v.object({
        name: v.string(),
        dose: v.string(),
        frequency: v.string(),
        duration: v.string(),
        instructions: v.string(),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
      }))),
      followUpDate: v.optional(v.string()),
      followUpReason: v.optional(v.string()),
      homeCareInstructions: v.optional(v.array(v.string())),
      warningSignsToWatch: v.optional(v.array(v.string())),
      dietaryInstructions: v.optional(v.string()),
      activityRestrictions: v.optional(v.string()),
      clinicName: v.optional(v.string()),
      clinicPhone: v.optional(v.string()),
      emergencyPhone: v.optional(v.string()),
      chargedServices: v.optional(v.array(v.object({
        description: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        total: v.number(),
      }))),
    }),
    isActive: v.boolean(),
    expiresAt: v.string(),
    messageCount: v.number(),
    lastAccessedAt: v.optional(v.string()),
    cortiAgentId: v.optional(v.string()),
    cortiContextId: v.optional(v.string()),
    contextVersion: v.optional(v.number()),
    createdAt: v.string(),
  }).index("by_access_token", ["accessToken"])
    .index("by_encounter", ["encounterId"])
    .index("by_patient", ["patientId"])
    .index("by_org", ["orgId"]),

  // ============================================================================
  // Follow-up Tracking
  // ============================================================================
  followUps: defineTable({
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    providerId: v.string(),
    orgId: v.optional(v.id("organizations")), // Optional for migration
    locationId: v.optional(v.id("locations")), // Location assignment
    scheduledDate: v.string(),
    type: v.string(),
    reason: v.string(),
    status: v.string(),
    reminderSent: v.boolean(),
    completedDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    monitoringInstructions: v.optional(v.array(v.string())),
    warningSignsForPatient: v.optional(v.array(v.string())),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_patient", ["patientId"])
    .index("by_provider_status", ["providerId", "status"])
    .index("by_scheduled_date", ["scheduledDate"])
    .index("by_org_status", ["orgId", "status"]),

  // ============================================================================
  // Recordings (foundation for multi-recording per encounter)
  // ============================================================================
  // ============================================================================
  // Evidence Files (lab PDFs, imaging, referral letters)
  // ============================================================================
  evidenceFiles: defineTable({
    encounterId: v.id("encounters"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    category: v.string(), // 'lab-result' | 'imaging' | 'referral' | 'other'
    notes: v.optional(v.string()), // Manual provider notes about this file
    extractedFindings: v.optional(v.array(v.object({
      id: v.string(),
      text: v.string(),
      group: v.string(),
      confidence: v.optional(v.number()),
    }))),
    extractionStatus: v.string(), // 'pending' | 'processing' | 'completed' | 'failed'
    uploadedBy: v.string(),
    createdAt: v.string(),
  }).index("by_encounter", ["encounterId"]),

  // ============================================================================
  // Recordings (foundation for multi-recording per encounter)
  // ============================================================================
  recordings: defineTable({
    encounterId: v.id("encounters"),
    interactionId: v.optional(v.string()),
    duration: v.optional(v.number()), // seconds
    transcript: v.optional(v.string()),
    facts: v.optional(v.array(v.object({
      id: v.string(),
      text: v.string(),
      group: v.string(),
    }))),
    phase: v.optional(v.string()), // 'history' | 'exam' | 'assessment' | 'follow-up'
    orderIndex: v.optional(v.number()), // for future reordering
    createdAt: v.string(),
    // Billing extraction tracking
    billingExtractionStatus: v.optional(v.union(v.literal("processing"), v.literal("completed"), v.literal("failed"))),
    billingExtractionAt: v.optional(v.number()),
    billingItemsExtracted: v.optional(v.number()),
    billingExtractionError: v.optional(v.string()),
  }).index("by_encounter", ["encounterId"]),

  // ============================================================================
  // Case Reasoning Chat Sessions
  // ============================================================================
  caseReasoningSessions: defineTable({
    encounterId: v.optional(v.id("encounters")),
    providerId: v.string(),
    orgId: v.optional(v.id("organizations")),
    title: v.optional(v.string()),
    cortiAgentId: v.optional(v.string()),
    cortiContextId: v.optional(v.string()),
    messages: v.array(v.object({
      id: v.string(),
      role: v.string(),
      content: v.string(),
      isError: v.optional(v.boolean()),
      createdAt: v.string(),
    })),
    messageCount: v.number(),
    lastMessageAt: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_encounter", ["encounterId"])
    .index("by_org", ["orgId"])
    .index("by_provider", ["providerId"]),

  // ============================================================================
  // Error Logging (Debugging)
  // ============================================================================
  errorLogs: defineTable({
    category: v.string(), // 'corti-stream' | 'corti-facts' | 'corti-document' | 'corti-agent' | 'websocket' | 'client-error' | 'other'
    severity: v.string(), // 'error' | 'warning' | 'info'
    message: v.string(),
    stack: v.optional(v.string()),
    interactionId: v.optional(v.string()),
    endpoint: v.optional(v.string()),
    requestPayload: v.optional(v.string()), // JSON stringified, sanitized
    userId: v.optional(v.string()),
    orgId: v.optional(v.id("organizations")),
    metadata: v.optional(v.string()), // Additional context as JSON
    resolved: v.boolean(),
    createdAt: v.string(),
  }).index("by_category", ["category"])
    .index("by_severity", ["severity"])
    .index("by_interaction", ["interactionId"])
    .index("by_created", ["createdAt"]),

  // ============================================================================
  // Onboarding & Setup Tracking
  // ============================================================================
  organizationSetup: defineTable({
    orgId: v.id("organizations"),
    // Onboarding tracking
    onboardingCompleted: v.boolean(),
    onboardingCompletedAt: v.optional(v.string()),
    // Feature setup tracking
    locationSetupCompleted: v.boolean(),
    teamSetupCompleted: v.boolean(),
    billingSetupCompleted: v.boolean(),
    // Migration tracking
    migrationVersion: v.optional(v.string()),
    // Timestamps
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_org", ["orgId"]),

  userPreferences: defineTable({
    userId: v.string(), // Clerk user ID
    orgId: v.id("organizations"),
    // Feature discovery
    dismissedBanners: v.array(v.string()), // ['multi-location-upgrade', 'location-setup']
    completedTours: v.array(v.string()), // ['dashboard-tour', 'location-tour']
    seenFeatures: v.object({}), // Flexible object for feature timestamps
    // Wizard state (resumable)
    wizardState: v.optional(v.object({
      wizardId: v.string(),
      currentStep: v.number(),
      data: v.any(), // Flexible data storage
      startedAt: v.string(),
    })),
    // Timestamps
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_user_org", ["userId", "orgId"])
    .index("by_org", ["orgId"]),

  // Analytics events for super admin insights
  analyticsEvents: defineTable({
    eventType: v.string(), // 'wizard_started', 'wizard_completed', 'wizard_abandoned', etc.
    userId: v.string(),
    orgId: v.optional(v.id("organizations")),
    metadata: v.optional(v.object({})), // Flexible event data
    timestamp: v.string(),
  }).index("by_event_type", ["eventType"])
    .index("by_org", ["orgId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_user", ["userId"]),

  // ============================================================================
  // Audit Logs (HIPAA compliance)
  // ============================================================================
  auditLogs: defineTable({
    orgId: v.optional(v.id("organizations")),
    userId: v.string(), // Clerk user ID
    action: v.string(), // 'view' | 'create' | 'update' | 'delete' | 'export' | 'share'
    resourceType: v.string(), // 'encounter' | 'patient' | 'document' | 'companion'
    resourceId: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    metadata: v.optional(v.string()), // JSON stringified additional context
    timestamp: v.string(),
  }).index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_resource", ["resourceType", "resourceId"])
    .index("by_timestamp", ["timestamp"]),

  billingItems: defineTable({
    encounterId: v.id("encounters"),
    orgId: v.id("organizations"),

    // Catalog linkage (optional for manual items)
    catalogItemId: v.optional(v.id("billingCatalog")),

    // Item details (snapshot at billing time)
    description: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),         // Cents, snapshot from catalog
    taxable: v.boolean(),          // Snapshot from catalog

    // Two-phase tracking
    phase: v.string(),             // 'prospective' | 'retrospective'
    recordingId: v.optional(v.id("recordings")),
    invoicedAt: v.optional(v.string()),

    // Reconciliation (for Milestone 3)
    reconciliationStatus: v.optional(v.string()),
    linkedItemId: v.optional(v.id("billingItems")),

    // Extraction metadata
    extractedFromFact: v.optional(v.string()),
    manuallyAdded: v.boolean(),
    confidence: v.optional(v.string()),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_encounter", ["encounterId"])
    .index("by_encounter_phase", ["encounterId", "phase"])
    .index("by_org", ["orgId"])
    .index("by_recording", ["recordingId"]),
});
