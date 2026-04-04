'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Mic,
  FileText,
  Brain,
  MessageCircle,
  Shield,
  ArrowRight,
  CheckCircle,
  Sparkles,
  ClipboardList,
  TrendingUp,
  ChevronRight,
  Receipt,
} from 'lucide-react';
import { LandingNav } from './LandingNav';
import { ComparisonSection } from './ComparisonSection';

// ─── Platform pillars ───────────────────────────────────────────────────────

const PILLARS = [
  {
    icon: ClipboardList,
    label: 'Clinical Platform',
    headline: 'From first word to final note — automatically.',
    body: 'Ambient AI captures your encounter in real-time. Case reasoning engines surface differential diagnoses, drug interactions, and evidence-based protocols. Every document generated before the patient leaves the room.',
  },
  {
    icon: TrendingUp,
    label: 'Revenue Platform',
    headline: 'Every billable service, captured.',
    body: 'AI extracts billable items from the clinical narrative. Manage your procedure catalog with custom pricing, categories, and tax settings. Generate itemised invoices directly from encounters.',
  },
];

// ─── Feature data ──────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Mic,
    title: 'Ambient Encounter AI',
    description:
      'Speak naturally during patient visits. AI listens, extracts clinical facts, and builds a structured record in real-time — no templates, no dictation workflow.',
  },
  {
    icon: Brain,
    title: 'Case Reasoning Engine',
    description:
      'Differential diagnoses, drug interaction checks, and evidence-based treatment protocols — surfaced automatically from the clinical narrative.',
  },
  {
    icon: FileText,
    title: 'Complete Clinical Documentation',
    description:
      'SOAP notes, patient summaries, discharge instructions, referral letters, and prescriptions — all generated from the encounter. Nothing manually typed.',
  },
  {
    icon: MessageCircle,
    title: 'Patient Companion AI',
    description:
      'Send patients a personalised AI assistant that answers questions about their visit, medications, and home care — in plain language.',
  },
  {
    icon: Receipt,
    title: 'Revenue Intelligence',
    description:
      'AI identifies billable services from every encounter. Manage your procedure catalog and generate itemised invoices without a separate billing workflow.',
  },
  {
    icon: Shield,
    title: 'Built for Medicine',
    description:
      'Grounded in clinical evidence, not general AI. Drug interactions, diagnostic hierarchies, and medical literature — built into every output.',
  },
];

// ─── Pricing data ──────────────────────────────────────────────────────────────

const PRICING = [
  {
    name: 'Solo',
    price: 79,
    period: '/month',
    description: 'For individual practitioners',
    features: [
      '1 physician',
      '150 encounters/month',
      'Ambient encounter documentation',
      'SOAP notes & patient summaries',
      '50 patient companion sessions/month',
      'Follow-up tracking',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Practice',
    price: 149,
    period: '/month',
    description: 'For small to mid-size clinics',
    features: [
      '2 providers included (+$49/extra)',
      '500 encounters/month',
      'Everything in Solo',
      '200 patient companion sessions/month',
      'Team management & roles',
      '14-day free trial',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Multi-Site',
    price: 299,
    period: '/month',
    description: 'For hospital groups & health systems',
    features: [
      '5 providers included (+$39/extra)',
      '2,000 encounters/month',
      'Everything in Practice',
      'Unlimited companion sessions',
      'Multi-location management',
      'Priority support',
    ],
    cta: 'Contact Us',
    highlighted: false,
  },
];

// ─── Steps ─────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    step: '1',
    title: 'The AI listens. You focus on the patient.',
    description:
      'Open an encounter and speak naturally. [PRODUCT_NAME] captures everything — vitals, history, findings, and plan — without interrupting your clinical flow.',
  },
  {
    step: '2',
    title: 'Clinical intelligence, applied automatically.',
    description:
      'Review extracted facts, run the case reasoning engine for differential diagnoses and drug interaction checks, and confirm your clinical decisions.',
  },
  {
    step: '3',
    title: 'Every document generated. Nothing manually typed.',
    description:
      'One click produces SOAP notes, discharge instructions, prescriptions, and referral letters. Share a personalised companion link with the patient on their way out.',
  },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />

      {/* Hero */}
      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted/60 text-sm font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI Clinical Platform for Medicine
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
            The clinical AI that runs
            <br />
            <span className="text-primary">your entire practice workflow.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Ambient documentation, case reasoning, complete clinical notes, patient communication, and revenue capture — unified in a single platform.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2 text-base px-8">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline" size="lg" className="gap-1.5 text-base px-8">
                See the platform <ChevronRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
          {/* Credibility strip */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <span>✓ No templates or dictation workflow</span>
            <span>✓ Works with any EHR</span>
            <span>✓ 14-day free trial</span>
          </div>
        </div>
      </section>

      {/* Platform pillars */}
      <section className="py-16 px-4 sm:px-6 border-y bg-muted/30">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div key={pillar.label} className="bg-background rounded-xl p-8 border shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {pillar.label}
                  </span>
                </div>
                <h3 className="font-semibold text-xl mb-3">{pillar.headline}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{pillar.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">Everything in one platform</h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Every tool a modern practice needs — from first word to final invoice.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="bg-background rounded-xl p-6 border shadow-sm"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-muted/50 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">How it works</h2>
          </div>
          <div className="space-y-12">
            {STEPS.map((item) => (
              <div key={item.step} className="flex gap-6 items-start">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{item.title}</h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Matrix */}
      <ComparisonSection />

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-muted/50 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">Simple, transparent pricing</h2>
            <p className="mt-4 text-muted-foreground">
              No setup fees. No contracts. Cancel anytime.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {PRICING.map((plan) => (
              <div
                key={plan.name}
                className={`bg-background rounded-xl p-8 border shadow-sm flex flex-col ${
                  plan.highlighted ? 'ring-2 ring-primary border-primary relative' : ''
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </div>
                <ul className="mt-8 space-y-3 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" className="mt-8 block">
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? 'default' : 'outline'}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold">Stop charting. Start healing.</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Physicians save 2–3 hours of documentation time every day. The AI handles the paperwork.
          </p>
          <Link href="/sign-up" className="mt-8 inline-block">
            <Button size="lg" className="gap-2 text-base px-8">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">[PRODUCT_NAME] · AI Clinical Platform</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} [PRODUCT_NAME]. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
